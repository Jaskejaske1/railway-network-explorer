import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import { applyOverlayVisibility } from './visibility.js'

const EMPTY = { type: 'FeatureCollection', features: [] }
const COLORS = ['#529bff', '#eaa64e', '#c39aff', '#33d7b3', '#fb7295']

const json = async url => {
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`)
  return data
}

const selectedPoint = (feature) => ({
  id: feature.properties.id,
  name: feature.properties.name,
  lon: feature.geometry.coordinates[0],
  lat: feature.geometry.coordinates[1],
})

function StationPicker({ label, placeholder, value, onChange, onFocus }) {
  const [text, setText] = useState(value?.name ?? '')
  const [results, setResults] = useState([])
  const [expanded, setExpanded] = useState(false)
  useEffect(() => { setText(value?.name ?? '') }, [value])
  useEffect(() => {
    const ac = new AbortController()
    if (!expanded || text.trim().length < 2) { setResults([]); return () => ac.abort() }
    const timeout = setTimeout(() => {
      fetch(`/api/stations?search=${encodeURIComponent(text)}&limit=12`, { signal: ac.signal })
        .then(r => r.json()).then(setResults).catch(e => { if (e.name !== 'AbortError') setResults([]) })
    }, 180)
    return () => { clearTimeout(timeout); ac.abort() }
  }, [text, expanded])
  return <div className="picker">
    <label>{label}</label>
    <div className="picker-field">
      <span className="search-icon">⌕</span>
      <input value={text} placeholder={placeholder} autoComplete="off"
        onFocus={() => { setExpanded(true); onFocus?.() }}
        onBlur={() => setTimeout(() => setExpanded(false), 140)}
        onChange={e => { setText(e.target.value); onChange(null); setExpanded(true) }} />
      {value && <button type="button" className="clear" aria-label={`${label} wissen`} onClick={() => { onChange(null); setText('') }}>×</button>}
    </div>
    {expanded && results.length > 0 && <div className="suggestions">
      {results.map(s => <button key={s.id} type="button" onMouseDown={e => e.preventDefault()}
        onClick={() => { onChange(s); setText(s.name); setExpanded(false) }}>
        <span>{s.name}</span><span className="station-id">#{s.id}</span>
      </button>)}
    </div>}
  </div>
}

const basemapStyle = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors' } },
  layers: [{ id: 'basemap', type: 'raster', source: 'osm', paint: { 'raster-opacity': .88 } }],
}

function MapView({ allSegments, allStations, routes, active, selected, onStationPick, target, showNetwork, showStations }) {
  const element = useRef(null)
  const mapRef = useRef(null)
  const callback = useRef(onStationPick)
  const targetRef = useRef(target)
  useEffect(() => { callback.current = onStationPick; targetRef.current = target }, [onStationPick, target])

  useEffect(() => {
    if (!element.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: element.current, style: basemapStyle, center: [4.65, 50.85], zoom: 8,
      maxZoom: 17, minZoom: 6, attributionControl: true,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      map.addSource('network', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'rail-shadow', type: 'line', source: 'network', paint: { 'line-color': '#061222', 'line-width': 5, 'line-opacity': .50 } })
      map.addLayer({ id: 'rail-base', type: 'line', source: 'network', paint: { 'line-color': '#748399', 'line-width': 2, 'line-opacity': .8 } })
      map.addSource('route', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'route-glow', type: 'line', source: 'route', paint: {
        'line-color': ['match', ['get', 'routeIndex'], 0, COLORS[0], 1, COLORS[1], 2, COLORS[2], 3, COLORS[3], COLORS[4]],
        'line-width': ['case', ['==', ['get', 'active'], 1], 11, 5], 'line-opacity': .24,
      } })
      map.addLayer({ id: 'route-lines', type: 'line', source: 'route', paint: {
        'line-color': ['match', ['get', 'routeIndex'], 0, COLORS[0], 1, COLORS[1], 2, COLORS[2], 3, COLORS[3], COLORS[4]],
        'line-width': ['case', ['==', ['get', 'active'], 1], 5.5, 3],
        'line-opacity': ['case', ['==', ['get', 'active'], 1], 1, .65],
      } })
      map.addSource('stations', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'stations-halo', type: 'circle', source: 'stations', paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2, 10, 5],
        'circle-color': '#e2edfd', 'circle-stroke-color': '#0a1626', 'circle-stroke-width': 1.5,
      } })
      map.addLayer({ id: 'station-names', type: 'symbol', source: 'stations', minzoom: 10, layout: {
        'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.2],
        'text-anchor': 'top', 'text-optional': true,
      }, paint: { 'text-color': '#0b172a', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } })
      map.addSource('chosen', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'chosen-halo', type: 'circle', source: 'chosen', paint: {
        'circle-radius': 9, 'circle-color': ['get', 'color'],
        'circle-stroke-width': 3, 'circle-stroke-color': '#fff',
      } })
      map.on('click', 'stations-halo', e => {
        const f = e.features?.[0]
        if (f) callback.current(selectedPoint(f), targetRef.current)
      })
      map.on('mouseenter', 'stations-halo', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'stations-halo', () => { map.getCanvas().style.cursor = '' })
      map.on('click', 'rail-base', e => {
        if (map.queryRenderedFeatures(e.point, { layers: ['stations-halo'] }).length) return
        const s = e.features?.[0]?.properties
        if (!s) return
        const node = document.createElement('div')
        node.className = 'track-popup'
        node.textContent = `${s.from_name} ↔ ${s.to_name} · ${Number(s.distance_km).toFixed(2)} km`
        new maplibregl.Popup({ closeButton: false }).setLngLat(e.lngLat).setDOMContent(node).addTo(map)
      })
    })
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const update = () => {
      map.getSource('network')?.setData(allSegments)
      map.getSource('stations')?.setData(allStations)
    }
    // The base style can still be fetching raster tiles AFTER its load event.
    // Check the actual custom sources, not map.isStyleLoaded(), to avoid losing updates.
    if (map.getSource('network') && map.getSource('stations')) update()
    else map.once('load', update)
  }, [allSegments, allStations])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const features = routes.flatMap((r, ix) => r.geometry.features.map(f => ({
      ...f, properties: { ...(f.properties ?? {}), routeIndex: ix, active: ix === active ? 1 : 0 },
    })))
    // Put selected route last, so it remains readable where corridors overlap.
    features.sort((a, b) => a.properties.active - b.properties.active)
    const update = () => map.getSource('route')?.setData({ type: 'FeatureCollection', features })
    if (map.getSource('route')) update()
    else map.once('load', update)
  }, [routes, active])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const data = { type: 'FeatureCollection', features: selected.filter(v => v?.lon != null && v?.lat != null).map((v, ix) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
      properties: { id: v.id, color: ['#3dd0a3', '#f48e80', '#eeb75c'][ix] },
    })) }
    const update = () => map.getSource('chosen')?.setData(data)
    if (map.getSource('chosen')) update()
    else map.once('load', update)
  }, [selected])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const update = () => applyOverlayVisibility(map, { showNetwork, showStations })
    // Keep the selected route and the selected station markers in the same
    // toggle group as their respective background features.
    if (map.getLayer('chosen-halo')) update()
    else map.once('load', update)
  }, [showNetwork, showStations])

  useEffect(() => {
    const map = mapRef.current
    const route = routes[active]
    if (!map || !route || route.geometry.features.length === 0) return
    const bounds = new maplibregl.LngLatBounds()
    for (const feat of route.geometry.features) {
      for (const pt of feat.geometry.coordinates) bounds.extend(pt)
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 65, maxZoom: 11, duration: 650 })
  }, [routes, active])

  return <div ref={element} className="map-canvas" aria-label="Interactieve kaart van het Belgische spoorwegnet" />
}

function App() {
  const [meta, setMeta] = useState(null)
  const [segments, setSegments] = useState(EMPTY)
  const [stations, setStations] = useState(EMPTY)
  const [from, setFrom] = useState(null)
  const [to, setTo] = useState(null)
  const [via, setVia] = useState(null)
  const [target, setTarget] = useState('from')
  const [routes, setRoutes] = useState([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [networkVisible, setNetworkVisible] = useState(true)
  const [stationsVisible, setStationsVisible] = useState(true)
  const [expandedRoute, setExpandedRoute] = useState(null)

  useEffect(() => {
    Promise.all([json('/api/meta'), json('/api/network'), json('/api/stations/geojson')])
      .then(([m, network, points]) => { setMeta(m); setSegments(network); setStations(points) })
      .catch(e => setError(`Netwerk laden mislukt: ${e.message}`))
  }, [])

  useEffect(() => {
    if (!from || !to) { setRoutes([]); setError(''); return }
    const ac = new AbortController()
    const params = new URLSearchParams({ from_id: from.id, to_id: to.id, alternatives: 3 })
    if (via) params.set('via_id', via.id)
    setLoading(true)
    setError('')
    fetch(`/api/routes?${params.toString()}`, { signal: ac.signal })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw Error(data.detail || `HTTP ${response.status}`)
        return data
      })
      .then(data => { setRoutes(data.routes); setActive(0); setExpandedRoute(null) })
      .catch(e => { if (e.name !== 'AbortError') { setError(e.message); setRoutes([]) } })
      .finally(() => { if (!ac.signal.aborted) setLoading(false) })
    return () => ac.abort()
  }, [from, to, via])

  const onPick = (s, mode) => {
    if (mode === 'from') { setFrom(s); setTarget('to') }
    else if (mode === 'to') { setTo(s); setTarget('via') }
    else { setVia(s); setTarget('via') }
  }

  const useExample = async () => {
    try {
      const [a, b] = await Promise.all([
        json('/api/stations?search=Leuven&limit=100'),
        json('/api/stations?search=Katelijne&limit=100'),
      ])
      const first = a.find(s => s.name.toLowerCase() === 'leuven') || a[0]
      const last = b.find(s => /katelijne.waver/i.test(s.name)) || b[0]
      if (!first || !last) throw Error('De voorbeeldstations zijn niet gevonden in de geïmporteerde dataset')
      setFrom(first); setTo(last); setVia(null); setTarget('via')
    } catch (e) { setError(e.message) }
  }

  const hasData = (meta?.segments ?? 0) > 0
  return <div className="app">
    <aside className="sidebar">
      <header className="brand">
        <div className="logo"><span className="rail-lines">≋</span></div>
        <div><h1>Railway<span>Explorer</span></h1><p>Belgian rail network · prototype 0.1.2</p></div>
      </header>

      <div className="sidebar-scroll">
        <section className="panel intro">
          <div className="eyebrow"><span className="pulse"/> NETWORK EXPLORER</div>
          <h2>Ontdek elk spoortraject.</h2>
          <p>Verken de verbindingen tussen stations, vergelijk alternatieve paden en onderzoek een route via een zelfgekozen station.</p>
          <div className="quick-stats">
            <div><strong>{meta ? meta.stations.toLocaleString('nl-BE') : '—'}</strong><span>Punten</span></div>
            <div><strong>{meta ? meta.segments.toLocaleString('nl-BE') : '—'}</strong><span>Segmenten</span></div>
          </div>
        </section>

        <section className="panel planner">
          <div className="section-heading"><h3>Traject samenstellen</h3><span className="section-num">01</span></div>
          <StationPicker label="VERTREKSTATION" placeholder="Zoek een station..." value={from} onChange={setFrom} onFocus={() => setTarget('from')} />
          <div className="swap-row"><button onClick={() => { setFrom(to); setTo(from) }} title="Wissel vertrek en aankomst">⇅</button><span>Zoek of klik een station op de kaart</span></div>
          <StationPicker label="AANKOMSTSTATION" placeholder="Zoek je bestemming..." value={to} onChange={setTo} onFocus={() => setTarget('to')} />
          <div className="via-divider"><span>OPTIONEEL</span></div>
          <StationPicker label="VIA-STATION (GEEN OVERSTAP)" placeholder="Forceer een spoorwegknooppunt..." value={via} onChange={setVia} onFocus={() => setTarget('via')} />
          <p className="field-note">Een VIA-station dwingt een spoorwegpad af, niet een treinhalte of overstap.</p>
          <div className="map-target"><span>Kaartklik vult in:</span>
            {['from', 'to', 'via'].map((v, i) => <button key={v} className={target === v ? 'active' : ''} onClick={() => setTarget(v)}>{['Vertrek', 'Aankomst', 'Via'][i]}</button>)}
          </div>
          <button className="example-button" onClick={useExample} disabled={!hasData}>Probeer Leuven → Sint-Katelijne-Waver <span>↗</span></button>
        </section>

        <section className="panel results">
          <div className="section-heading"><h3>Infrastructuurpaden</h3><span className="section-num">02</span></div>
          <p className="route-disclaimer">Paden op basis van spoorafstand. Dit zijn <strong>geen NMBS-treinreizen</strong>; haltes en overstappen zijn onbekend.</p>
          {loading && <p className="muted">Routes berekenen…</p>}
          {error && <p role="alert" className="error">{error}</p>}
          {!hasData && !error && <div className="empty-state"><strong>Nog geen spoorwegdata</strong><p>Voer de Infrabel-import uit om het netwerk te laden.</p><code>docker compose exec api python -m app.importer</code></div>}
          {hasData && !from && !to && <p className="muted">Selecteer een vertrekstation en bestemming om infrastructuurpaden te vergelijken.</p>}
          {routes.length > 0 && <div className="route-list">
            {routes.map((route, i) => <div key={i} className={`route-card ${active === i ? 'selected' : ''}`}>
              <button className="route-primary" onClick={() => { setActive(i); setExpandedRoute(expandedRoute === i ? null : i) }}>
                <span className="route-dot" style={{ background: COLORS[i] }} />
                <span className="route-description"><b>{via ? `Spoorwegpad via ${via.name}` : i === 0 ? 'Kortste spoorwegpad' : `Fysiek alternatief ${i}`}</b>
                  <small>{route.station_ids.length} punten · {route.segment_ids.length} segmenten · geen overstappen berekend</small></span>
                <strong>{route.distance_km.toLocaleString('nl-BE', { maximumFractionDigits: 2 })} km</strong>
              </button>
              {active === i && <div className="route-more">
                <div>{route.station_names.slice(0, 5).join(' → ')}{route.station_names.length > 5 ? ' → …' : ''}</div>
                {route.repeats_stations && <p className="warning">Dit pad bezoekt minstens één station meermaals.</p>}
                <button onClick={() => setExpandedRoute(expandedRoute === i ? null : i)}>{expandedRoute === i ? 'Verberg volledige route ↑' : 'Toon alle stations ↓'}</button>
                {expandedRoute === i && <ol>{route.station_names.map((name, index) => <li key={`${name}-${index}`}>{name}{via && route.station_ids[index] === via.id ? ' · via (niet noodzakelijk een stop)' : ''}</li>)}</ol>}
              </div>}
            </div>)}
          </div>}
          {routes.length > 0 && <p className="small-note">Afstanden: Infrabel-schatting. Dit zijn <strong>fysieke paden</strong>, geen gegarandeerde treinritten.</p>}
        </section>

        <section className="panel footnotes"><div><span className="dot-green"/> Data: Infrabel Open Data</div>
          <p>{meta?.imported_at ? `Laatste import: ${new Date(meta.imported_at).toLocaleString('nl-BE')}` : 'Nog geen data geïmporteerd'}</p>
          <p>Kaart © OpenStreetMap-bijdragers · Infrabel-data CC0.</p>
          <p>Geen dienstregeling of abonnementscontrole.</p>
        </section>
      </div>
    </aside>

    <main className="map-area">
      <MapView allSegments={segments} allStations={stations} routes={routes} active={active}
        selected={[from, to, via]} onStationPick={onPick} target={target}
        showNetwork={networkVisible} showStations={stationsVisible}/>
      <div className="map-topbar"><span className="map-label"><span className="dot-green"/> Infrabel infrastructuurnetwerk</span>
        <span className="map-label secondary-label">België · WGS84</span></div>
      <div className="map-controls">
        <label><input type="checkbox" checked={networkVisible} onChange={e => setNetworkVisible(e.target.checked)}/><span>Spoorlijnen inclusief routes</span></label>
        <label><input type="checkbox" checked={stationsVisible} onChange={e => setStationsVisible(e.target.checked)}/><span>Stations inclusief selectie</span></label>
      </div>
      <div className="map-legend"><div className={!networkVisible ? "legend-disabled" : ""}><i className="legend-line"/> Spoornetwerk</div>
        <div className={!networkVisible ? "legend-disabled" : ""}><i className="legend-line active"/> Geselecteerd pad</div>
        <div className={!stationsVisible ? "legend-disabled" : ""}><i className="legend-circle"/> Station</div></div>
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
