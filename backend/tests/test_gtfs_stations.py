"""API contract: searching uses every available translation, canonical GTFS IDs."""
from app import main


def test_station_search_keeps_gtfs_id_and_uses_all_aliases(monkeypatch):
    seen={}
    monkeypatch.setattr(main,'ensure_gtfs_schema',lambda:None)
    def fake_rows(sql,params=()):
        seen['sql'],seen['params']=sql,params
        return [{'id':'gs:nmbssncb:S8833001','name':'Leuven','original_name':'Louvain',
                 'lat':50.882282,'lon':4.715868}]
    monkeypatch.setattr(main,'rows',fake_rows)
    matches=main.gtfs_stations('Louvain',12,'nl')
    assert matches[0]['name']=='Leuven'
    assert seen['params'][0]=='nl'
    assert 'gtfs_station_translations' in seen['sql']
    assert 'c.from_stop_id=s.stop_id' in seen['sql']
    assert 'c.to_stop_id=s.stop_id' in seen['sql']


def test_search_short_queries_do_not_hit_db(monkeypatch):
    monkeypatch.setattr(main,'ensure_gtfs_schema',lambda:None)
    monkeypatch.setattr(main,'rows',lambda *_: (_ for _ in ()).throw(AssertionError('Unexpected SQL')))
    assert main.gtfs_stations('L',10,'nl')==[]


def test_station_geojson_keeps_same_ids(monkeypatch):
    monkeypatch.setattr(main,'ensure_gtfs_schema',lambda:None)
    monkeypatch.setattr(main,'rows',lambda *_: [
        {'id':'gs:nmbssncb:S8833001','name':'Leuven','original_name':'Louvain',
         'lat':50.882282,'lon':4.715868}
    ])
    point=main.gtfs_station_points('nl')['features'][0]
    assert point['properties']['name']=='Leuven'
    assert point['properties']['id']=='gs:nmbssncb:S8833001'
    assert point['geometry']['coordinates']==[4.715868,50.882282]
