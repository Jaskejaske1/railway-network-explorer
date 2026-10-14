"""Regression test for atomic replacement of FK-related tables."""
from unittest.mock import MagicMock

from app import importer


def test_snapshot_truncates_related_tables_in_one_statement(monkeypatch):
    connection = MagicMock()
    connection.__enter__.return_value = connection
    cursor = MagicMock()
    cursor.__enter__.return_value = cursor
    connection.cursor.return_value = cursor

    monkeypatch.setattr(importer, "ensure_schema", lambda: None)
    monkeypatch.setattr(importer, "connect", lambda: connection)

    stations = [{
        "id": "1", "name_nl": "Station A", "name_fr": None,
        "operational_name": "A", "classification": "Station",
        "taf_tap_code": None, "point": (4.4, 50.9)
    }]
    segments = [{
        "id": "seg1", "from_id": "1", "to_id": "2", "distance_km": 1.5,
        "geometry": {"type": "LineString", "coordinates": [[4.4, 50.9], [4.5, 50.9]]}
    }]

    importer.write_snapshot(stations, segments, "test fixture")

    statements = [call.args[0] for call in cursor.execute.call_args_list]
    truncates = [statement for statement in statements if statement.strip().upper().startswith("TRUNCATE")]
    assert truncates == ["TRUNCATE TABLE rail_segments, stations"]
    assert all("CASCADE" not in statement.upper() for statement in truncates)
    assert cursor.executemany.call_count == 2
    assert any("INSERT INTO import_runs" in statement for statement in statements)
