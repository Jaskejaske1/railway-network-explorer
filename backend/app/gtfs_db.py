"""Isolated GTFS schedule schema; never mutates Infrabel infrastructure tables."""
from .db import connect

GTFS_SCHEMA = """
CREATE TABLE IF NOT EXISTS gtfs_stops (
  stop_id TEXT PRIMARY KEY, name TEXT NOT NULL, lat DOUBLE PRECISION,
  lon DOUBLE PRECISION, parent_station TEXT
);
CREATE TABLE IF NOT EXISTS gtfs_routes (
  route_id TEXT PRIMARY KEY, short_name TEXT, long_name TEXT, route_type INTEGER
);
CREATE TABLE IF NOT EXISTS gtfs_trips (
  trip_id TEXT PRIMARY KEY, route_id TEXT NOT NULL REFERENCES gtfs_routes(route_id),
  service_id TEXT NOT NULL, headsign TEXT
);
CREATE TABLE IF NOT EXISTS gtfs_calendar (
  service_id TEXT PRIMARY KEY, start_date DATE NOT NULL, end_date DATE NOT NULL,
  monday BOOLEAN NOT NULL, tuesday BOOLEAN NOT NULL, wednesday BOOLEAN NOT NULL,
  thursday BOOLEAN NOT NULL, friday BOOLEAN NOT NULL, saturday BOOLEAN NOT NULL,
  sunday BOOLEAN NOT NULL
);
CREATE TABLE IF NOT EXISTS gtfs_calendar_dates (
  service_id TEXT NOT NULL, date DATE NOT NULL, exception_type INTEGER NOT NULL,
  PRIMARY KEY (service_id, date)
);
CREATE TABLE IF NOT EXISTS gtfs_stop_times (
  trip_id TEXT NOT NULL REFERENCES gtfs_trips(trip_id),
  stop_sequence INTEGER NOT NULL, stop_id TEXT NOT NULL REFERENCES gtfs_stops(stop_id),
  arrival_s INTEGER, departure_s INTEGER, pickup_type INTEGER NOT NULL DEFAULT 0,
  drop_off_type INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (trip_id, stop_sequence)
);
CREATE TABLE IF NOT EXISTS gtfs_connections (
  trip_id TEXT NOT NULL REFERENCES gtfs_trips(trip_id),
  stop_sequence INTEGER NOT NULL,
  from_stop_id TEXT NOT NULL, to_stop_id TEXT NOT NULL,
  departure_s INTEGER NOT NULL, arrival_s INTEGER NOT NULL,
  pickup_type INTEGER NOT NULL, drop_off_type INTEGER NOT NULL,
  PRIMARY KEY (trip_id, stop_sequence)
);
CREATE TABLE IF NOT EXISTS gtfs_import_runs (
  id BIGSERIAL PRIMARY KEY, imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_name TEXT NOT NULL, stop_count INTEGER NOT NULL, trip_count INTEGER NOT NULL,
  connection_count INTEGER NOT NULL,
  start_date DATE, end_date DATE
);
CREATE INDEX IF NOT EXISTS idx_gtfs_stops_name ON gtfs_stops(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_gtfs_connections_departure ON gtfs_connections(departure_s);
CREATE INDEX IF NOT EXISTS idx_gtfs_connections_from ON gtfs_connections(from_stop_id, departure_s);
CREATE INDEX IF NOT EXISTS idx_gtfs_trip_service ON gtfs_trips(service_id);
"""


def ensure_gtfs_schema():
    with connect() as conn:
        conn.execute(GTFS_SCHEMA)
