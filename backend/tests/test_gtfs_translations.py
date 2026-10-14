"""Multilingual station mapping without touching the timetable IDs."""
import pytest
from app.gtfs_translations import (get_station_code, parse_irail, close_enough,
                                   build_translations, fetch_language)
from app import main


def test_station_id_conversion_only_accepts_canonical_gtfs_station():
    assert get_station_code('gs:nmbssncb:S8833001') == '8833001'
    assert get_station_code('gs:nmbssncb:S8811676') == '8811676'
    assert get_station_code('random-S8833001') is None
    assert get_station_code('gs:nmbssncb:S8833001:platform2') is None


def test_irail_station_parsing():
    rows = parse_irail({'station': [
        {'id': 'BE.NMBS.008833001', 'name': 'Leuven', 'locationY': 50.88228, 'locationX': 4.71586},
        {'id': 'BAD', 'name': 'Wrong', 'locationY': 50, 'locationX': 4},
    ]})
    assert rows == [{'code':'8833001','name':'Leuven','lat':50.88228,'lon':4.71586}]


def test_four_language_names_share_one_gtfs_station_id():
    stops = [{'stop_id':'gs:nmbssncb:S8833001', 'lat':50.882282, 'lon':4.715868},
             {'stop_id':'gs:nmbssncb:S8811676', 'lat':50.669795, 'lon':4.615746}]
    langs = {'nl':'Leuven','fr':'Louvain','en':'Leuven','de':'Löwen'}
    source = {lang:[{'code':'8833001','name':name,'lat':50.88228,'lon':4.71586}]
              for lang, name in langs.items()}
    out = build_translations(stops, source)
    assert {(a,b,c) for a,b,c,d in out} == {
        ('gs:nmbssncb:S8833001', lang, name) for lang,name in langs.items()}
    # A different station with the same name or far-away coordinates must not match.
    source['fr'].append({'code':'8811676','name':'Louvain','lat':50.88228,'lon':4.71586})
    assert len(build_translations(stops,source)) == 4


def test_reject_unexpected_language_feed():
    class Client:
        def get(self, *_args, **_kwargs):
            return type('Resp', (), {'raise_for_status':lambda _self: None,
                'json':lambda _self:{'station': []}})()
    with pytest.raises(RuntimeError,match='partial update'):
        fetch_language('nl', Client())
    with pytest.raises(ValueError):
        fetch_language('es', Client())


def test_all_language_search_and_display_are_separate(monkeypatch):
    captured={}
    monkeypatch.setattr(main,'ensure_gtfs_schema',lambda:None)
    def fake_rows(sql,params=()):
        captured['sql'], captured['params'] = sql,params
        return [{'id':'gs:nmbssncb:S8833001','name':'Leuven','original_name':'Louvain',
                 'lat':50.882282,'lon':4.715868}]
    monkeypatch.setattr(main,'rows',fake_rows)
    assert main.gtfs_stations('Löwen',10,'nl')[0]['name']=='Leuven'
    assert 'EXISTS (SELECT 1 FROM gtfs_station_translations tr' in captured['sql']
    assert captured['params'] == ('nl','%Löwen%','%Löwen%','%Löwen%','Löwen','Löwen','Löwen',10)
    assert main.gtfs_stations('Leuven',10,'fr')[0]['id']=='gs:nmbssncb:S8833001'
    assert captured['params'][0]=='fr'


def test_diagnostic_works_with_empty_translations(monkeypatch):
    monkeypatch.setattr(main,'ensure_gtfs_schema',lambda:None)
    def fake_rows(sql,params=()):
        if 'AS gtfs_stops' in sql: return [{'gtfs_stops':2950}]
        return []
    monkeypatch.setattr(main,'rows',fake_rows)
    result=main.gtfs_translations_meta()
    assert result['languages']=={}
    assert set(result['supported_languages']) == {'nl','fr','en','de'}
    assert result['gtfs_stops']==2950
