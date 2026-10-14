"""Database connection and schema, including spatial and relational constraints."""
import os
import psycopg

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://railway:railway_dev_password@localhost:5433/railway"
)

SCHEMA = """
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS stations (
    infrabel_id TEXT PRIMARY KEY,
    name_nl TEXT NOT NULL,
    name_fr TEXT,
    operational_name TEXT,
    classification TEXT,
    taf_tap_code TEXT,
    geom geometry(Point, 4326)
);

CREATE TABLE IF NOT EXISTS rail_segments (
    id TEXT PRIMARY KEY,
    from_station_id TEXT NOT NULL REFERENCES stations(infrabel_id),
    to_station_id TEXT NOT NULL REFERENCES stations(infrabel_id),
    distance_km DOUBLE PRECISION NOT NULL CHECK (distance_km > 0),
    geom geometry(LineString, 4326) NOT NULL,
    CONSTRAINT different_stations CHECK (from_station_id <> to_station_id)
);
CREATE INDEX IF NOT EXISTS idx_station_geom ON stations USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_segment_geom ON rail_segments USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_segment_from ON rail_segments (from_station_id);
CREATE INDEX IF NOT EXISTS idx_segment_to ON rail_segments (to_station_id);
CREATE INDEX IF NOT EXISTS idx_station_name ON stations (LOWER(name_nl));

CREATE TABLE IF NOT EXISTS import_runs (
    id BIGSERIAL PRIMARY KEY,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    station_count INTEGER NOT NULL,
    segment_count INTEGER NOT NULL,
    source_name TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT ''
);
"""


def connect():
    return psycopg.connect(DATABASE_URL)


def ensure_schema():
    with connect() as conn:
        conn.execute(SCHEMA)
