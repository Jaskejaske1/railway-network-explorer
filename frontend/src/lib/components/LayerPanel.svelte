<script lang="ts">
  import { Layers3, Building2, TrainFront } from '@lucide/svelte';
  export let basemap: 'liberty' | 'bright' | 'positron' = 'liberty';
  export let perspective = false;
  export let showNetwork = true;
  export let showStations = true;
  export let showJourney = true;
  export let railOpacity = 0.8;
</script>
<div class="layer-panel" role="group" aria-label="Kaartlagen">
  <div class="layer-heading"><Layers3 size={18}/><strong>Kaartlagen</strong></div>
  <label class="field-label" for="basemap-select">Basiskaart</label>
  <select id="basemap-select" class="native-select" bind:value={basemap}>
    <option value="liberty">Liberty · geografisch</option>
    <option value="bright">Bright · meer contrast</option>
    <option value="positron">Positron · rustig</option>
  </select>
  <div class="layer-separator"></div>
  <label class="switch-row"><span><TrainFront size={17}/>Infrabel-netwerk</span><input type="checkbox" bind:checked={showNetwork}/></label>
  <label class="field-label" for="opacity">Transparantie spoorlijnen</label>
  <input id="opacity" type="range" min="0.2" max="1" step="0.1" bind:value={railOpacity} disabled={!showNetwork}/>
  <label class="switch-row"><span>Stations</span><input type="checkbox" bind:checked={showStations}/></label>
  <label class="switch-row"><span>Geselecteerde reis</span><input type="checkbox" bind:checked={showJourney}/></label>
  <div class="layer-separator"></div>
  <label class="switch-row"><span><Building2 size={17}/>3D-gebouwen en perspectief</span>
    <input type="checkbox" bind:checked={perspective}/></label>
  <p class="detail-note">Gebouwhoogtes worden alleen getoond waar geografische brongegevens beschikbaar zijn.</p>
  <p class="detail-note">Kaartgegevens: © OpenStreetMap-bijdragers, via OpenFreeMap.</p>
</div>
