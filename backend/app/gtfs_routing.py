"""Scheduled connection-scan router for NMBS GTFS static data.

A leg is exactly one GTFS trip_id. A change of trip_id is a transfer.
No walking transfers, real-time updates or ticket validity are inferred.
"""
from datetime import date as Date

from psycopg.rows import dict_row
from .db import connect

MIN_TRANSFER_SECONDS = 180
SEARCH_SECONDS = 6 * 3600
WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")


def active_connections(conn, service_date, departure_s):
    weekday = WEEKDAYS[service_date.weekday()]
    with conn.cursor(row_factory=dict_row) as cur:
        # Filter services via the calendar, including added/removed exceptions.
        cur.execute(f"""
          SELECT c.trip_id, c.from_stop_id, c.to_stop_id, c.departure_s,
                 c.arrival_s, c.pickup_type, c.drop_off_type,
                 t.headsign, r.short_name AS route_name
          FROM gtfs_connections c
          JOIN gtfs_trips t ON t.trip_id=c.trip_id
          JOIN gtfs_routes r ON r.route_id=t.route_id
          WHERE c.departure_s BETWEEN %s AND %s
            AND (
              (EXISTS (SELECT 1 FROM gtfs_calendar ca WHERE ca.service_id=t.service_id
                       AND %s BETWEEN ca.start_date AND ca.end_date AND ca.{weekday})
                AND NOT EXISTS (SELECT 1 FROM gtfs_calendar_dates cd
                                WHERE cd.service_id=t.service_id AND cd.date=%s AND cd.exception_type=2))
              OR EXISTS (SELECT 1 FROM gtfs_calendar_dates cd
                         WHERE cd.service_id=t.service_id AND cd.date=%s AND cd.exception_type=1)
            )
          ORDER BY c.departure_s, c.trip_id
        """, (departure_s, departure_s + SEARCH_SECONDS, service_date, service_date, service_date))
        return cur.fetchall()


def find_earliest(connections, origin, destination, earliest_departure, max_boardings=3,
                  transfer_seconds=MIN_TRANSFER_SECONDS):
    """Up to max_boardings trains; return earliest-arrival itinerary.

    Each round boards one additional service. The state of a train extends
    across intermediate stops, while changes of trip require >= transfer buffer.
    """
    if origin == destination:
        return None
    previous = {origin: (earliest_departure, [])}
    winners = []
    for _ in range(max_boardings):
        onboard = {}
        new_best = {}
        for c in connections:
            departure, arrival = c['departure_s'], c['arrival_s']
            a, b, trip = c['from_stop_id'], c['to_stop_id'], c['trip_id']
            origin_state = previous.get(a)
            if c['pickup_type'] != 1 and origin_state:
                reached_at, prefix = origin_state
                buffer_s = transfer_seconds if prefix else 0
                if reached_at + buffer_s <= departure and (not prefix or prefix[-1]['trip_id'] != trip):
                    if trip not in onboard:
                        onboard[trip] = (a, reached_at, prefix)
            board = onboard.get(trip)
            if not board or board[0] != a or arrival < departure:
                continue
            prefix = board[2]
            if prefix and prefix[-1]['trip_id'] == trip:
                continue
            if len(board) == 3:
                leg = {'trip_id': trip, 'route': c['route_name'], 'headsign': c['headsign'],
                       'from_id': a, 'to_id': b, 'departure_s': departure,
                       'arrival_s': arrival, 'stop_ids': [a, b]}
            else:
                leg = dict(board[3])
                leg['to_id'] = b
                leg['arrival_s'] = arrival
                leg['stop_ids'] = [*leg['stop_ids'], b]
            onboard[trip] = (b, arrival, prefix, leg)
            if c['drop_off_type'] == 1:
                continue
            # Freeze the through-train at every intermediate arrival. Otherwise
            # a later stop would mutate an earlier transfer opportunity.
            itinerary = [*prefix, {**leg, 'stop_ids': list(leg['stop_ids'])}]
            if b not in new_best or arrival < new_best[b][0]:
                new_best[b] = (arrival, itinerary)
        result = new_best.get(destination)
        if result:
            winners.append(result)
        previous = new_best
    if not winners:
        return None
    return min(winners, key=lambda item: (item[0], len(item[1])))[1]


def clock(seconds):
    return f"{seconds // 3600:02d}:{(seconds // 60) % 60:02d}"


def timetable_routes(from_id, to_id, service_date: Date, from_time: str, alternatives=4):
    try:
        h, m = map(int, from_time.split(':'))
    except (ValueError, AttributeError) as exc:
        raise ValueError('Time must be HH:MM') from exc
    if not (0 <= h <= 23 and 0 <= m <= 59):
        raise ValueError('Time must be HH:MM')
    start = h * 3600 + m * 60
    with connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('SELECT stop_id, name, lat, lon FROM gtfs_stops')
            stops = {s['stop_id']: s for s in cur.fetchall()}
        if from_id not in stops or to_id not in stops:
            raise LookupError('Unknown GTFS station ID')
        connections = active_connections(conn, service_date, start)
    if not connections:
        return []
    found = {}
    # Profile sample: distinct actual departures, not variants of the same track.
    for delta in range(0, 121, 10):
        path = find_earliest(connections, from_id, to_id, start + delta * 60)
        if not path:
            continue
        signature = tuple((leg['trip_id'], leg['departure_s']) for leg in path)
        if signature not in found:
            found[signature] = path
        if len(found) >= alternatives * 3:
            break
    result = []
    for path in sorted(found.values(), key=lambda p: (p[-1]['arrival_s'], p[0]['departure_s']))[:alternatives]:
        legs = []
        features = []
        for leg in path:
            names = [stops[i]['name'] for i in leg['stop_ids'] if i in stops]
            legs.append({**leg,
                         'from_name': stops[leg['from_id']]['name'],
                         'to_name': stops[leg['to_id']]['name'],
                         'departure': clock(leg['departure_s']),
                         'arrival': clock(leg['arrival_s']),
                         'stop_names': names})
            coords = [[stops[i]['lon'], stops[i]['lat']] for i in leg['stop_ids']
                      if i in stops and stops[i]['lon'] is not None and stops[i]['lat'] is not None]
            if len(coords) >= 2:
                features.append({'type': 'Feature', 'geometry': {'type': 'LineString', 'coordinates': coords},
                                 'properties': {'trip_id': leg['trip_id']}})
        result.append({'departure': clock(path[0]['departure_s']),
                       'arrival': clock(path[-1]['arrival_s']),
                       'transfer_count': len(path) - 1,
                       'transfer_stations': [stops[l['from_id']]['name'] for l in path[1:]],
                       'legs': legs,
                       'geometry': {'type': 'FeatureCollection', 'features': features}})
    return result
