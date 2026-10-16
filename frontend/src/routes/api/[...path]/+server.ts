import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';

// One same-origin, GET-only boundary. Never proxy arbitrary URLs from a browser.
const ALLOWED = new Set([
  'health', 'meta', 'network', 'gtfs/meta', 'gtfs/stations',
  'gtfs/stations/geojson', 'gtfs/routes'
]);

export const GET: RequestHandler = async ({ params, url, fetch }) => {
  const path = params.path ?? '';
  if (!ALLOWED.has(path)) return json({ detail: 'Unknown API endpoint' }, { status: 404 });
  const origin = env.API_ORIGIN || 'http://127.0.0.1:8000';
  const endpoint = origin.replace(/\/$/, '') + '/api/' + path + url.search;
  try {
    const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) {
      return json({ detail: 'Backend returned a non-JSON response' }, { status: 502 });
    }
    const content = await response.text();
    return new Response(content, {
      status: response.status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  } catch {
    return json({ detail: 'Backend niet bereikbaar. Controleer de API-container.' }, { status: 503 });
  }
};
