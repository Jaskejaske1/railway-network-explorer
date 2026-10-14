from app.gtfs_via import via_transfer
from test_gtfs_routing import c


def test_actual_change_at_bordet():
    connections=[c('IC','LEUVEN','BORDET',28800,30000),
                 c('S','BORDET','WEERDE',30300,31800),
                 c('OTHER','LEUVEN','MECHELEN',28800,29800),
                 c('OTHER2','MECHELEN','WEERDE',30100,30800)]
    result=via_transfer(connections,'LEUVEN','WEERDE',28800,'BORDET')
    assert [leg['trip_id'] for leg in result]==['IC','S']
    assert result[1]['from_id']=='BORDET'


def test_no_transfer_does_not_masquerade_as_interchange():
    connections=[c('IC','LEUVEN','BORDET',28800,30000),
                 c('IC','BORDET','WEERDE',30100,31800)]
    assert via_transfer(connections,'LEUVEN','WEERDE',28800,'BORDET') is None
