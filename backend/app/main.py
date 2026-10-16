"""REST/GeoJSON API for Railway Network Explorer."""
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from psycopg.rows import dict_row

from .db import connect, ensure_schema
from .routing import build_graph, k_paths, summarize_path


@asynccontextmanager
async def lifespan(_app):
    ensure_schema()
    yield


app = FastAPI(title="Railway Network Explorer", version="0.3.3", lifespan=lifespan,
              description="Infrastructure graph from Infrabel, not a train timetable or ticket validator")


def rows(sql, params=()):
    with connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params)
            return cur.fetchall()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/meta")
def meta():
    result = rows("""
        SELECT (SELECT count(*) FROM stations) AS stations,
               (SELECT count(*) FROM rail_segments) AS segments,
               (SELECT imported_at FROM import_runs ORDER BY id DESC LIMIT 1) AS imported_at,
               (SELECT source_name FROM import_runs ORDER BY id DESC LIMIT 1) AS source_name
    """)[0]
    return result


@app.get("/api/stations")
def stations(search: str = "", limit: int = Query(15, ge=1, le=100)):
    search = search.strip()
    if not search:
        return []
    pattern = f"%{search}%"
    found = rows("""
        SELECT s.infrabel_id AS id, s.name_nl AS name, s.name_fr,
               s.classification, ST_X(s.geom) AS lon, ST_Y(s.geom) AS lat
        FROM stations s
        WHERE (s.name_nl ILIKE %s OR s.name_fr ILIKE %s OR s.operational_name ILIKE %s)
          AND EXISTS (SELECT 1 FROM rail_segments r
                      WHERE r.from_station_id=s.infrabel_id OR r.to_station_id=s.infrabel_id)
        ORDER BY CASE WHEN lower(s.name_nl)=lower(%s) THEN 0 ELSE 1 END, s.name_nl
        LIMIT %s
    """, (pattern, pattern, pattern, search, limit))
    return found


@app.get("/api/stations/geojson")
def stations_geojson():
    found = rows("""
        SELECT s.infrabel_id AS id, s.name_nl AS name, s.classification,
               ST_AsGeoJSON(s.geom) AS geometry
        FROM stations s
        WHERE s.geom IS NOT NULL
          AND EXISTS (SELECT 1 FROM rail_segments r
                      WHERE r.from_station_id=s.infrabel_id OR r.to_station_id=s.infrabel_id)
    """)
    return {"type": "FeatureCollection", "features": [
        {"type": "Feature", "id": s["id"],
         "properties": {"id": s["id"], "name": s["name"], "classification": s["classification"]},
         "geometry": json.loads(s["geometry"])} for s in found
    ]}


@app.get("/api/network")
def network():
    found = rows("""
        SELECT r.id, r.from_station_id, r.to_station_id,
               a.name_nl AS from_name, b.name_nl AS to_name,
               r.distance_km, ST_AsGeoJSON(r.geom) AS geometry
        FROM rail_segments r
        JOIN stations a ON a.infrabel_id=r.from_station_id
        JOIN stations b ON b.infrabel_id=r.to_station_id
    """)
    return {"type": "FeatureCollection", "features": [
        {"type": "Feature", "id": s["id"],
         "properties": {"id": s["id"], "from": s["from_station_id"], "to": s["to_station_id"],
                        "from_name": s["from_name"], "to_name": s["to_name"],
                        "distance_km": s["distance_km"]},
         "geometry": json.loads(s["geometry"])} for s in found
    ]}


