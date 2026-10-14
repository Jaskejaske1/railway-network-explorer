"""Import two Infrabel datasets atomically into PostGIS.

Usage:
    python -m app.importer
    python -m app.importer --stations-json path/to/points.json --segments-json path/to/segments.json

Input files accept Opendatasoft API envelopes ({results:[...]}) or lists of records.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import httpx

from .db import connect, ensure_schema
from .normalize import prepare

ROOT = "https://opendata.infrabel.be/api/explore/v2.1/catalog/datasets"
OP = "operationele-punten-van-het-netwerk"
ST = "station_to_station"
PAGE_SIZE = 100


def fetch_dataset(dataset, client=None):
    """Fetch all records with pagination and bounded retries; never accept partial data."""
    with (httpx.Client(timeout=45.0, follow_redirects=True) if client is None else _unmanaged(client)) as http:
        records = []
        total = None
        while total is None or len(records) < total:
            offset = len(records)
            url = f"{ROOT}/{dataset}/records"
            error = None
            for attempt in range(4):
                try:
                    response = http.get(url, params={"limit": PAGE_SIZE, "offset": offset})
                    response.raise_for_status()
                    payload = response.json()
                    break
                except (httpx.HTTPError, ValueError) as exc:
                    error = exc
                    if attempt < 3:
                        time.sleep(0.5 * (2 ** attempt))
            else:
                raise RuntimeError(f"Could not fetch {dataset} offset {offset}") from error
            total = int(payload["total_count"])
            page = payload.get("results", [])
            if not page and len(records) < total:
                raise RuntimeError(f"Partial response for {dataset}: got {len(records)} of {total}")
            records.extend(page)
            print(f"{dataset}: {len(records)}/{total}", flush=True)
            if len(records) > total:
                raise RuntimeError(f"Dataset {dataset} changed during pagination; try again")
        if len(records) != total or not records:
            raise RuntimeError(f"Empty/incomplete dataset {dataset}")
        return records


class _unmanaged:
    """Use a test HTTP client without closing it."""
    def __init__(self, client): self.client = client
    def __enter__(self): return self.client
    def __exit__(self, *_): return None


def _load(path):
    obj = json.loads(Path(path).read_text(encoding="utf-8"))
    return obj["results"] if isinstance(obj, dict) else obj


def write_snapshot(stations, segments, source_name):
    """Entire snapshot is replaced in one transaction; on error old data remains."""
    ensure_schema()
    with connect() as conn:
        with conn.cursor() as cur:
            # PostgreSQL requires FK-related tables to be truncated in the same
            # statement, even when the referencing table was truncated earlier.
            # Keep this inside the transaction so a failed import rolls back.
            cur.execute("TRUNCATE TABLE rail_segments, stations")
            cur.executemany("""
                INSERT INTO stations (infrabel_id, name_nl, name_fr, operational_name,
                                      classification, taf_tap_code, geom)
                VALUES (%s, %s, %s, %s, %s, %s,
                        CASE WHEN %s::double precision IS NULL THEN NULL
                             ELSE ST_SetSRID(ST_MakePoint(%s, %s), 4326) END)
            """, [
                (s["id"], s["name_nl"], s["name_fr"], s["operational_name"],
                 s["classification"], s["taf_tap_code"],
                 None if s["point"] is None else s["point"][0],
                 None if s["point"] is None else s["point"][0],
                 None if s["point"] is None else s["point"][1])
                for s in stations
            ])
            cur.executemany("""
                INSERT INTO rail_segments (id, from_station_id, to_station_id, distance_km, geom)
                VALUES (%s, %s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))
            """, [
                (e["id"], e["from_id"], e["to_id"], e["distance_km"],
                 json.dumps(e["geometry"], separators=(",", ":")))
                for e in segments
            ])
            cur.execute("""
                INSERT INTO import_runs (station_count, segment_count, source_name)
                VALUES (%s, %s, %s)
            """, (len(stations), len(segments), source_name))
    print(f"Import committed: {len(stations)} operational points, {len(segments)} segments")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Import Infrabel railway graph")
    parser.add_argument("--stations-json", type=Path)
    parser.add_argument("--segments-json", type=Path)
    args = parser.parse_args(argv)
    if bool(args.stations_json) != bool(args.segments_json):
        parser.error("Use both --stations-json and --segments-json, or neither")
    if args.stations_json:
        ops, edges = _load(args.stations_json), _load(args.segments_json)
        source_name = "provided local JSON files"
    else:
        ops, edges = fetch_dataset(OP), fetch_dataset(ST)
        source_name = f"Infrabel Open Data ({OP}, {ST})"
    stations, segments = prepare(ops, edges)
    print(f"Validated: {len(stations)} stations, {len(segments)} segments")
    write_snapshot(stations, segments, source_name)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"IMPORT FAILED (database unchanged if transaction was started): {exc}", file=sys.stderr)
        sys.exit(1)
