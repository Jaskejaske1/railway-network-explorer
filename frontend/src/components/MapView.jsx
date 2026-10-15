import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { applyOverlayVisibility } from '../visibility.js'

const EMPTY = { type: 'FeatureCollection', features: [] }
const COLORS = ['#2463c5', '#dc8c3a', '#865abd', '#1e9e8b', '#c45a76']
const selectedPoint = feature => ({ id: feature.properties.id, name: feature.properties.name, lon: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] })

const basemapStyle = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors' } },
  layers: [{ id: 'basemap', type: 'raster', source: 'osm', paint: { 'raster-opacity': .88 } }],
}

export function MapView({ allSegments, allStations, routes, active, selected, onStationPick, target, showNetwork, showJourney, showStations }) {
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

  return <div ref={element} className="map-canvas" role="region" aria-label="Interactieve kaart van het Belgische spoorwegnet" />
}

