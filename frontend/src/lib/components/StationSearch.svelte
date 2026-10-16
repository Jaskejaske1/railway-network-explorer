<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Search, MapPin, X } from '@lucide/svelte';
  import { api, type Station } from '$lib/api';

  export let label = '';
  export let placeholder = 'Zoek een station';
  export let language = 'nl';
  export let value: Station | null = null;
  export let onSelect: (station: Station) => void = () => {};

  let query = '';
  let suggestions: Station[] = [];
  let open = false;
  let busy = false;
  let error = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let selectedId = '';

  $: if (value?.id !== selectedId) {
    selectedId = value?.id ?? '';
    query = value?.name ?? '';
  }

  function search(text: string) {
    query = text;
    value = null;
    selectedId = '';
    error = '';
    controller?.abort();
    clearTimeout(timer);
    if (text.trim().length < 2) { suggestions = []; open = false; busy = false; return; }
    open = true;
    busy = true;
    timer = setTimeout(async () => {
      controller = new AbortController();
      try {
        suggestions = await api.stations(text.trim(), language, controller.signal);
        error = '';
      } catch (reason) {
        if (controller.signal.aborted) return;
        error = reason instanceof Error ? reason.message : 'Zoeken mislukt';
        suggestions = [];
      } finally { if (!controller.signal.aborted) busy = false; }
    }, 180);
  }

  function choose(station: Station) {
    value = station;
    selectedId = station.id;
    query = station.name;
    open = false;
    suggestions = [];
    onSelect(station);
  }

  function clear() {
    value = null; selectedId = ''; query = ''; suggestions = []; open = false;
    controller?.abort(); clearTimeout(timer);
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') { open = false; return; }
    if (event.key === 'Enter' && open && suggestions[0]) {
      event.preventDefault(); choose(suggestions[0]);
    }
  }

  onDestroy(() => { clearTimeout(timer); controller?.abort(); });
</script>

<div class="station-search">
  {#if label}<label class="field-label" for={'station-' + label}>{label}</label>{/if}
  <div class="search-field">
    {#if label}<MapPin size={17} aria-hidden="true" />{:else}<Search size={17} aria-hidden="true" />{/if}
    <input id={label ? 'station-' + label : undefined} type="search" autocomplete="off"
      aria-label={label || 'Station zoeken'} aria-expanded={open} aria-autocomplete="list" aria-controls={'station-options-' + (label || 'global')}
      role="combobox" placeholder={placeholder} bind:value={query}
      on:input={(event) => search(event.currentTarget.value)} on:keydown={keydown}
      on:focus={() => { if (suggestions.length) open = true; }} />
    {#if query}<button class="clear-control" type="button" aria-label="Zoekveld wissen" on:click={clear}><X size={15}/></button>{/if}
  </div>
  {#if open}
    <div id={'station-options-' + (label || 'global')} class="suggestions" role="listbox" aria-label="Stationsuggesties">
      {#if busy}<div class="suggestion-note" role="status">Stations zoeken…</div>
      {:else if error}<div class="suggestion-note error" role="alert">{error}</div>
      {:else if suggestions.length === 0}<div class="suggestion-note">Geen stations gevonden</div>
      {:else}
        {#each suggestions as station (station.id)}
          <button type="button" role="option" aria-selected={false} class="suggestion-item"
            on:click={() => choose(station)}>
            <MapPin size={16} aria-hidden="true" />
            <span>{station.name}</span>
            {#if station.original_name && station.original_name !== station.name}
              <small>{station.original_name}</small>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>
