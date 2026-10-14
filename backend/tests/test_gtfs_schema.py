"""Check that both canonical connection endpoints can use an index."""
from app.gtfs_db import GTFS_SCHEMA


def test_connection_station_lookups_are_indexed():
    assert 'idx_gtfs_connections_from' in GTFS_SCHEMA
    assert 'idx_gtfs_connections_to' in GTFS_SCHEMA


def test_alias_cache_does_not_foreign_key_old_gtfs_rows():
    assert 'CREATE TABLE IF NOT EXISTS gtfs_station_labels' in GTFS_SCHEMA
    # Re-import still truncates the seven GTFS tables independently.
    assert 'REFERENCES gtfs_stops' not in GTFS_SCHEMA.split('CREATE TABLE IF NOT EXISTS gtfs_station_labels')[1].split('CREATE INDEX')[0]


def test_alias_builder_requires_geographic_name_consistency():
    from app.gtfs_labels import REFRESH_SQL
    assert 'LOWER(i.name_fr)=LOWER(g.name)' in REFRESH_SQL
    assert 'picked.name_match OR picked.distance_m <= 75' in REFRESH_SQL
    assert 'ST_DWithin' in REFRESH_SQL


def test_multilingual_cache_keeps_canonical_stop_ids_without_foreign_keys():
    assert 'CREATE TABLE IF NOT EXISTS gtfs_station_translations' in GTFS_SCHEMA
    block=GTFS_SCHEMA.split('CREATE TABLE IF NOT EXISTS gtfs_station_translations')[1].split('CREATE INDEX')[0]
    assert 'stop_id TEXT NOT NULL' in block
    assert 'PRIMARY KEY (stop_id, language)' in block
    assert 'REFERENCES gtfs_stops' not in block
