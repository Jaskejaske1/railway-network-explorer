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


app = FastAPI(title="Railway Network Explorer", version="0.1.2", lifespan=lifespan,
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
