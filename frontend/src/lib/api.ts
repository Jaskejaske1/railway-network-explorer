export type Station = {
  id: string; name: string; original_name?: string; lat: number; lon: number;
};
export type GeoCollection = { type: 'FeatureCollection'; features: Array<Record<string, any>> };
export const EMPTY: GeoCollection = { type: 'FeatureCollection', features: [] };

export type Leg = {
  trip_id: string; departure: string; arrival: string; from_name: string; to_name: string;
  route?: string; headsign?: string; stop_names: string[];
};
export type Journey = {
  departure: string; arrival: string; transfer_count: number; transfer_stations: string[];
  legs: Leg[]; geometry?: GeoCollection; geometry_quality?: { schematic_fallbacks?: number };
};
export type Feed = {
  available: boolean;
  feed?: { start_date?: string; end_date?: string; imported_at?: string } | null;
  realtime: boolean;
};
export type NetworkMeta = { segments?: number; stations?: number };
export type ConnectionResult = { journeys: Journey[]; realtime: boolean; mode: string };

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { accept: 'application/json' } });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error('De API gaf geen geldige JSON terug.');
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'HTTP ' + response.status);
  return data as T;
}

export const api = {
  feed: (signal?: AbortSignal) => request<Feed>('/api/gtfs/meta', signal),
  meta: (signal?: AbortSignal) => request<NetworkMeta>('/api/meta', signal),
  network: (signal?: AbortSignal) => request<GeoCollection>('/api/network', signal),
  mapStations: (lang: string, signal?: AbortSignal) =>
    request<GeoCollection>('/api/gtfs/stations/geojson?lang=' + encodeURIComponent(lang), signal),
  stations: (q: string, lang: string, signal?: AbortSignal) =>
    request<Station[]>('/api/gtfs/stations?' + new URLSearchParams({ search: q, lang, limit: '20' }), signal),
  journeys: (from: string, to: string, date: string, time: string, lang: string,
             signal?: AbortSignal) => {
    const query = new URLSearchParams({ from_id: from, to_id: to, date, time, lang, alternatives: '4' });
    return request<ConnectionResult>('/api/gtfs/routes?' + query, signal);
  }
};
