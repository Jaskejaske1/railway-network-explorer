"""Build Dutch display-name aliases for GTFS stations from Infrabel open data.

NMBS GTFS publishes French stop names. This auxiliary table allows searching
'Dutch' and 'French' names with the SAME GTFS IDs; no timetable reload needed.

Run after both importers:
    python -m app.gtfs_labels

Matches are conservative: same French/Dutch station name <= 1.2 km,
or a very close (< 75 m) coordinate match. Weak matches are not invented.
"""
from .db import connect, ensure_schema
from .gtfs_db import ensure_gtfs_schema

# Only use the closest Infrabel operational point per GTFS stop. A name match
# must also be geographically plausible; merely matching the name is unsafe.
REFRESH_SQL = """
INSERT INTO gtfs_station_labels (stop_id, name_nl, infrabel_id, distance_m, match_method)
SELECT g.stop_id, picked.name_nl, picked.infrabel_id,
       picked.distance_m,
       CASE WHEN picked.name_match THEN 'name_and_location' ELSE 'very_close_location' END
FROM gtfs_stops g
CROSS JOIN LATERAL (
    SELECT i.infrabel_id, i.name_nl,
           ST_Distance(i.geom::geography,
                       ST_SetSRID(ST_MakePoint(g.lon,g.lat),4326)::geography) AS distance_m,
           (LOWER(i.name_fr)=LOWER(g.name)
            OR LOWER(i.name_nl)=LOWER(g.name)) AS name_match
    FROM stations i
    WHERE i.geom IS NOT NULL AND i.name_nl IS NOT NULL
      AND ST_DWithin(i.geom::geography,
                     ST_SetSRID(ST_MakePoint(g.lon,g.lat),4326)::geography, 1200)
    ORDER BY
      CASE WHEN LOWER(i.name_fr)=LOWER(g.name)
             OR LOWER(i.name_nl)=LOWER(g.name) THEN 0 ELSE 1 END,
      ST_Distance(i.geom::geography,
                  ST_SetSRID(ST_MakePoint(g.lon,g.lat),4326)::geography),
      i.infrabel_id
    LIMIT 1
) picked
WHERE g.lat BETWEEN -90 AND 90 AND g.lon BETWEEN -180 AND 180
  AND (picked.name_match OR picked.distance_m <= 75)
  AND picked.name_nl <> ''
"""


def refresh_labels():
    ensure_schema()
    ensure_gtfs_schema()
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT count(*) FROM gtfs_stops')
            stop_count = cur.fetchone()[0]
            cur.execute('SELECT count(*) FROM stations WHERE geom IS NOT NULL')
            point_count = cur.fetchone()[0]
            if not stop_count or not point_count:
                raise RuntimeError('Importeer eerst de NMBS GTFS-data en Infrabel-punten')
            # Rebuild in one transaction: rollback leaves the previous labels.
            cur.execute('DELETE FROM gtfs_station_labels')
            cur.execute(REFRESH_SQL)
            cur.execute('SELECT count(*) FROM gtfs_station_labels')
            alias_count = cur.fetchone()[0]
            cur.execute("""
                SELECT l.name_nl, s.name AS gtfs_name, l.match_method,
                       ROUND(l.distance_m::numeric) AS distance_m
                FROM gtfs_station_labels l
                JOIN gtfs_stops s ON s.stop_id = l.stop_id
                WHERE l.name_nl ILIKE '%Leuven%' OR s.name ILIKE '%Louvain%'
                ORDER BY l.distance_m LIMIT 10
            """)
            examples = cur.fetchall()
    print(f'GTFS Dutch-name mapping committed: {alias_count}/{stop_count} stops mapped')
    print('Leuven/Louvain matches:', examples or '(geen; inspecteer stationscoördinaten)')
    return alias_count


if __name__ == '__main__':
    refresh_labels()
