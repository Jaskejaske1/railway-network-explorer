import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import { applyOverlayVisibility } from './visibility.js'
import { api } from './api.js'
import { StationPicker } from './components/StationPicker.jsx'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@mantine/core/styles.css'
import { belgianNow, initialDeparture, futureDepartureValid, clampToFuture } from './travelDate.js'

const EMPTY = { type: 'FeatureCollection', features: [] }
const COLORS = ['#529bff', '#eaa64e', '#c39aff', '#33d7b3', '#fb7295']

const json = api

const selectedPoint = (feature) => ({
  id: feature.properties.id,
  name: feature.properties.name,
  lon: feature.geometry.coordinates[0],
  lat: feature.geometry.coordinates[1],
})


const basemapStyle = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors' } },
  layers: [{ id: 'basemap', type: 'raster', source: 'osm', paint: { 'raster-opacity': .88 } }],
}

function MapView({ allSegments, allStations, routes, active, selected, onStationPick, target, showNetwork, showJourney, showStations }) {
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
      map.addLayer({ id: 'route-glow', type: 'line', source: 'route', filter: ['!=', ['get','geometry_source'], 'schematic_fallback'], paint: {
        'line-color': ['match', ['get', 'routeIndex'], 0, COLORS[0], 1, COLORS[1], 2, COLORS[2], 3, COLORS[3], COLORS[4]],
        'line-width': ['case', ['==', ['get', 'active'], 1], 11, 5], 'line-opacity': .24,
      } })
      map.addLayer({ id: 'route-lines', type: 'line', source: 'route', filter: ['!=', ['get','geometry_source'], 'schematic_fallback'], paint: {
        'line-color': ['match', ['get', 'routeIndex'], 0, COLORS[0], 1, COLORS[1], 2, COLORS[2], 3, COLORS[3], COLORS[4]],
        'line-width': ['case', ['==', ['get', 'active'], 1], 5.5, 3],
        'line-opacity': ['case', ['==', ['get', 'active'], 1], 1, .65],
      } })
      // Only unmatchable parts remain straight, and are unmistakably dashed.
      map.addLayer({ id: 'route-fallback', type: 'line', source: 'route',
        filter: ['==', ['get', 'geometry_source'], 'schematic_fallback'],
        paint: { 'line-color': ['match', ['get', 'routeIndex'], 0, COLORS[0], 1, COLORS[1], 2, COLORS[2], 3, COLORS[3], COLORS[4]],
                 'line-width': ['case', ['==', ['get', 'active'], 1], 4, 2.5],
                 'line-opacity': .9, 'line-dasharray': [2, 2] } })
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
    const update = () => applyOverlayVisibility(map, { showNetwork, showJourney, showStations })
    // Keep the selected route and the selected station markers in the same
    // toggle group as their respective background features.
    if (map.getLayer('chosen-halo')) update()
    else map.once('load', update)
  }, [showNetwork, showJourney, showStations])

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
  const [language, setLanguage] = useState('nl')
  const [clockNow, setClockNow] = useState(belgianNow)
  const [meta, setMeta] = useState(null)
  const [feed, setFeed] = useState(null)
  const [segments, setSegments] = useState(EMPTY)
  const [stations, setStations] = useState(EMPTY)
  const [dataError, setDataError] = useState('')
  const [from, setFrom] = useState(null)
  const [to, setTo] = useState(null)
  const [target, setTarget] = useState('from')
  const [travelDate, setTravelDate] = useState(() => initialDeparture().date)
  const [travelTime, setTravelTime] = useState(() => initialDeparture().time)
  const [viaTransfer, setViaTransfer] = useState(null)
  const [journeys, setJourneys] = useState([])
  const [active, setActive] = useState(0)
  const [expandedRoute, setExpandedRoute] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [networkVisible, setNetworkVisible] = useState(true)
  const [journeyVisible, setJourneyVisible] = useState(true)
  const [stationsVisible, setStationsVisible] = useState(true)

  useEffect(() => {
    const tick = () => setClockNow(belgianNow())
    const interval = setInterval(tick, 30_000)
    return () => clearInterval(interval)
  }, [])
  const dateMinimum = clockNow.date > (feed?.feed?.start_date || '') ? clockNow.date : feed?.feed?.start_date || clockNow.date
  const feedExpired = !!(feed?.feed?.end_date && feed.feed.end_date < clockNow.date)
  const validDeparture = futureDepartureValid(travelDate, travelTime, clockNow) && !feedExpired
  useEffect(() => {
    const adjusted = clampToFuture(travelDate, travelTime, clockNow)
    if (adjusted.date !== travelDate) setTravelDate(adjusted.date)
    if (adjusted.time !== travelTime) setTravelTime(adjusted.time)
  }, [clockNow])

  useEffect(() => {
    // The infrastructure network and the timetable are TWO data sources in ONE UI.
    json('/api/meta').then(setMeta).catch(e => setDataError(e.message))
    json('/api/network').then(setSegments).catch(e => setDataError(e.message))
    json('/api/gtfs/meta').then(setFeed).catch(e => setDataError(e.message))
  }, [])

  useEffect(() => {
    const abort = new AbortController()
    json(`/api/gtfs/stations/geojson?lang=${language}`, { signal: abort.signal })
      .then(setStations).catch(e => { if (e.name !== 'AbortError') setDataError(e.message) })
    return () => abort.abort()
  }, [language])

  useEffect(() => {
    // A language change must never alter the selected GTFS stop IDs.
    if (!stations.features.length) return
    const namesById = new Map(stations.features.map(f => [f.properties.id, f.properties.name]))
    for (const setter of [setFrom, setTo]) {
      setter(previous => {
        if (!previous || !namesById.has(previous.id)) return previous
        const name = namesById.get(previous.id)
        return name === previous.name ? previous : { ...previous, name }
      })
    }
  }, [stations])

  useEffect(() => {
    if (!from || !to || !feed?.available || !validDeparture) {
      setJourneys([])
      setError('')
      setLoading(false)
      return
    }
    if (from.id === to.id) {
      setJourneys([])
      setError('Vertrekstation en aankomststation zijn hetzelfde.')
      setLoading(false)
      return
    }
    const abort = new AbortController()
    const params = new URLSearchParams({ from_id: from.id, to_id: to.id,
      date: travelDate, time: travelTime, alternatives: '4', lang: language })
    if (viaTransfer) params.set('via_transfer_id', viaTransfer.id)
    setLoading(true)
    setError('')
    setJourneys([])
    fetch(`/api/gtfs/routes?${params}`, { signal: abort.signal })
      .then(async response => {
        const payload = await response.json()
        if (!response.ok) throw new Error(typeof payload.detail === 'string' ? payload.detail : `HTTP ${response.status}`)
        return payload
      })
      .then(data => { if (!abort.signal.aborted) { setJourneys(data.journeys); setActive(0); setExpandedRoute(null) } })
      .catch(e => { if (!abort.signal.aborted) setError(`Route zoeken mislukt: ${e.message}`) })
      .finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [from, to, viaTransfer, travelDate, travelTime, feed?.available, language, validDeparture])

  const onPick = (station, mode) => {
    if (mode === 'from') { setFrom(station); setTarget('to') }
    else if (mode === 'to') { setTo(station); setTarget('from') }
    else { setViaTransfer(station); setTarget('from') }
  }
  const example = async (destination) => {
    try {
      const [first, last] = await Promise.all([
        json(`/api/gtfs/stations?search=Leuven&limit=30&lang=${language}`),
        json(`/api/gtfs/stations?search=${encodeURIComponent(destination)}&limit=30&lang=${language}`),
      ])
      const a = first.find(s => s.id === 'gs:nmbssncb:S8833001') || first[0]
      const b = last.find(s => s.name.toLowerCase() === destination.toLowerCase() || s.original_name.toLowerCase() === destination.toLowerCase()) || last[0]
      if (!a || !b) throw Error('Voorbeeldstations niet gevonden. Controleer /api/gtfs/stations.')
      setFrom(a); setTo(b); setViaTransfer(null); setTarget('from')
    } catch (e) { setError(e.message) }
  }

  return <div className="app">
    <aside className="sidebar">
      <header className="brand">
        <div className="logo"><span className="rail-lines">≋</span></div>
        <div><h1>Railway<span>Explorer</span></h1><p>Belgian rail network · prototype 0.3.3</p></div>
      </header>
      <div className="sidebar-scroll">
        <section className="panel intro">
          <div className="eyebrow"><span className="pulse"/> NETWORK & JOURNEY EXPLORER</div>
          <h2>Eén kaart. Echte treinreizen.</h2>
          <p>Bekijk geplande NMBS-ritten, overstappen en alternatieven op de achtergrond van het fysieke Infrabel-spoorwegnet.</p>
          <div className="quick-stats">
            <div><strong>{meta?.segments?.toLocaleString('nl-BE') ?? '—'}</strong><span>Spoorsegmenten</span></div>
            <div><strong>{feed?.feed?.trip_count?.toLocaleString('nl-BE') ?? '—'}</strong><span>GTFS-ritten</span></div>
          </div>
        </section>

        <section className="panel planner">
          <div className="section-heading"><h3>Reis plannen</h3><span className="section-num">01</span></div>
          {!feed?.available && <p className="route-disclaimer">Nog geen GTFS-dienstregeling beschikbaar. Importeer eerst de NMBS GTFS-feed.</p>}
          <div className="locale-controls">
            <label htmlFor="station-language">STATIONSNAMEN TONEN IN</label>
            <select id="station-language" value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="nl">Nederlands</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
            <span>Zoeken werkt in alle vier talen, ongeacht deze keuze.</span>
          </div>
          <StationPicker label="VERTREKSTATION" language={language} placeholder="Zoek een NMBS-station…"
            value={from} onChange={setFrom} onFocus={() => setTarget('from')} />
          <div className="swap-row"><button onClick={() => { setFrom(to); setTo(from) }} title="Wissel vertrek en aankomst">⇅</button><span>Typ of klik een station op de kaart</span></div>
          <StationPicker label="AANKOMSTSTATION" language={language} placeholder="Zoek je bestemming…"
            value={to} onChange={setTo} onFocus={() => setTarget('to')} />
          <StationPicker label="OVERSTAPPEN IN (OPTIONEEL)" language={language}
            placeholder="Bijvoorbeeld Bordet…" value={viaTransfer}
            onChange={setViaTransfer} onFocus={() => setTarget('via')} />
          <p className="field-note">Dwingt een echte wissel van trein af in dit station, niet alleen een spoorwegpad via dit station.</p>
          <div className="date-time-controls">
            <label>REISDATUM<input type="date" value={travelDate} min={dateMinimum} max={feed?.feed?.end_date || undefined}
              onChange={e => { const next = clampToFuture(e.target.value, travelTime, belgianNow()); setTravelDate(next.date); setTravelTime(next.time) }}/></label>
            <label>VERTREK VANAF<input type="time" value={travelTime}
              min={travelDate === clockNow.date ? clockNow.time : undefined}
              onChange={e => { const next = clampToFuture(travelDate, e.target.value, belgianNow()); setTravelDate(next.date); setTravelTime(next.time) }}/></label>
          </div>
          <div className="map-target"><span>Volgende kaartklik vult in:</span>
            {['from', 'to', 'via'].map((value, index) => <button key={value} className={target === value ? 'active' : ''}
              onClick={() => setTarget(value)}>{['Vertrek', 'Aankomst', 'Overstap'][index]}</button>)}
          </div>
          <div className="example-actions">
            <button className="example-button" onClick={() => example('Weerde')} disabled={!feed?.available}>Probeer Leuven → Weerde <span>↗</span></button>
            <button className="example-button" onClick={() => example('Sint-Katelijne-Waver')} disabled={!feed?.available}>Leuven → Sint-Katelijne-Waver <span>↗</span></button>
          </div>
        </section>

        <section className="panel results">
          <div className="section-heading"><h3>Geplande treinreizen</h3><span className="section-num">02</span></div>
          <p className="route-disclaimer">Geplande GTFS-ritten, getekend langs <strong>geschatte Infrabel-spoortrajecten</strong>. Gestippelde stukken konden niet aan het netwerk worden gekoppeld. De exacte rijweg is niet bekend.</p>
          {feedExpired && <p role="alert" className="error">De GTFS-feed is verlopen. Importeer eerst een actuelere dienstregeling.</p>}
          {viaTransfer && <p className="small-note">Alleen reizen met een echte overstap in {viaTransfer.name}.</p>}
          {dataError && <p role="alert" className="error">Data laden mislukt: {dataError}</p>}
          {error && <p role="alert" className="error">{error}</p>}
          {loading && <p className="muted">Geplande treinen en overstappen berekenen…</p>}
          {!from || !to ? <p className="muted">Selecteer twee stations. De planner zoekt meteen naar ritten op de gekozen datum.</p> : null}
          {feed?.available && journeys.length === 0 && from && to && !loading && !error && <p className="muted">{viaTransfer ? `Geen geplande reis met een overstap in ${viaTransfer.name} gevonden binnen de huidige zoekhorizon. Dit sluit andere routes of NMBS-opties niet uit.` : 'Geen reis gevonden. Probeer een andere datum of vertrekperiode.'}</p>}
          {journeys.length > 0 && <div className="route-list">
            {journeys.map((journey, i) => <div key={`${journey.departure}-${i}`} className={`route-card ${active === i ? 'selected' : ''}`}>
              <button className="route-primary" onClick={() => { setActive(i); setExpandedRoute(expandedRoute === i ? null : i) }}>
                <span className="route-dot" style={{ background: COLORS[i] }}/>
                <span className="route-description"><b>{journey.departure} → {journey.arrival}</b>
                  <small>{journey.transfer_count === 0 ? 'Rechtstreekse trein' : `${journey.transfer_count} overstap${journey.transfer_count > 1 ? 'pen' : ''} · ${journey.transfer_stations.join(', ')}`}</small>
                </span>
                <strong>{journey.legs.length} trein{journey.legs.length === 1 ? '' : 'en'}</strong>
              </button>
              {active === i && <div className="route-more">
                {journey.geometry_quality && <p className="small-note">
                  Infrabel-benadering: {journey.geometry_quality.infrabel_segments} spoorsegmenten;
                  {journey.geometry_quality.schematic_fallbacks > 0
                    ? ` ${journey.geometry_quality.schematic_fallbacks} gestippelde, onbekende trajectdelen.`
                    : ' geen gestippelde trajectdelen.'}
                </p>}
                {journey.legs.map((leg, n) => <div key={`${leg.trip_id}-${n}`} className="journey-leg">
                  <strong>{leg.departure} {leg.from_name} → {leg.arrival} {leg.to_name}</strong>
                  <div>Trein {leg.route || leg.trip_id}{leg.headsign ? ` · richting ${leg.headsign}` : ''}</div>
                  {n < journey.legs.length - 1 && <div className="transfer-label">Overstap in {leg.to_name}</div>}
                  {expandedRoute === i && <ol>{leg.stop_names.map((s, k) => <li key={k}>{s}</li>)}</ol>}
                </div>)}
                <button onClick={() => setExpandedRoute(expandedRoute === i ? null : i)}>{expandedRoute === i ? 'Verberg tussenhaltes ↑' : 'Toon tussenhaltes ↓'}</button>
              </div>}
            </div>)}
          </div>}
          <p className="small-note">Dienstregeling: NMBS GTFS Static. Geen realtimegegevens, geen bevestiging van abonnementsdekking of exact gevolgde sporen.</p>
        </section>
        <section className="panel footnotes">
          <div><span className="dot-green"/> Infrabel infrastructuur + NMBS GTFS Static</div>
          <p>{feed?.feed?.imported_at ? `Dienstregeling geïmporteerd: ${new Date(feed.feed.imported_at).toLocaleString('nl-BE')}` : 'GTFS niet geïmporteerd'}</p>
          <p>Basemap © OpenStreetMap contributors</p>
        </section>
      </div>
    </aside>
    <main className="map-area">
      <MapView allSegments={segments} allStations={stations} routes={journeys} active={active}
        selected={[from, to, viaTransfer]} onStationPick={onPick} target={target}
        showNetwork={networkVisible} showJourney={journeyVisible} showStations={stationsVisible}/>
      <div className="map-topbar"><span className="map-label"><span className="dot-green"/> NMBS treinen + Infrabel spoorwegnet</span>
        <span className="map-label secondary-label">België · WGS84</span></div>
      <div className="map-controls">
        <label><input type="checkbox" checked={networkVisible} onChange={e => setNetworkVisible(e.target.checked)}/> Fysieke spoorlijnen</label>
        <label><input type="checkbox" checked={journeyVisible} onChange={e => setJourneyVisible(e.target.checked)}/> Geplande treinreis</label>
        <label><input type="checkbox" checked={stationsVisible} onChange={e => setStationsVisible(e.target.checked)}/> NMBS-stations</label>
      </div>
      <div className="map-legend">
        <div className={!networkVisible ? 'legend-disabled' : ''}><i className="legend-line"/> Infrabel spoorlijnen</div>
        <div className={!journeyVisible ? 'legend-disabled' : ''}><i className="legend-line active"/> GTFS-reis (Infrabel-benadering)</div>
        <div className={!stationsVisible ? 'legend-disabled' : ''}><i className="legend-circle"/> NMBS-station</div>
      </div>
    </main>
  </div>
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})
createRoot(document.getElementById('root')).render(
  <MantineProvider defaultColorScheme="dark">
    <QueryClientProvider client={queryClient}><App /></QueryClientProvider>
  </MantineProvider>
)
