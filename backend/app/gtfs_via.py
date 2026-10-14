"""Find a *scheduled* itinerary where a change of trip occurs at the VIA station."""
from .gtfs_routing import find_earliest, MIN_TRANSFER_SECONDS


def via_transfer(connections, origin, destination, departure, via_id,
                 max_boardings=3, buffer_seconds=MIN_TRANSFER_SECONDS):
    if via_id in (origin, destination):
        return None
    prefix = find_earliest(connections, origin, via_id, departure,
                           max_boardings=max_boardings - 1, transfer_seconds=buffer_seconds)
    if not prefix:
        return None
    remaining = max_boardings - len(prefix)
    if remaining < 1:
        return None
    next_departure = prefix[-1]['arrival_s'] + buffer_seconds
    # Avoid continuing the same trip and mistakenly calling it a transfer.
    for _ in range(8):
        suffix = find_earliest(connections, via_id, destination, next_departure,
                               max_boardings=remaining, transfer_seconds=buffer_seconds)
        if not suffix:
            return None
        if suffix[0]['trip_id'] != prefix[-1]['trip_id']:
            return prefix + suffix
        next_departure = suffix[0]['departure_s'] + 60
    return None
