"""Import GTFS Static ZIP atomically. Feed supplied by file or Belgian Mobility URL.

  docker compose exec api python -m app.gtfs_importer --file /data/nmbs.zip
  docker compose exec api python -m app.gtfs_importer --url https://.../nmbssncb/static

Never commit API keys: set GTFS_API_KEY as environment variable (optional).
"""
import argparse
import csv
import io
import os
import zipfile
from datetime import datetime
from pathlib import Path

import httpx
from .db import connect
from .gtfs_db import ensure_gtfs_schema

DEFAULT_URL = "https://opendata-discovery-gtfs-static.api.production.belgianmobility.io/api/gtfs/feed/nmbssncb/static"
REQUIRED = {"stops.txt", "routes.txt", "trips.txt", "stop_times.txt"}
TABLES = "gtfs_connections, gtfs_stop_times, gtfs_trips, gtfs_routes, gtfs_stops, gtfs_calendar_dates, gtfs_calendar"


def seconds(value):
    """GTFS hours can be >= 24; retain service-day offsets."""
    if not value:
        return None
    parts = value.split(":")
    if len(parts) != 3 or any(not p.isdigit() for p in parts):
        raise ValueError(f"Invalid GTFS time: {value!r}")
    h, m, s = map(int, parts)
    if m >= 60 or s >= 60:
        raise ValueError(f"Invalid GTFS time: {value!r}")
    return h * 3600 + m * 60 + s


def gtfs_date(value):
    return datetime.strptime(value, "%Y%m%d").date()


def csv_rows(archive, name):
    if name not in archive.namelist():
        return
    with archive.open(name) as stream:
        with io.TextIOWrapper(stream, encoding="utf-8-sig", newline="") as source:
            yield from csv.DictReader(source)


def blank(value):
    return value if value != "" else None


