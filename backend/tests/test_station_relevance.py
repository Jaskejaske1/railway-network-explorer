from app import main


def test_station_prefix_relevance_prioritises_major_served_stations(monkeypatch):
    seen = {}

    monkeypatch.setattr(main, 'ensure_gtfs_schema', lambda: None)

    def fake_rows(query, params=()):
        seen['query'] = query
        seen['params'] = params
        return []

    monkeypatch.setattr(main, 'rows', fake_rows)
    assert main.gtfs_stations(search='leu') == []
    assert 'gtfs_connections popular' in seen['query']
    assert 'ILIKE %s OR s.name ILIKE %s' in seen['query']
    assert len(seen['params']) == 10
    assert seen['params'][-3:] == ('leu%', 'leu%', 15)
