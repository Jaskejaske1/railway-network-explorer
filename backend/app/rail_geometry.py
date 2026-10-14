"""Project scheduled GTFS itineraries onto Infrabel's station-to-station network.

This is a *network approximation*, not guaranteed train movement: GTFS Static
has stop sequences, while Infrabel's public graph lacks switches and train paths.
Unmappable sections are retained as visibly dashed straight fallback segments.
"""
import math
import re
import unicodedata

import networkx as nx

from .db import connect
from .routing import build_graph


def normalized_name(value):
    value = unicodedata.normalize('NFKD', str(value or ''))
    value = ''.join(c for c in value if not unicodedata.combining(c)).casefold()
    return re.sub(r'[^a-z0-9]+', '', value)


def distance_km(a, b):
    latitude_a, latitude_b = math.radians(a['lat']), math.radians(b['lat'])
    delta_lat = latitude_b - latitude_a
    delta_lon = math.radians(b['lon'] - a['lon'])
    h = math.sin(delta_lat / 2)**2 + math.cos(latitude_a) * math.cos(latitude_b) * math.sin(delta_lon / 2)**2
    return 12742 * math.asin(min(1.0, math.sqrt(h)))


def assign_nodes(gtfs_stops, infrabel_nodes, aliases):
    """Match by official multilingual name + location, or exceptionally <80 m.

    Mapping is conservative: do not silently connect unrelated station names.
    GTFS IDs remain unchanged for all timetable calculations.
    """
    result = {}
    for stop_id, stop in gtfs_stops.items():
        if stop['lat'] is None or stop['lon'] is None:
            continue
        names = {normalized_name(stop.get('name'))}
        names.update(normalized_name(n) for n in aliases.get(stop_id, ()))
        names.discard('')
        chosen = None
        for node in infrabel_nodes:
            if node['lat'] is None or node['lon'] is None:
                continue
            lat_delta = abs(float(stop['lat']) - float(node['lat']))
            lon_delta = abs(float(stop['lon']) - float(node['lon']))
            if lat_delta > .012 or lon_delta > .019:
                continue
            km = distance_km(stop, node)
            node_names = [node.get('name_nl'), node.get('name_fr'), node.get('operational_name')]
            has_name = bool(names.intersection(normalized_name(n) for n in node_names))
            if not ((has_name and km <= 1.2) or km <= .08):
                continue
            score = (0 if has_name else 1, km)
            if chosen is None or score < chosen[0]:
                chosen = (score, node['id'])
        if chosen:
            result[stop_id] = chosen[1]
    return result


def project_journeys(journeys, gtfs_stops, infrabel_nodes, segments, aliases=None):
    """Return journeys with route segments matched to Infrabel whenever possible."""
    aliases = aliases or {}
    lookup = assign_nodes(gtfs_stops, infrabel_nodes, aliases)
    graph = build_graph(segments)
    segment_by_id = {s['id']: s for s in segments}
    cache = {}
    projected = []
    for journey in journeys:
        features = []
        used_rail = used_fallback = 0
        for leg in journey['legs']:
            for src, dst in zip(leg['stop_ids'], leg['stop_ids'][1:]):
                a, b = lookup.get(src), lookup.get(dst)
                path = None
                if a and b and a != b and a in graph and b in graph:
                    key = (a, b)
                    if key not in cache:
                        try:
                            candidate = nx.shortest_path(graph, a, b, weight='weight')
                            length = nx.path_weight(graph, candidate, weight='weight')
                            direct = distance_km(gtfs_stops[src], gtfs_stops[dst])
                            cache[key] = candidate if length <= max(3.0, direct * 2.8 + 2) else None
                        except (nx.NetworkXNoPath, nx.NodeNotFound):
                            cache[key] = None
                    path = cache[key]
                if path:
                    for p, q in zip(path, path[1:]):
                        segment = segment_by_id[graph[p][q]['segment_id']]
                        features.append({'type':'Feature', 'geometry': segment['geometry'],
                                         'properties': {'geometry_source': 'infrabel_estimate', 'trip_id': leg['trip_id']}})
                        used_rail += 1
                else:
                    left, right = gtfs_stops.get(src), gtfs_stops.get(dst)
                    if left and right and None not in (left['lon'],left['lat'],right['lon'],right['lat']):
                        features.append({'type':'Feature', 'geometry': {'type':'LineString',
                             'coordinates': [[left['lon'],left['lat']], [right['lon'],right['lat']]]},
                             'properties': {'geometry_source': 'schematic_fallback', 'trip_id': leg['trip_id']}})
                        used_fallback += 1
        projected.append({**journey,
                          'geometry': {'type':'FeatureCollection', 'features': features},
                          'geometry_quality': {'infrabel_segments': used_rail,
                                               'schematic_fallbacks': used_fallback,
                                               'description': 'Benadering via Infrabel-spoorwegen; geen gegarandeerd gereden spoor'}})
    return projected


def enrich_with_infrabel(journeys):
    """Load geometry only for itineraries found; does not touch GTFS routing."""
    if not journeys:
        return journeys
    ids = set()
    for journey in journeys:
        for leg in journey['legs']:
            ids.update(leg['stop_ids'])
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT stop_id, name, lat, lon FROM gtfs_stops WHERE stop_id = ANY(%s)', (list(ids),))
            gtfs_stops = {r[0]: {'name':r[1], 'lat':r[2], 'lon':r[3]} for r in cur.fetchall()}
            cur.execute('SELECT stop_id, name FROM gtfs_station_translations WHERE stop_id = ANY(%s)', (list(ids),))
            aliases = {}
            for stop_id, name in cur.fetchall():
                aliases.setdefault(stop_id, []).append(name)
            cur.execute('''SELECT infrabel_id, name_nl, name_fr, operational_name,
                                  ST_Y(geom), ST_X(geom) FROM stations
                           WHERE geom IS NOT NULL AND
                             EXISTS (SELECT 1 FROM rail_segments
                                     WHERE from_station_id=infrabel_id OR to_station_id=infrabel_id)''')
            infrabel_nodes = [{'id':r[0], 'name_nl':r[1], 'name_fr':r[2], 'operational_name':r[3],
                               'lat':r[4], 'lon':r[5]} for r in cur.fetchall()]
            cur.execute('''SELECT id, from_station_id, to_station_id, distance_km,
                                  ST_AsGeoJSON(geom) FROM rail_segments''')
            import json
            segments = [{'id':r[0], 'from_id':r[1], 'to_id':r[2], 'distance_km':r[3],
                         'geometry':json.loads(r[4])} for r in cur.fetchall()]
    return project_journeys(journeys, gtfs_stops, infrabel_nodes, segments, aliases)
