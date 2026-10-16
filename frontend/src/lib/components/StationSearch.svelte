<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Search, MapPin, X } from '@lucide/svelte';
  import { Combobox, Portal, useListCollection } from '@skeletonlabs/skeleton-svelte';
  import { api, type Station } from '$lib/api';

  type StationItem = { label: string; value: string; station: Station };
  type Props = {
    label?: string;
    placeholder?: string;
    language?: string;
    value?: Station | null;
    onSelect?: (station: Station) => void;
  };

  let {
    label = '',
    placeholder = 'Zoek een station',
    language = 'nl',
    value = $bindable<Station | null>(null),
    onSelect = () => {}
  }: Props = $props();

  let items = $state<StationItem[]>([]);
  let query = $state('');
  let selected = $state<string[]>([]);
  let isOpen = $state(false);
  let busy = $state(false);
  let error = $state('');
  let syncedId: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let requestId = 0;

  const collection = $derived(useListCollection({
    items,
    itemToValue: (item) => item.value,
    itemToString: (item) => item.label
  }));

  // Parent actions such as swapping departure/arrival update the same input.
  $effect(() => {
    const nextId = value?.id ?? null;
    if (nextId !== syncedId) {
      syncedId = nextId;
      selected = nextId ? [nextId] : [];
      query = value?.name ?? '';
      isOpen = false;
      if (value) {
        items = [{ label: value.name, value: value.id, station: value }];
      }
    }
  });

  function cancelPending() {
    requestId++;
    clearTimeout(timer);
    controller?.abort();
    controller = undefined;
    busy = false;
  }

  function scheduleSearch(text: string) {
    cancelPending();
    error = '';
    items = [];
    const term = text.trim();
    isOpen = term.length >= 2;
    if (term.length < 2) return;

    busy = true;
    const thisRequest = requestId;
    timer = setTimeout(async () => {
      controller = new AbortController();
      const activeController = controller;
      try {
        const results = await api.stations(term, language, activeController.signal);
        if (requestId !== thisRequest || activeController.signal.aborted) return;
        items = results.map(station => ({
          label: station.name,
          value: station.id,
          station
        }));
      } catch (reason) {
        if (requestId !== thisRequest || activeController.signal.aborted) return;
        items = [];
        error = reason instanceof Error ? reason.message : 'Stations zoeken mislukt';
      } finally {
        if (requestId === thisRequest) busy = false;
      }
    }, 180);
  }

  function onInputValueChange(event: { inputValue: string }) {
    query = event.inputValue;
    if (value && query === value.name) return;
    value = null;
    syncedId = null;
    selected = [];
    scheduleSearch(query);
  }

  function onValueChange(event: { value: string[] }) {
    const id = event.value[0];
    if (!id) {
      isOpen = false;
      selected = [];
      value = null;
      syncedId = null;
      return;
    }
    const item = items.find(option => option.value === id);
    if (!item) return;
    cancelPending();
    isOpen = false;
    selected = [id];
    value = item.station;
    syncedId = id;
    query = item.label;
    onSelect(item.station);
  }

  onDestroy(cancelPending);
</script>

<div class="station-search">
  <Combobox class="w-full" {collection} {placeholder}
    open={isOpen} onOpenChange={(event) => isOpen = event.open}
    inputBehavior="autohighlight"
    inputValue={query} {onInputValueChange}
    value={selected} {onValueChange}>
    {#if label}<Combobox.Label class="field-label">{label}</Combobox.Label>{/if}
    <Combobox.Control class="w-full">
      <Combobox.Input aria-label={label || 'Station zoeken'} class="w-full" />
      <Combobox.Trigger aria-label="Toon stationsuggesties">
        {#if label}<MapPin size={16}/>{:else}<Search size={16}/>{/if}
      </Combobox.Trigger>
      <Combobox.ClearTrigger aria-label="Zoekveld wissen"><X size={15}/></Combobox.ClearTrigger>
    </Combobox.Control>
    <Portal>
      <Combobox.Positioner class="atlas-station-positioner">
        <Combobox.Content class="bg-surface-50-950 border border-surface-300-700 rounded-container max-h-80 overflow-y-auto p-1 shadow-xl">
          {#if busy}
            <li class="p-3 text-sm" role="status">Stations zoeken…</li>
          {:else if error}
            <li class="p-3 text-sm text-red-700" role="alert">{error}</li>
          {:else if items.length === 0 && query.trim().length >= 2}
            <li class="p-3 text-sm" role="status">Geen stations gevonden</li>
          {/if}
          {#each items as item (item.value)}
            <Combobox.Item {item}>
              <Combobox.ItemText>{item.label}</Combobox.ItemText>
              <Combobox.ItemIndicator />
            </Combobox.Item>
          {/each}
        </Combobox.Content>
      </Combobox.Positioner>
    </Portal>
  </Combobox>
</div>
