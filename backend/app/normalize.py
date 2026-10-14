"""Pure functions for validating and normalizing Opendatasoft API records."""
from __future__ import annotations
import hashlib
import json
import math


def _point(obj):
    """Opendatasoft API 2.1 uses {lon, lat}; GeoJSON is lon/lat."""
    if isinstance(obj, dict) and "lat" in obj and "lon" in obj:
        pos = (float(obj["lon"]), float(obj["lat"]))
    elif isinstance(obj, (list, tuple)) and len(obj) == 2:
        # Legacy Opendatasoft geo_point_2d arrays are [lat, lon].
        pos = (float(obj[1]), float(obj[0]))
    else:
        return None
    if not (-180 <= pos[0] <= 180 and -90 <= pos[1] <= 90):
        raise ValueError(f"Invalid WGS84 point: {pos}")
    return pos


def normalize_station(raw):
    ident = str(raw.get("ptcarid") or "").strip()
    if not ident:
        raise ValueError("Operational point missing ptcarid")
    name_nl = (
        raw.get("commerciallongnamedutch")
        or raw.get("commercialmiddlenamefrench")
        or raw.get("longnamedutch")
        or raw.get("shortnamedutch")
        or raw.get("symbolicname")
        or ident
    )
    location = _point(raw.get("geo_point_2d"))
    if location is None:
        geo = raw.get("geo_shape") or {}
        geometry = geo.get("geometry", geo)
        if geometry.get("type") == "Point":
            location = tuple(geometry["coordinates"])
    return {
        "id": ident,
        "name_nl": str(name_nl),
        "name_fr": str(raw.get("commerciallongnamefrench") or raw.get("longnamefrench") or "") or None,
        "operational_name": raw.get("longnamedutch") or raw.get("shortnamedutch"),
        "classification": raw.get("classification"),
        "taf_tap_code": raw.get("taftapcode"),
        "point": location,
    }


def normalize_segment(raw):
    source, dest = str(raw.get("stationfrom_id") or "").strip(), str(raw.get("stationto_id") or "").strip()
    if not source or not dest or source == dest:
        raise ValueError("Segment has invalid endpoint IDs")
    distance = float(raw["length"])
    if not math.isfinite(distance) or distance <= 0:
        raise ValueError(f"Invalid length for {source} → {dest}: {distance}")
    wrapped = raw.get("geo_shape") or {}
    geo = wrapped.get("geometry", wrapped)
    # Source dataset has LineStrings; reject incompatible geometry rather than silently corrupting geometry.
    if geo.get("type") != "LineString":
        raise ValueError(f"Expected LineString, found {geo.get('type')}")
    coords = geo.get("coordinates")
    if not isinstance(coords, list) or len(coords) < 2:
        raise ValueError("LineString needs at least two points")
    for p in coords:
        if len(p) < 2 or not all(math.isfinite(float(x)) for x in p[:2]):
            raise ValueError("Invalid geometry coordinate")
        if not (-180 <= float(p[0]) <= 180 and -90 <= float(p[1]) <= 90):
            raise ValueError("Geometry coordinates must be WGS84 lon/lat")
    geometry = {"type": "LineString", "coordinates": coords}
    # Same pair can occur more than once. Geometry participates in the stable key.
    identity = json.dumps({"ends": sorted([source, dest]), "geometry": geometry, "km": distance}, sort_keys=True, separators=(",", ":"))
    ident = hashlib.sha256(identity.encode()).hexdigest()[:32]
    return {
        "id": ident,
        "from_id": source,
        "to_id": dest,
        "from_name": str(raw.get("stationfrom_name") or source),
        "to_name": str(raw.get("stationto_name") or dest),
        "distance_km": distance,
        "geometry": geometry,
    }


def prepare(operational_points, line_records):
    stations = {}
    for row in operational_points:
        s = normalize_station(row)
        stations[s["id"]] = s
    segments = {}
    for row in line_records:
        e = normalize_segment(row)
        segments[e["id"]] = e
        # Endpoints can exist in station_to_station without a matching OP entry.
        # Prefer official OP position; fallback endpoints are schematic only.
        for sid, name, coordinate in (
            (e["from_id"], e["from_name"], e["geometry"]["coordinates"][0]),
            (e["to_id"], e["to_name"], e["geometry"]["coordinates"][-1]),
        ):
            if sid not in stations:
                stations[sid] = dict(id=sid, name_nl=name, name_fr=None,
                                     operational_name=name, classification="Unknown",
                                     taf_tap_code=None, point=(coordinate[0], coordinate[1]))
    if len(stations) < 5 or len(segments) < 3:
        raise ValueError("Refusing suspiciously small/empty import (at least 5 stations and 3 edges required)")
    return list(stations.values()), list(segments.values())


