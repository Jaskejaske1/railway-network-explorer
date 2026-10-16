<script lang="ts">
  import { onMount } from 'svelte';
  import { TrainFront, PanelLeftClose, PanelLeftOpen, Info } from '@lucide/svelte';
  import { AppBar } from '@skeletonlabs/skeleton-svelte';
  import StationSearch from '$lib/components/StationSearch.svelte';
  import type { Station } from '$lib/api';

  export let language = 'nl';
  export let panelOpen = true;
  export let onStation: (station: Station) => void = () => {};
  export let onPanelToggle: () => void = () => {};
  export let onLanguageChange: (language: string) => void = () => {};

  let selectedStation: Station | null = null;
  let searchArea: HTMLDivElement;

  onMount(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchArea.querySelector('input')?.focus();
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  });
</script>

<AppBar class="app-header">
  <AppBar.Toolbar class="h-full w-full grid-cols-[auto_minmax(0,460px)_1fr] items-center gap-6">
    <AppBar.Lead class="min-w-0">
      <div class="brand" aria-label="Atlas Rail">
        <span class="brand-icon"><TrainFront size={25}/></span>
        <div><strong>Atlas Rail</strong><small>Belgisch spoorwegnet</small></div>
      </div>
    </AppBar.Lead>
    <AppBar.Headline class="header-search min-w-0" >
      <div bind:this={searchArea}>
        <StationSearch placeholder="Zoek een station · Ctrl K" {language}
          bind:value={selectedStation} onSelect={onStation}/>
      </div>
    </AppBar.Headline>
    <AppBar.Trail class="header-actions justify-end">
      <label class="sr-only" for="lang">Taal</label>
      <select id="lang" class="language-select" value={language} on:change={(event) => onLanguageChange(event.currentTarget.value)}>
        <option value="nl">Nederlands</option>
        <option value="fr">Français</option>
        <option value="de">Deutsch</option>
        <option value="en">English</option>
      </select>
      <button class="btn-icon hover:preset-tonal" type="button" aria-label="Over Atlas" title="Geplande NMBS-dienstregeling, geen realtime"
        on:click={() => alert('Atlas toont momenteel uitsluitend geplande NMBS GTFS-verbindingen. Realtimegegevens zijn nog niet aangesloten.')}>
        <Info size={19}/>
      </button>
      <button class="btn-icon hover:preset-tonal" type="button" aria-label={panelOpen ? 'Zijpaneel sluiten' : 'Zijpaneel openen'}
        on:click={onPanelToggle}>
        {#if panelOpen}<PanelLeftClose size={19}/>{:else}<PanelLeftOpen size={19}/>{/if}
      </button>
    </AppBar.Trail>
  </AppBar.Toolbar>
</AppBar>