@app.get("/api/routes")
def routes(from_id: str, to_id: str, via_id: str | None = None,
           alternatives: int = Query(3, ge=1, le=5)):
    segments = rows("""
        SELECT id, from_station_id AS from_id, to_station_id AS to_id,
               distance_km, ST_AsGeoJSON(geom) AS geometry FROM rail_segments
    """)
    if not segments:
        raise HTTPException(status_code=503, detail="Importeer eerst de Infrabel-data")
    graph = build_graph(segments)
    try:
        paths = k_paths(graph, from_id, to_id, count=alternatives, via=via_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    if not paths:
        raise HTTPException(status_code=404, detail="Geen verbinding in de infrastructuurgraaf gevonden")
    by_id = {seg["id"]: seg for seg in segments}
    name_rows = rows("SELECT infrabel_id AS id, name_nl AS name FROM stations")
    names = {row["id"]: row["name"] for row in name_rows}
    result = []
    for index, path in enumerate(paths):
        info = summarize_path(graph, path)
        geometries = []
        for segment_id in info["segment_ids"]:
            seg = by_id[segment_id]
            geometries.append({"type": "Feature", "properties": {"id": segment_id},
                               "geometry": json.loads(seg["geometry"])})
        result.append({"index": index, **info,
                       "station_names": [names.get(sid, sid) for sid in path],
                       "geometry": {"type": "FeatureCollection", "features": geometries}})
    return {"basis": "estimated_infrastructure_distance", "mode": "infrastructure_only",
            "transfer_stations": None, "scheduled_service": False,
            "ticket_validity": "not_checked", "routes": result}

# Scheduled train services are isolated from the Infrabel infrastructure router.
# GTFS is imported separately; routes are available only when a feed is present.
from datetime import date as date_type
from .gtfs_db import ensure_gtfs_schema
from .gtfs_routing import timetable_routes
from .rail_geometry import enrich_with_infrabel
from .travel_time import validate_future_departure


@app.get('/api/gtfs/meta')
def gtfs_meta():
    ensure_gtfs_schema()
    result = rows('''
        SELECT imported_at, source_name, stop_count, trip_count, connection_count,
               start_date, end_date
        FROM gtfs_import_runs ORDER BY id DESC LIMIT 1
    ''')
    return {'available': bool(result), 'feed': result[0] if result else None,
            'mode': 'scheduled_gtfs_only', 'realtime': False, 'ticket_validity': 'not_checked'}


# Served stations share identifiers with canonical GTFS connections.
# Both directions have indexes so station suggestions remain responsive.
GTFS_SERVED_PREDICATE = """
 (EXISTS (SELECT 1 FROM gtfs_connections c WHERE c.from_stop_id=s.stop_id)
  OR EXISTS (SELECT 1 FROM gtfs_connections c WHERE c.to_stop_id=s.stop_id))
"""


LANGUAGES = ('nl', 'fr', 'en', 'de')


def localized_station_sql():
    return """
      FROM gtfs_stops s
      LEFT JOIN gtfs_station_translations localname
        ON localname.stop_id=s.stop_id AND localname.language=%s
      LEFT JOIN gtfs_station_labels fallback
        ON fallback.stop_id=s.stop_id
    """


def station_name_expression(lang: str):
    # Preserve Dutch labels from older installs when iRail has not been imported.
    return "COALESCE(localname.name, " + ("fallback.name_nl, " if lang == 'nl' else '') + "s.name)"


@app.get('/api/gtfs/stations')
def gtfs_stations(search: str = '', limit: int = Query(15, ge=1, le=50),
                  lang: str = Query('nl', pattern='^(nl|fr|en|de)$'),
                via_transfer_id: str | None = None):
    ensure_gtfs_schema()
    if len(search.strip()) < 2:
        return []
    term = search.strip()
    pattern = f'%{term}%'
    prefix = f'{term}%'
    display = station_name_expression(lang)
    return rows(f'''
        SELECT s.stop_id AS id, {display} AS name,
               s.name AS original_name, s.lat, s.lon
        {localized_station_sql()}
        WHERE s.lat IS NOT NULL AND s.lon IS NOT NULL
          AND (s.name ILIKE %s
               OR EXISTS (SELECT 1 FROM gtfs_station_translations tr
                          WHERE tr.stop_id=s.stop_id AND tr.name ILIKE %s)
               OR fallback.name_nl ILIKE %s)
          AND {GTFS_SERVED_PREDICATE}
        ORDER BY CASE
                   WHEN LOWER({display})=LOWER(%s) THEN 0
                   WHEN LOWER(s.name)=LOWER(%s) THEN 1
                   WHEN EXISTS (SELECT 1 FROM gtfs_station_translations exact
                                WHERE exact.stop_id=s.stop_id AND LOWER(exact.name)=LOWER(%s)) THEN 2
                   WHEN {display} ILIKE %s OR s.name ILIKE %s THEN 3
                   ELSE 4
                 END,
                 (SELECT COUNT(*) FROM gtfs_connections popular
                  WHERE popular.from_stop_id=s.stop_id) DESC,
                 LENGTH({display}), {display}, s.stop_id
        LIMIT %s
    ''', (lang, pattern, pattern, pattern, term, term, term,
          prefix, prefix, limit))


@app.get('/api/gtfs/stations/geojson')
def gtfs_station_points(lang: str = Query('nl', pattern='^(nl|fr|en|de)$')):
    """Clickable stations use the same IDs and localized names as search."""
    ensure_gtfs_schema()
    display = station_name_expression(lang)
    matches = rows(f'''
        SELECT s.stop_id AS id, {display} AS name,
               s.name AS original_name, s.lat, s.lon
        {localized_station_sql()}
        WHERE s.lat IS NOT NULL AND s.lon IS NOT NULL
          AND {GTFS_SERVED_PREDICATE}
    ''', (lang,))
    return {'type': 'FeatureCollection', 'features': [
        {'type': 'Feature', 'id': r['id'],
         'properties': {'id': r['id'], 'name': r['name'],
                        'original_name': r['original_name']},
         'geometry': {'type': 'Point', 'coordinates': [r['lon'], r['lat']]}}
        for r in matches
    ]}


@app.get('/api/gtfs/translations/meta')
@app.get('/api/gtfs/labels/meta')
def gtfs_translations_meta():
    """Inspect translated names. Legacy diagnostic URL remains supported."""
    ensure_gtfs_schema()
    total = rows('SELECT count(*) AS gtfs_stops FROM gtfs_stops')[0]['gtfs_stops']
    counts = rows('''
        SELECT language, count(*) AS names
        FROM gtfs_station_translations GROUP BY language ORDER BY language
    ''')
    examples = rows('''
        SELECT s.stop_id AS id, s.name AS gtfs_name, tr.language, tr.name
        FROM gtfs_stops s LEFT JOIN gtfs_station_translations tr ON tr.stop_id=s.stop_id
        WHERE s.stop_id = 'gs:nmbssncb:S8833001'
        ORDER BY tr.language
    ''')
    return {'gtfs_stops': total, 'languages': {r['language']: r['names'] for r in counts},
            'supported_languages': list(LANGUAGES), 'leuven_examples': examples}


@app.get('/api/gtfs/routes')
def gtfs_routes(from_id: str, to_id: str, date: date_type,
                time: str = Query('08:00', pattern=r'^\d{2}:\d{2}$'),
                alternatives: int = Query(4, ge=1, le=5),
                lang: str = Query('nl', pattern='^(nl|fr|en|de)$'),
                via_transfer_id: str | None = None):
    ensure_gtfs_schema()
    last = rows('SELECT start_date, end_date FROM gtfs_import_runs ORDER BY id DESC LIMIT 1')
    if not last:
        raise HTTPException(status_code=503, detail='Importeer eerst een NMBS GTFS Static ZIP')
    if (last[0]['start_date'] and date < last[0]['start_date'] or
        last[0]['end_date'] and date > last[0]['end_date']):
        raise HTTPException(status_code=422, detail='Datum valt buiten het bereik van de GTFS-feed')
    try:
        validate_future_departure(date, time)
        journeys = timetable_routes(from_id, to_id, date, time, alternatives, language=lang,
                                    via_transfer_id=via_transfer_id)
        journeys = enrich_with_infrabel(journeys)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {'mode': 'scheduled_gtfs_only', 'service_date': date,
            'realtime': False, 'ticket_validity': 'not_checked',
            'geometry_is_schematic': True,
            'geometry_description': 'Infrabel-netwerkbenadering met gestippelde fallback; geen exacte rijweg',
            'journeys': journeys}
