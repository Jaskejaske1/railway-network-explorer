<script lang="ts">
  import { onMount } from 'svelte';
  import type { GeoCollection, Journey, Station } from '$lib/api';
  import { EMPTY } from '$lib/api';
  import { coordinatesFor, journeyLines, selectedStations } from '$lib/geo';
  import type { Map as MLMap, GeoJSONSource, StyleSpecification } from 'maplibre-gl';
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

  export let network: GeoCollection = EMPTY;
  export let stations: GeoCollection = EMPTY;
  export let journeys: Journey[] = [];
  export let selectedJourney = 0;
  export let from: Station | null = null;
  export let to: Station | null = null;
  export let focus: Station | null = null;
  export let showNetwork = true;
  export let showStations = true;
  export let showJourney = true;
  export let railOpacity = 0.8;
  export let perspective = false;
  export let basemap: 'liberty' | 'bright' | 'positron' = 'liberty';
  export let onStation: (station: Station) => void = () => {};
  export let onSegment: (segment: Record<string, unknown>) => void = () => {};

  const BASEMAP_URLS = {
    liberty: 'https://tiles.openfreemap.org/styles/liberty',
    bright: 'https://tiles.openfreemap.org/styles/bright',
    positron: 'https://tiles.openfreemap.org/styles/positron'
  };
  // Local fallback never depends on a remote tileserver. Infrabel GeoJSON remains visible.
  const LOCAL_STYLE: StyleSpecification = {
    version: 8, sources: {}, layers: [{
      id: 'atlas-local-background', type: 'background',
      paint: { 'background-color': '#ebf0f1' }
    }]
  };
  const LAYER_IDS = ['atlas-rail-outline', 'atlas-rail', 'atlas-journey-alt',
    'atlas-journey', 'atlas-stations', 'atlas-station-names', 'atlas-endpoints'];

  let element: HTMLDivElement;
  let map: MLMap | undefined;
  let lib: typeof import('maplibre-gl');
  let ready = false;
  let currentStyle: string = 'local';
  let mapError = '';
  let fallbackActive = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let styleErrors = 0;

  function addLayers() {
    if (!map || map.getSource('atlas-network')) return;
    map.addSource('atlas-network', { type: 'geojson', data: network as any });
    map.addLayer({ id: 'atlas-rail-outline', type: 'line', source: 'atlas-network',
      paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.75 } });
    map.addLayer({ id: 'atlas-rail', type: 'line', source: 'atlas-network',
      paint: { 'line-color': '#45566b', 'line-width': 2.3, 'line-opacity': 0.8 } });

    map.addSource('atlas-journeys', { type: 'geojson', data: journeyLines(journeys, selectedJourney) as any });
    map.addLayer({ id: 'atlas-journey-alt', type: 'line', source: 'atlas-journeys',
      filter: ['==', ['get', 'active'], 0],
      paint: { 'line-color': '#95a1b0', 'line-width': 4, 'line-opacity': 0.8 } });
    map.addLayer({ id: 'atlas-journey', type: 'line', source: 'atlas-journeys',
      filter: ['==', ['get', 'active'], 1],
      paint: { 'line-color': '#2775db', 'line-width': 5, 'line-opacity': 0.95 } });

    map.addSource('atlas-points', { type: 'geojson', data: stations as any });
    map.addLayer({ id: 'atlas-stations', type: 'circle', source: 'atlas-points',
      paint: { 'circle-color': '#fff', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2.5, 11, 5],
        'circle-stroke-color': '#415b75', 'circle-stroke-width': 1.5 } });
    map.addLayer({ id: 'atlas-station-names', type: 'symbol', source: 'atlas-points', minzoom: 10,
      layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-anchor': 'top', 'text-offset': [0, 1.2] },
      paint: { 'text-color': '#203047', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });
    map.addSource('atlas-selected', { type: 'geojson', data: selectedStations([from, to]) as any });
    map.addLayer({ id: 'atlas-endpoints', type: 'circle', source: 'atlas-selected',
      paint: { 'circle-radius': 8, 'circle-color': ['get', 'color'],
        'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });

    if (perspective) addBuildings();
    refresh();
  }

  function addBuildings() {
    if (!map || currentStyle === 'local' || map.getLayer('atlas-buildings')) return;
    // OpenFreeMap documents the building source layer and render_height property.
    if (!map.getSource('atlas-buildings-source')) {
      map.addSource('atlas-buildings-source', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
    }
    const labels = map.getStyle().layers.find(layer =>
      layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout)?.id;
    map.addLayer({
      id: 'atlas-buildings', type: 'fill-extrusion', source: 'atlas-buildings-source',
      'source-layer': 'building', minzoom: 15,
      filter: ['!=', ['get', 'hide_3d'], true],
      paint: {
        'fill-extrusion-color': '#aab6bd',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 0],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.75
      }
    }, labels);
  }

  function refresh() {
    if (!map || !map.getSource('atlas-network')) return;
    (map.getSource('atlas-network') as GeoJSONSource).setData(network as any);
    (map.getSource('atlas-points') as GeoJSONSource).setData(stations as any);
    (map.getSource('atlas-journeys') as GeoJSONSource).setData(journeyLines(journeys, selectedJourney) as any);
    (map.getSource('atlas-selected') as GeoJSONSource).setData(selectedStations([from, to]) as any);
    for (const id of ['atlas-rail', 'atlas-rail-outline']) {
      map.setLayoutProperty(id, 'visibility', showNetwork ? 'visible' : 'none');
    }
    for (const id of ['atlas-stations', 'atlas-station-names']) {
      map.setLayoutProperty(id, 'visibility', showStations ? 'visible' : 'none');
    }
    for (const id of ['atlas-journey', 'atlas-journey-alt', 'atlas-endpoints']) {
      map.setLayoutProperty(id, 'visibility', showJourney ? 'visible' : 'none');
    }
    map.setPaintProperty('atlas-rail', 'line-opacity', railOpacity);
    map.setPaintProperty('atlas-rail-outline', 'line-opacity', railOpacity * 0.65);
  }

  function fallback(message: string) {
    if (!map || currentStyle === 'local') return;
    clearTimeout(timeout);
    currentStyle = 'local';
    fallbackActive = true;
    mapError = message;
    map.setStyle(LOCAL_STYLE);
  }

  function changeStyle(style: keyof typeof BASEMAP_URLS) {
    if (!map) return;
    currentStyle = style;
    styleErrors = 0;
    fallbackActive = false;
    mapError = '';
    ready = false;
    clearTimeout(timeout);
    map.setStyle(BASEMAP_URLS[style]);
    timeout = setTimeout(() => {
      if (currentStyle === style && !map?.getSource('atlas-network')) {
        fallback('Basiskaart laadt niet. De lokale spoorweergave blijft beschikbaar.');
      }
    }, 10000);
  }

  function fitJourney() {
    if (!map) return;
    const points = coordinatesFor(journeys[selectedJourney]);
    if (!points.length) return;
    const bounds = new lib.LngLatBounds();
    for (const point of points) bounds.extend(point);
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 90, maxZoom: 12, duration: 500 });
  }

  onMount(() => {
    let destroyed = false;
    let resizeObserver: ResizeObserver | undefined;
    async function start() {
      try {
        lib = await import('maplibre-gl');
        if (destroyed) return;
        lib.setWorkerUrl(workerUrl);
        map = new lib.Map({
          container: element, style: LOCAL_STYLE, center: [4.68, 50.55], zoom: 7.4,
          minZoom: 5, maxZoom: 19, canvasContextAttributes: { antialias: true }
        });
        if (import.meta.env.DEV) (window as any).__atlasMap = map;
        map.addControl(new lib.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
        map.on('style.load', () => {
          if (!map || destroyed) return;
          clearTimeout(timeout);
          ready = true;
          addLayers();
          refresh();
        });
        map.on('error', (event) => {
          const message = String(event.error?.message ?? '');
          if (currentStyle !== 'local') {
            styleErrors++;
            if (styleErrors >= 3) fallback('Kaarttegels niet bereikbaar. Infrabel-sporen blijven beschikbaar.');
          } else {
            mapError = 'Kaartprobleem: ' + (message || 'onbekende fout');
          }
        });
        map.on('click', (event) => {
          if (!map) return;
          const layers = ['atlas-stations', 'atlas-rail'].filter(id => map?.getLayer(id));
          if (!layers.length) return;
          const feature = map.queryRenderedFeatures(event.point, { layers })[0];
          if (!feature) return;
          if (feature.layer.id === 'atlas-stations') {
            const coordinates = (feature.geometry as any).coordinates;
            const station: Station = { id: String(feature.properties?.id),
              name: String(feature.properties?.name ?? 'Station'),
              lon: coordinates[0], lat: coordinates[1] };
            const popupContent = document.createElement('div');
            popupContent.className = 'atlas-popup';
            const title = document.createElement('strong');
            title.textContent = station.name;
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = 'Station bekijken';
            button.addEventListener('click', () => { onStation(station); popup.remove(); });
            popupContent.append(title, button);
            const popup = new lib.Popup({ maxWidth: '250px' })
              .setLngLat(event.lngLat).setDOMContent(popupContent).addTo(map);
          } else {
            onSegment(feature.properties ?? {});
          }
        });
        map.on('mousemove', (event) => {
          if (!map) return;
          const layers = ['atlas-stations', 'atlas-rail'].filter(id => map?.getLayer(id));
          map.getCanvas().style.cursor = layers.length && map.queryRenderedFeatures(event.point, { layers }).length
            ? 'pointer' : '';
        });
        resizeObserver = new ResizeObserver(() => map?.resize());
        resizeObserver.observe(element);
        map.once('load', () => { if (!destroyed) changeStyle(basemap); });
      } catch (reason) {
        mapError = 'Kaart kon niet starten: ' + (reason instanceof Error ? reason.message : String(reason));
      }
    }
    void start();
    return () => {
      destroyed = true;
      clearTimeout(timeout);
      resizeObserver?.disconnect();
      map?.remove();
      map = undefined;
    };
  });

  $: if (ready && network && stations && journeys && selectedJourney >= 0 && from !== undefined && to !== undefined && railOpacity >= 0 && showNetwork !== undefined && showStations !== undefined && showJourney !== undefined) refresh();
  $: if (map && ready && currentStyle !== 'local' && currentStyle !== basemap) changeStyle(basemap);
  $: if (map && ready) {
    map.easeTo({ pitch: perspective ? 55 : 0, bearing: perspective ? -16 : 0, duration: 350 });
    if (perspective) addBuildings();
    if (map.getLayer('atlas-buildings')) map.setLayoutProperty('atlas-buildings', 'visibility', perspective ? 'visible' : 'none');
  }
  $: if (map && ready && journeys.length && selectedJourney >= 0) fitJourney();
  $: if (map && focus && Number.isFinite(focus.lon) && Number.isFinite(focus.lat)) {
    map.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(map.getZoom(), 13), duration: 500 });
  }
</script>

<div class="map-frame" role="region" aria-label="Interactieve kaart van het Belgische spoorwegnet" data-testid="rail-map">
  <div class="map-canvas" bind:this={element}></div>
  {#if mapError}
    <div class="map-alert" role="alert">
      <strong>{fallbackActive ? 'Basiskaart tijdelijk onbeschikbaar' : 'Kaartfout'}</strong>
      <span>{mapError}</span>
      {#if fallbackActive}<button type="button" on:click={() => changeStyle(basemap)}>Opnieuw proberen</button>{/if}
    </div>
  {/if}
  <div class="map-legend" aria-label="Kaartlegenda">
    <span><i class="legend-rail"></i> Infrabel</span>
    <span><i class="legend-route"></i> Geselecteerde reis</span>
    <span><i class="legend-alt"></i> Alternatief</span>
  </div>
</div>
