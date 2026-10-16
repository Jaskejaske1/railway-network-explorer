<script lang="ts">
  import { Clock3, ChevronDown, ChevronUp, TrainFront, ArrowRight } from 'lucide-svelte';
  import type { Journey } from '$lib/api';

  export let journeys: Journey[] = [];
  export let selected = 0;
  export let onSelect: (index: number) => void = () => {};
  let expanded = -1;
</script>

<section class="connections" aria-label="Treinverbindingen">
  <div class="section-title">
    <h2>Treinverbindingen</h2>
    {#if journeys.length}<span class="count-label">{journeys.length} opties</span>{/if}
  </div>
  {#each journeys as journey, index (index)}
    <article class:active={selected === index} class="connection-card">
      <button class="connection-header" type="button" aria-pressed={selected === index} on:click={() => onSelect(index)}>
        <div class="connection-timing"><span>{journey.departure}</span><ArrowRight size={16} /><span>{journey.arrival}</span></div>
        <div class="connection-meta"><TrainFront size={15}/>
          {journey.transfer_count === 0 ? 'Rechtstreeks' : journey.transfer_count + ' overstap' + (journey.transfer_count > 1 ? 'pen' : '')}
          {#if journey.transfer_stations.length} · {journey.transfer_stations.join(', ')}{/if}
        </div>
      </button>
      {#if selected === index}
        <div class="connection-body">
          {#each journey.legs as leg, legIndex (legIndex)}
            <div class="leg">
              <div class="leg-times"><Clock3 size={14}/><strong>{leg.departure} – {leg.arrival}</strong></div>
              <div class="leg-names">{leg.from_name} – {leg.to_name}</div>
              <div class="leg-sub">Trein {leg.route || leg.trip_id}{leg.headsign ? ' · richting ' + leg.headsign : ''}</div>
              {#if legIndex < journey.legs.length - 1}
                <div class="transfer">Overstap in {leg.to_name}</div>
              {/if}
              {#if expanded === index}
                <ol class="stop-list">{#each leg.stop_names ?? [] as stop, stopIndex (stopIndex)}<li>{stop}</li>{/each}</ol>
              {/if}
            </div>
          {/each}
          <button class="link-button" type="button" aria-expanded={expanded === index}
            on:click={() => expanded = expanded === index ? -1 : index}>
            {#if expanded === index}<ChevronUp size={15}/>{:else}<ChevronDown size={15}/>{/if}
            {expanded === index ? 'Verberg tussenhaltes' : 'Toon tussenhaltes'}
          </button>
          {#if (journey.geometry_quality?.schematic_fallbacks ?? 0) > 0}
            <p class="detail-note">Sommige trajectdelen zijn schematisch weergegeven.</p>
          {/if}
        </div>
      {/if}
    </article>
  {/each}
</section>
