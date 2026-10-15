// Same-origin API only: the proxy owns TLS, rate limits and host validation.
export async function api(path, { signal } = {}) {
  const response = await fetch(path, { signal, headers: { Accept: 'application/json' } })
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) throw new Error('De server gaf geen geldige API-respons.')
  const data = await response.json()
  if (!response.ok) {
    const message = typeof data?.detail === 'string' ? data.detail : `HTTP ${response.status}`
    throw new Error(message)
  }
  return data
}
export function stationSearchPath(search, language) {
  const qs = new URLSearchParams({ search: search.trim(), limit: '12', lang: language })
  return `/api/gtfs/stations?${qs}`
}
export function journeyPath({ from, to, date, time, language, via }) {
  const qs = new URLSearchParams({ from_id: from, to_id: to, date, time, alternatives: '4', lang: language })
  if (via) qs.set('via_transfer_id', via)
  return `/api/gtfs/routes?${qs}`
}