def import_zip(path, source_name):
    with zipfile.ZipFile(path) as z:
        missing = REQUIRED - set(z.namelist())
        if missing:
            raise ValueError(f"GTFS ZIP missing: {', '.join(sorted(missing))}")
        if "calendar.txt" not in z.namelist() and "calendar_dates.txt" not in z.namelist():
            raise ValueError("GTFS ZIP needs calendar.txt or calendar_dates.txt")
        # Avoid accidental extraction/processing of pathological ZIP archives.
        if sum(f.file_size for f in z.infolist()) > 1_500_000_000:
            raise ValueError("Uncompressed GTFS data exceeds 1.5 GB")
        ensure_gtfs_schema()
        with connect() as conn:
            with conn.cursor() as cur:
                # A single transaction: a failed import preserves the last working snapshot.
                cur.execute(f"TRUNCATE TABLE {TABLES}")
                # Cached labels refer to the old GTFS stop IDs and must be
                # refreshed explicitly after a future GTFS re-import.
                cur.execute("DELETE FROM gtfs_station_labels")
                cur.execute("DELETE FROM gtfs_station_translations")
                counts = {}

                def load(name, table, columns, converter):
                    count = 0
                    with cur.copy(f"COPY {table} ({', '.join(columns)}) FROM STDIN") as copy:
                        for rec in csv_rows(z, name):
                            copy.write_row(converter(rec))
                            count += 1
                    counts[table] = count
                    print(f"{name}: {count} rows", flush=True)

                load("stops.txt", "gtfs_stops", ("stop_id", "name", "lat", "lon", "parent_station"),
                     lambda r: (r["stop_id"], r["stop_name"], blank(r.get("stop_lat", "")),
                                blank(r.get("stop_lon", "")), blank(r.get("parent_station", ""))))
                load("routes.txt", "gtfs_routes", ("route_id", "short_name", "long_name", "route_type"),
                     lambda r: (r["route_id"], blank(r.get("route_short_name", "")),
                                blank(r.get("route_long_name", "")), int(r.get("route_type") or 2)))
                load("trips.txt", "gtfs_trips", ("trip_id", "route_id", "service_id", "headsign"),
                     lambda r: (r["trip_id"], r["route_id"], r["service_id"], blank(r.get("trip_headsign", ""))))
                load("calendar.txt", "gtfs_calendar", ("service_id", "start_date", "end_date", "monday", "tuesday",
                     "wednesday", "thursday", "friday", "saturday", "sunday"),
                     lambda r: (r["service_id"], gtfs_date(r["start_date"]), gtfs_date(r["end_date"]),
                                *(r[day] == "1" for day in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"))))
                load("calendar_dates.txt", "gtfs_calendar_dates", ("service_id", "date", "exception_type"),
                     lambda r: (r["service_id"], gtfs_date(r["date"]), int(r["exception_type"])))
                load("stop_times.txt", "gtfs_stop_times", ("trip_id", "stop_sequence", "stop_id", "arrival_s",
                     "departure_s", "pickup_type", "drop_off_type"),
                     lambda r: (r["trip_id"], int(r["stop_sequence"]), r["stop_id"],
                                seconds(r.get("arrival_time")), seconds(r.get("departure_time")),
                                int(r.get("pickup_type") or 0), int(r.get("drop_off_type") or 0)))
                # GTFS segments link consecutive *scheduled stops*, not track geometry.
                # Canonicalise platform IDs into station IDs through parent_station.
                cur.execute("""
                    INSERT INTO gtfs_connections (trip_id, stop_sequence, from_stop_id, to_stop_id,
                                                  departure_s, arrival_s, pickup_type, drop_off_type)
                    SELECT trip_id, stop_sequence, from_id, to_id, departure_s, next_arrival,
                           pickup_type, next_drop
                    FROM (
                        SELECT st.trip_id, st.stop_sequence,
                          COALESCE(NULLIF(fs.parent_station, ''), st.stop_id) AS from_id,
                          COALESCE(NULLIF(lead(fs.parent_station) OVER w, ''), lead(st.stop_id) OVER w) AS to_id,
                          st.departure_s, lead(st.arrival_s) OVER w AS next_arrival,
                          st.pickup_type, lead(st.drop_off_type) OVER w AS next_drop
                        FROM gtfs_stop_times st
                        JOIN gtfs_stops fs ON fs.stop_id=st.stop_id
                        WINDOW w AS (PARTITION BY st.trip_id ORDER BY st.stop_sequence)
                    ) consecutive
                    WHERE to_id IS NOT NULL AND next_arrival IS NOT NULL
                      AND departure_s IS NOT NULL AND next_arrival >= departure_s
                      AND from_id <> to_id
                """)
                cur.execute("SELECT count(*) FROM gtfs_connections")
                connection_count = cur.fetchone()[0]
                # Prevent a syntactically valid but empty feed from silently
                # replacing the previous complete schedule.
                if not all(counts.get(table, 0) for table in
                           ('gtfs_stops', 'gtfs_routes', 'gtfs_trips', 'gtfs_stop_times')) or not connection_count:
                    raise ValueError("GTFS feed contains no usable stops, routes, trips or connections")
                cur.execute("""
                    INSERT INTO gtfs_import_runs (source_name, stop_count, trip_count, connection_count,
                                                 start_date, end_date)
                    SELECT %s, %s, %s, %s,
                        (SELECT min(d) FROM (SELECT start_date AS d FROM gtfs_calendar UNION ALL SELECT date FROM gtfs_calendar_dates) dates),
                        (SELECT max(d) FROM (SELECT end_date AS d FROM gtfs_calendar UNION ALL SELECT date FROM gtfs_calendar_dates) dates)
                """, (source_name, counts["gtfs_stops"], counts["gtfs_trips"], connection_count))
            print(f"GTFS committed: {counts['gtfs_stops']} stops, {counts['gtfs_trips']} trips, {connection_count} connections")


def main():
    p = argparse.ArgumentParser()
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument("--file", type=Path, help="GTFS ZIP mounted inside the api container")
    group.add_argument("--url", nargs="?", const=DEFAULT_URL, help="Download GTFS ZIP (optional official URL)")
    args = p.parse_args()
    if args.file:
        import_zip(args.file, f"Local GTFS ZIP: {args.file.name}")
    else:
        headers = {}
        if os.getenv("GTFS_API_KEY"):
            headers["Ocp-Apim-Subscription-Key"] = os.environ["GTFS_API_KEY"]
        with httpx.Client(timeout=120, follow_redirects=True) as client:
            response = client.get(args.url, headers=headers)
            response.raise_for_status()
            content = response.content
        if len(content) > 180_000_000:
            raise ValueError("GTFS ZIP exceeds configured 180 MB limit")
        if content[:2] != b"PK":
            raise ValueError("GTFS endpoint did not return a ZIP; check subscription/access and URL")
        import_zip(io.BytesIO(content), f"Belgian Mobility GTFS: {args.url}")


if __name__ == "__main__":
    main()
