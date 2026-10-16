<script lang="ts">
  import { onMount } from 'svelte';
  import { TrainFront, Layers3, PanelLeftClose, PanelLeftOpen, ArrowLeft,
    ArrowLeftRight, Box, Map as MapIcon, Search, Info, ChevronDown } from '@lucide/svelte';
  import { api, EMPTY, type Station, type GeoCollection, type Journey, type Feed, type NetworkMeta } from '$lib/api';
  import { initialDeparture, isFuture } from '$lib/date';
  import RailMap from '$lib/components/RailMap.svelte';
  import StationSearch from '$lib/components/StationSearch.svelte';
  import ConnectionList from '$lib/components/ConnectionList.svelte';
  import LayerPanel from '$lib/components/LayerPanel.svelte';

  type Inspection = { kind: 'station'; station: Station } |
    { kind: 'segment'; segment: Record<string, unknown> };

  let from: Station | null = null;
  let to: Station | null = null;
  let language = 'nl';
  let date = initialDeparture().date;
  let time = initialDeparture().time;
  let network: GeoCollection = EMPTY;
  let stations: GeoCollection = EMPTY;
  let feed: Feed | null = null;
  let meta: NetworkMeta | null = null;
  let journeys: Journey[] = [];
  let selectedJourney = 0;
  let searched = false;
  let busy = false;
  let error = '';
  let dataError = '';
  let inspected: Inspection | null = null;
  let focus: Station | null = null;
  let plannerCollapsed = false;
  let panelOpen = true;
  let layersOpen = false;
  let basemap: 'liberty' | 'bright' | 'positron' = 'liberty';
  let perspective = false;
  let showNetwork = true;
  let showStations = true;
  let showJourney = true;
  let railOpacity = 0.8;
  let searchTarget = 'from';
  let headerSearch: Station | null = null;

  $: validDeparture = isFuture(date, time);
  $: feedValid = !!feed?.available && (!feed.feed?.end_date || date <= feed.feed.end_date) &&
    (!feed.feed?.start_date || date >= feed.feed.start_date);

  function invalidate() {
    searched = false; journeys = []; selectedJourney = 0; plannerCollapsed = false; error = '';
  }
  function swap() {
    const other = from; from = to; to = other; invalidate();
  }
  function selectStation(station: Station, target: string) {
    if (target === 'to') to = station;
    else from = station;
    invalidate();
    inspected = null;
  }
  function chooseInspected(target: 'from' | 'to') {
    if (inspected?.kind === 'station') selectStation(inspected.station, target);
  }
  function inspect(station: Station) {
    inspected = { kind: 'station', station };
    focus = { ...station };
    panelOpen = true;
  }
  function inspectSegment(segment: Record<string, unknown>) {
    inspected = { kind: 'segment', segment };
    panelOpen = true;
  }
  async function findJourneys() {
    if (!from || !to || from.id === to.id || !feedValid || !validDeparture) return;
    busy = true; error = '';
    try {
      const result = await api.journeys(from.id, to.id, date, time, language);
      journeys = result.journeys;
      searched = true;
      selectedJourney = 0;
      plannerCollapsed = true;
      inspected = null;
    } catch (reason) {
      journeys = [];
      searched = true;
      error = reason instanceof Error ? reason.message : String(reason);
    } finally { busy = false; }
  }

  onMount(() => {
    const previousLanguage = localStorage.getItem('atlas-language');
    if (previousLanguage && ['nl', 'fr', 'en', 'de'].includes(previousLanguage)) language = previousLanguage;
    const defaults = initialDeparture();
    date = defaults.date; time = defaults.time;

    Promise.allSettled([api.feed(), api.meta(), api.network(), api.mapStations(language)])
      .then((results) => {
        if (results[0].status === 'fulfilled') feed = results[0].value;
        if (results[1].status === 'fulfilled') meta = results[1].value;
        if (results[2].status === 'fulfilled') network = results[2].value;
        if (results[3].status === 'fulfilled') stations = results[3].value;
        const failures = results.filter(item => item.status === 'rejected');
        if (failures.length) dataError = 'Niet alle gegevens konden geladen worden. Controleer de API en geïmporteerde datasets.';
      });

    const shortcuts = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        (document.querySelector('.header-search input') as HTMLInputElement | null)?.focus();
      }
    };
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  });

  async function changeLanguage(next: string) {
    language = next;
    localStorage.setItem('atlas-language', language);
    try { stations = await api.mapStations(language); }
    catch { dataError = 'Stations konden niet opnieuw geladen worden.'; }
    invalidate();
  }
