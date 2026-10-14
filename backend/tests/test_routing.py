from app.routing import build_graph, k_paths, summarize_path


def test_k_shortest_and_via():
    edges = [
        {"id": "ab", "from_id": "a", "to_id": "b", "distance_km": 1},
        {"id": "bd", "from_id": "b", "to_id": "d", "distance_km": 1},
        {"id": "ac", "from_id": "a", "to_id": "c", "distance_km": 2},
        {"id": "cd", "from_id": "c", "to_id": "d", "distance_km": 2},
    ]
    g = build_graph(edges)
    paths = k_paths(g,"a","d",count=3)
    assert paths == [["a","b","d"], ["a","c","d"]]
    assert summarize_path(g,paths[0])["distance_km"] == 2
    assert k_paths(g,"a","d",via="c") == [["a","c","d"]]
    assert k_paths(g,"a","d",via="a") == [["a","b","d"]]


def test_disconnected():
    g = build_graph([{"id":"ab","from_id":"a","to_id":"b","distance_km":1},
                     {"id":"cd","from_id":"c","to_id":"d","distance_km":1}])
    assert k_paths(g,"a","d") == []
