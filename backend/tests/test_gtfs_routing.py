"""Regression cases for one-train stays, interchanges and GTFS time offsets."""
from app.gtfs_importer import seconds
from app.gtfs_routing import find_earliest, clock


def c(trip, a, b, dep, arr, pickup=0, dropoff=0, route='IC'):
    return dict(trip_id=trip, from_stop_id=a, to_stop_id=b, departure_s=dep,
                arrival_s=arr, pickup_type=pickup, drop_off_type=dropoff,
                headsign='Antwerpen-Centraal', route_name=route)


def test_through_train_is_not_transfer():
    trips = [c('T1','LEUVEN','HEVER',8*3600,8*3600+600),
             c('T1','HEVER','MECHELEN',8*3600+660,8*3600+1200),
             c('T1','MECHELEN','SKW',8*3600+1260,8*3600+1500)]
    trip=find_earliest(trips,'LEUVEN','SKW',8*3600)
    assert len(trip) == 1
    assert trip[0]['stop_ids'] == ['LEUVEN','HEVER','MECHELEN','SKW']


def test_real_transfer_only_when_buffer_met():
    first=c('T1','LEUVEN','BORDET',8*3600,8*3600+1200)
    too_fast=c('T2','BORDET','WEERDE',8*3600+1300,8*3600+1800)
    okay=c('T3','BORDET','WEERDE',8*3600+1500,8*3600+2200)
    trip=find_earliest([first,too_fast,okay],'LEUVEN','WEERDE',8*3600)
    assert [leg['trip_id'] for leg in trip] == ['T1','T3']


def test_pickup_and_dropoff_restrictions():
    ride=[c('T','A','B',8*3600,8*3600+300,dropoff=1),
          c('T','B','C',8*3600+360,8*3600+600)]
    assert find_earliest(ride,'A','B',8*3600) is None
    assert find_earliest(ride,'A','C',8*3600)[0]['to_id']=='C'


def test_travel_time_service_day_over_24h():
    assert seconds('25:12:06') == 90726
    assert clock(90726) == '25:12'


def test_invalid_time():
    import pytest
    with pytest.raises(ValueError):
        seconds('09:67:00')


def test_earlier_stop_is_frozen_when_train_continues():
    c1=c('T','A','B',8*3600,8*3600+600)
    c2=c('T','B','C',8*3600+660,8*3600+960)
    c3=c('U','B','D',8*3600+1000,8*3600+1300)
    trip=find_earliest([c1,c2,c3],'A','D',8*3600)
    assert [leg['stop_ids'] for leg in trip]==[['A','B'],['B','D']]


def test_previous_service_day_after_midnight():
    from datetime import date, timedelta
    from app.gtfs_routing import active_connections

    class Cursor:
        def __init__(self, owner): self.owner = owner
        def __enter__(self): return self
        def __exit__(self, *_): return False
        def execute(self, sql, params): self.owner.calls.append(params)
        def fetchall(self):
            date_arg = self.owner.calls[-1][2]
            if date_arg == date(2026, 10, 13):
                return [c('NIGHT','A','B',24*3600+1200,24*3600+2400)]
            return [c('TODAY','A','C',1800,3000)]

    class Conn:
        calls=[]
        def cursor(self, **kw): return Cursor(self)

    conn=Conn()
    results=active_connections(conn,date(2026,10,14),600)
    assert [c['trip_id'] for c in results]==['NIGHT@previous-day','TODAY']
    assert results[0]['departure_s']==1200
    assert results[0]['arrival_s']==2400
    assert len(conn.calls)==2
    assert conn.calls[1][2]==date(2026,10,13)


def test_previous_day_service_not_loaded_at_noon():
    from datetime import date
    from app.gtfs_routing import active_connections

    class Conn:
        called=0
        def cursor(self, **kwargs): return self
        def __enter__(self): return self
        def __exit__(self, *args): return False
        def execute(self, *args): self.called+=1
        def fetchall(self): return []

    conn=Conn()
    assert active_connections(conn,date(2026,10,14),12*3600)==[]
    assert conn.called==1