</script>

<svelte:head>
  <title>Atlas Rail · Belgisch spoorwegnet</title>
  <meta name="description" content="Verken het Belgische spoorwegnet en plan treinverbindingen."/>
</svelte:head>

<div class="atlas-shell">
  <header class="app-header">
    <div class="brand" aria-label="Atlas Rail">
      <span class="brand-icon"><TrainFront size={25}/></span>
      <div><strong>Atlas Rail</strong><small>Belgisch spoorwegnet</small></div>
    </div>
    <div class="header-search">
      <StationSearch placeholder="Zoek een station · Ctrl K" language={language}
        bind:value={headerSearch} onSelect={inspect}/>
    </div>
    <div class="header-actions">
      <label class="sr-only" for="lang">Taal</label>
      <select id="lang" class="language-select" value={language} on:change={(e) => changeLanguage(e.currentTarget.value)}>
        <option value="nl">Nederlands</option>
        <option value="fr">Français</option>
        <option value="de">Deutsch</option>
        <option value="en">English</option>
      </select>
      <button class="icon-button" type="button" aria-label="Over Atlas" title="Geplande NMBS-dienstregeling, geen realtime"
        on:click={() => alert('Atlas toont momenteel uitsluitend geplande NMBS GTFS-verbindingen. Realtimegegevens zijn nog niet aangesloten.')}>
        <Info size={19}/>
      </button>
      <button class="icon-button" type="button" aria-label={panelOpen ? 'Zijpaneel sluiten' : 'Zijpaneel openen'}
        on:click={() => panelOpen = !panelOpen}>
        {#if panelOpen}<PanelLeftClose size={19}/>{:else}<PanelLeftOpen size={19}/>{/if}
      </button>
    </div>
  </header>

  <div class="app-workspace">
    {#if panelOpen}
      <aside class="sidebar" aria-label="Reisplanner en details">
        <div class="sidebar-content">
          {#if inspected}
            <button class="link-button back-link" type="button" on:click={() => inspected = null}>
              <ArrowLeft size={16}/> Terug naar mijn reis
            </button>
            {#if inspected.kind === 'station'}
              <p class="eyebrow">STATION</p>
              <h1>{inspected.station.name}</h1>
              <p class="subtle">NMBS-station · {inspected.station.lat.toFixed(5)}, {inspected.station.lon.toFixed(5)}</p>
              <div class="action-row">
                <button class="primary-button" type="button" on:click={() => chooseInspected('from')}>Vertrek hier</button>
                <button class="secondary-button" type="button" on:click={() => chooseInspected('to')}>Aankomst hier</button>
              </div>
              <p class="detail-note">Realtime vertrekborden zijn nog niet aangesloten.</p>
            {:else}
              <p class="eyebrow">INFRASTRUCTUUR</p>
              <h1>{String(inspected.segment.from_name ?? '')} – {String(inspected.segment.to_name ?? '')}</h1>
              <p class="subtle">Infrabel-netwerksegment · {Number(inspected.segment.distance_km ?? 0).toFixed(2)} km</p>
              <p class="detail-note">Vereenvoudigde spoorgeometrie; niet noodzakelijk de exacte fysieke spoorligging.</p>
            {/if}
          {:else}
            <section class="planner-section" aria-labelledby="planner-title">
              <div class="section-title">
                <h1 id="planner-title">Plan je treinreis</h1>
                {#if plannerCollapsed}<button class="link-button" type="button" on:click={() => plannerCollapsed = false}>Wijzigen</button>{/if}
              </div>
              {#if plannerCollapsed}
                <div class="journey-summary"><strong>{from?.name} – {to?.name}</strong><small>{date} · vanaf {time}</small></div>
              {:else}
                {#if feed && !feed.available}<p class="notice">Geen NMBS GTFS-feed geïmporteerd.</p>{/if}
                <StationSearch label="Van" placeholder="Vertrekstation" language={language} bind:value={from} onSelect={invalidate}/>
                <button type="button" class="swap-button" on:click={swap} aria-label="Wissel vertrek en aankomst"><ArrowLeftRight size={17}/></button>
                <StationSearch label="Naar" placeholder="Aankomststation" language={language} bind:value={to} onSelect={invalidate}/>
                <div class="form-two">
                  <label class="field-label">Reisdatum
                    <input class="native-input" type="date" bind:value={date} min={initialDeparture().date}
                      max={feed?.feed?.end_date || undefined} on:change={invalidate}/>
                  </label>
                  <label class="field-label">Vertrek vanaf
                    <input class="native-input" type="time" bind:value={time} on:change={invalidate}/>
                  </label>
                </div>
                {#if from && to && from.id === to.id}<p class="form-error">Vertrek en aankomst moeten verschillen.</p>{/if}
                {#if !validDeparture}<p class="form-error">Kies een vertrektijd in de toekomst.</p>{/if}
                <button class="primary-button submit" type="button" disabled={!from || !to || from.id === to.id || !feedValid || !validDeparture || busy}
                  on:click={findJourneys}>{busy ? 'Reizen zoeken…' : 'Zoek reizen'}</button>
              {/if}
            </section>
            <div class="sidebar-divider"></div>
            {#if dataError}<p class="form-error" role="alert">{dataError}</p>{/if}
            {#if error}<p class="form-error" role="alert">{error}</p>{/if}
            {#if journeys.length}
              <ConnectionList {journeys} selected={selectedJourney} onSelect={(index) => selectedJourney = index}/>
            {:else}
              <div class="empty-results">
                <h2>Treinverbindingen</h2>
                <p>{searched ? 'Geen verbindingen gevonden voor deze periode.' : 'Kies een vertrek- en aankomststation om verbindingen te bekijken.'}</p>
              </div>
            {/if}
            <div class="sidebar-footer">
              <p>Geplande NMBS GTFS-ritten · nog geen realtimegegevens.</p>
              <p>{meta?.segments == null ? 'Infrabel-netwerk' : meta.segments + ' Infrabel-segmenten'} · benaderde routegeometrie</p>
            </div>
          {/if}
        </div>
      </aside>
    {/if}

    <main class="map-area" aria-label="Kaartweergave">
      <RailMap {network} {stations} {journeys} {selectedJourney} {from} {to} {focus}
        {perspective} {basemap} {showNetwork} {showJourney} {showStations} {railOpacity}
        onStation={inspect} onSegment={inspectSegment}/>
      <div class="map-tools">
        <button class="map-tool" type="button" aria-expanded={layersOpen} aria-label="Kaartlagen"
          on:click={() => layersOpen = !layersOpen}><Layers3 size={19}/></button>
        <button class="map-tool" type="button" aria-label={perspective ? 'Terug naar 2D' : 'Schakel naar 3D'}
          on:click={() => perspective = !perspective}>{#if perspective}<MapIcon size={19}/>{:else}<Box size={19}/>{/if}</button>
      </div>
      {#if layersOpen}
        <div class="map-layer-flyout">
          <LayerPanel bind:basemap bind:perspective bind:showNetwork bind:showStations bind:showJourney bind:railOpacity/>
        </div>
      {/if}
    </main>
  </div>
</div>
