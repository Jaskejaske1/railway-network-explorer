from app.rail_geometry import project_journeys, assign_nodes


def node(ident, name, lon, lat):
    return {'id':ident, 'name_nl':name, 'name_fr':None, 'operational_name':None,
            'lon':lon,'lat':lat}


def test_alias_match_returns_infrabel_network_lines():
    stops = {'G1': {'name':'Louvain','lon':4.715,'lat':50.882},
             'G2': {'name':'Malines','lon':4.500,'lat':51.020}}
    stations = [node('A','Leuven',4.715,50.882), node('B','Mechelen',4.500,51.020)]
    segments = [{'id':'R1', 'from_id':'A','to_id':'B','distance_km':25,
                 'geometry':{'type':'LineString','coordinates':[[4.715,50.882],[4.60,50.94],[4.500,51.020]]}}]
    routes = [{'legs':[{'trip_id':'IC','stop_ids':['G1','G2']}]}]
    result = project_journeys(routes,stops,stations,segments,{'G1':['Leuven'],'G2':['Mechelen']})[0]
    features = result['geometry']['features']
    assert len(features)==1
    assert features[0]['properties']['geometry_source']=='infrabel_estimate'
    assert len(features[0]['geometry']['coordinates'])==3
    assert result['geometry_quality']['schematic_fallbacks']==0


def test_unmatched_connection_is_dashed_fallback_not_invented_track():
    stops={'G1': {'name':'A','lon':4.0,'lat':50.0}, 'G2': {'name':'B','lon':5.0,'lat':51.0}}
    routes=[{'legs':[{'trip_id':'S1','stop_ids':['G1','G2']}]}]
    result=project_journeys(routes,stops,[],[],{})[0]
    assert result['geometry']['features'][0]['properties']['geometry_source']=='schematic_fallback'
    assert result['geometry_quality']['schematic_fallbacks']==1


def test_same_name_far_away_not_matched():
    assert assign_nodes({'G':{'name':'Leuven','lon':4.7,'lat':50.88}},
        [node('wrong','Leuven',5.2,51.1)], {})=={}
