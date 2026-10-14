"""Undirected, infrastructure-only distance-based paths (NOT scheduled train journeys)."""
import networkx as nx


def build_graph(segments):
    graph = nx.Graph()
    for edge in segments:
        start, end = edge["from_id"], edge["to_id"]
        length = float(edge["distance_km"])
        if graph.has_edge(start, end) and graph[start][end]["weight"] <= length:
            continue
        graph.add_edge(start, end, weight=length, segment_id=edge["id"])
    return graph


def k_paths(graph, start, destination, count=3, via=None):
    """Same semantics as calculate_paths, without losing partial k-path results."""
    if start not in graph or destination not in graph:
        raise ValueError("Vertrek- of aankomststation ontbreekt in de graaf")
    if via is not None and via not in graph:
        raise ValueError("Tussenstation ontbreekt in de graaf")
    try:
        if via:
            return [nx.shortest_path(graph, start, via, weight="weight")[:-1]
                    + nx.shortest_path(graph, via, destination, weight="weight")]
        if start == destination:
            return [[start]]
        from itertools import islice
        return list(islice(nx.shortest_simple_paths(graph, start, destination, weight="weight"), count))
    except nx.NetworkXNoPath:
        return []


def summarize_path(graph, path):
    segment_ids = [graph[a][b]["segment_id"] for a, b in zip(path, path[1:])]
    distance_km = sum(graph[a][b]["weight"] for a, b in zip(path, path[1:]))
    return {
        "station_ids": path,
        "segment_ids": segment_ids,
        "distance_km": round(distance_km, 2),
        "repeats_stations": len(path) != len(set(path)),
    }
