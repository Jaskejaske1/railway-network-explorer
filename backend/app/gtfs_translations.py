"""Load multilingual station names from iRail's four published language feeds.

Matching uses the NMBS 7-digit station identifier, NOT station-name similarity.
Stop IDs, GTFS trips and the Infrabel network are never changed.

    docker compose exec api python -m app.gtfs_translations
"""
from __future__ import annotations
import re
import time

import httpx
from .db import connect
from .gtfs_db import ensure_gtfs_schema

LANGUAGES = ('nl', 'fr', 'en', 'de')
URL = 'https://api.irail.be/stations/'
GTFS_PATTERN = re.compile(r'^gs:nmbssncb:S(\d{7})$')
IRAIL_PATTERN = re.compile(r'^BE\.NMBS\.00(\d{7})$')


def get_station_code(stop_id: str) -> str | None:
    m = GTFS_PATTERN.fullmatch(stop_id)
    return m.group(1) if m else None


def parse_irail(payload: dict) -> list[dict]:
    stations = payload.get('station', [])
    if isinstance(stations, dict):
        stations = [stations]
    if not isinstance(stations, list):
        raise ValueError('Unexpected iRail response format')
    out = []
    for row in stations:
        if not isinstance(row, dict):
            continue
        match = IRAIL_PATTERN.fullmatch(str(row.get('id', '')))
        name = row.get('name')
        if not match or not isinstance(name, str) or not name.strip():
            continue
        try:
            lat = float(row['locationY'])
            lon = float(row['locationX'])
        except (KeyError, ValueError, TypeError):
            continue
        if not 49 <= lat <= 52 or not 2 <= lon <= 7:
            continue
        out.append({'code': match.group(1), 'name': name.strip(), 'lat': lat, 'lon': lon})
    return out


def fetch_language(lang: str, client: httpx.Client) -> list[dict]:
    if lang not in LANGUAGES:
        raise ValueError(f'Unsupported language: {lang}')
    response = client.get(URL, params={'format': 'json', 'lang': lang})
    response.raise_for_status()
    data = response.json()
    records = parse_irail(data)
    if len(records) < 100:
        raise RuntimeError(f'iRail {lang} supplied only {len(records)} usable stations; refusing partial update')
    return records


def close_enough(gtfs: dict, irail: dict, max_m: float = 1200) -> bool:
    """Reject the extremely unlikely case of an ID collision from disjoint locations."""
    import math
    if gtfs.get('lat') is None or gtfs.get('lon') is None:
        return False
    lat1, lat2 = math.radians(float(gtfs['lat'])), math.radians(float(irail['lat']))
    dlat = lat2 - lat1
    dlon = math.radians(float(irail['lon']) - float(gtfs['lon']))
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    dist = 6371000 * 2 * math.atan2(math.sqrt(a), math.sqrt(max(0, 1-a)))
    return dist <= max_m


def build_translations(stops: list[dict], sources: dict[str, list[dict]]) -> list[tuple]:
    stops_by_code = {}
    for stop in stops:
        code = get_station_code(stop['stop_id'])
        if code:
            stops_by_code.setdefault(code, stop)
    translations = {}
    for lang, entries in sources.items():
        if lang not in LANGUAGES:
            raise ValueError(f'Unknown language {lang}')
        for entry in entries:
            stop = stops_by_code.get(entry['code'])
            if stop and close_enough(stop, entry):
                translations[(stop['stop_id'], lang)] = (
                    stop['stop_id'], lang, entry['name'], 'iRail',
                )
    return list(translations.values())


def refresh_translations():
    ensure_gtfs_schema()
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT stop_id, lat, lon FROM gtfs_stops')
            stops = [dict(stop_id=r[0], lat=r[1], lon=r[2]) for r in cur.fetchall()]
    if not stops:
        raise RuntimeError('NMBS GTFS ontbreekt: importeer eerst GTFS Static')
    sources = {}
    with httpx.Client(timeout=90, follow_redirects=True, headers={
        'User-Agent': 'RailwayNetworkExplorer/0.3.3 (https://github.com/Jaskejaske1/railway-network-explorer)',
    }) as client:
        for lang in LANGUAGES:
            sources[lang] = fetch_language(lang, client)
            print(f'{lang}: {len(sources[lang])} iRail-stations ontvangen', flush=True)
            time.sleep(.4)  # well below iRail API request rate limit
    values = build_translations(stops, sources)
    if len(values) < 300:
        raise RuntimeError(f'Only {len(values)} GTFS station names mapped; old translations preserved')
    langs = {lang for _, lang, _, _ in values}
    if set(LANGUAGES) != langs:
        raise RuntimeError(f'Incomplete language coverage ({langs}); old translations preserved')
    # Single DB transaction: failure keeps previous translations intact.
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM gtfs_station_translations')
            cur.executemany('''
                INSERT INTO gtfs_station_translations(stop_id, language, name, source)
                VALUES (%s, %s, %s, %s)
            ''', values)
    print(f'Multilingual station names committed: {len(values)} across {len(LANGUAGES)} languages')
    return len(values)


if __name__ == '__main__':
    refresh_translations()
