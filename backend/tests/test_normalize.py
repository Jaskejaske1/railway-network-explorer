import pytest
from app.normalize import normalize_segment, normalize_station
from app.normalize import prepare


def test_official_api_shape():
    s = normalize_station({"ptcarid": "7", "commerciallongnamedutch": "Aalst-Oost",
                           "longnamedutch": "AALST-OOST",
                           "geo_point_2d": {"lat": 50.9365, "lon": 4.0490}})
    assert s["id"] == "7"
    assert s["point"] == (4.0490, 50.9365)
    e = normalize_segment({"stationfrom_id": "7", "stationto_id": "8",
        "stationfrom_name": "A", "stationto_name": "B", "length": 1.5,
        "geo_shape": {"type": "Feature", "geometry": {"type": "LineString",
                      "coordinates": [[4.0, 50.9], [4.1, 51.0]]}, "properties": {}}})
    assert e["distance_km"] == 1.5
    assert e["geometry"]["coordinates"][0] == [4.0, 50.9]


def test_invalid_geometry_rejected():
    with pytest.raises(ValueError):
        normalize_segment({"stationfrom_id": "a", "stationto_id": "b", "length": 1,
                           "geo_shape": {"type": "Point", "coordinates": [4, 50]}})


def test_fallback_endpoints():
    points = [{"ptcarid": "1", "longnamedutch": "A", "geo_point_2d": {"lon": 4, "lat": 50}}]
    def seg(a,b):
        return {"stationfrom_id": str(a), "stationto_id": str(b), "length": 1,
                "geo_shape": {"type": "LineString", "coordinates": [[4+a*.01, 50], [4+b*.01, 50]]}}
    stations, segments = prepare(points, [seg(1,2), seg(2,3), seg(3,4), seg(4,5)])
    assert len(stations) == 5 and len(segments) == 4
