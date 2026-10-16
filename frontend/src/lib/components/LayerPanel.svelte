<script lang="ts">
  import { Layers3, Building2, TrainFront } from '@lucide/svelte';
  import { Switch, Slider } from '@skeletonlabs/skeleton-svelte';

  export let basemap: 'liberty' | 'bright' | 'positron' = 'liberty';
  export let perspective = false;
  export let showNetwork = true;
  export let showStations = true;
  export let showJourney = true;
  export let railOpacity = 0.8;
</script>

<section class="grid gap-4" aria-label="Kaartlagen">
  <div class="flex items-center gap-2 font-semibold text-base">
    <Layers3 size={18} aria-hidden="true"/>
    <h2>Kaartlagen</h2>
  </div>
  <div class="grid gap-2">
    <label class="field-label" for="basemap-select">Basiskaart</label>
    <select id="basemap-select" class="native-select" bind:value={basemap}>
      <option value="liberty">Liberty · geografisch</option>
      <option value="bright">Bright · meer contrast</option>
      <option value="positron">Positron · rustig</option>
    </select>
  </div>

  <hr class="hr" />
  <Switch class="flex w-full items-center justify-between" checked={showNetwork}
    onCheckedChange={(details) => showNetwork = details.checked}>
    <Switch.Label class="flex items-center gap-2 text-sm"><TrainFront size={16}/>Infrabel-netwerk</Switch.Label>
    <Switch.Control><Switch.Thumb/></Switch.Control>
    <Switch.HiddenInput/>
  </Switch>

  <Slider min={20} max={100} step={10} disabled={!showNetwork} value={[Math.round(railOpacity * 100)]}
    onValueChange={(details) => railOpacity = details.value[0] / 100}>
    <Slider.Label class="text-xs">Sterkte spoorlijnen ({Math.round(railOpacity * 100)}%)</Slider.Label>
    <Slider.Control>
      <Slider.Track><Slider.Range/></Slider.Track>
      <Slider.Thumb index={0}><Slider.HiddenInput/></Slider.Thumb>
    </Slider.Control>
  </Slider>

  <Switch class="flex w-full items-center justify-between" checked={showStations}
    onCheckedChange={(details) => showStations = details.checked}>
    <Switch.Label class="text-sm">Stations</Switch.Label>
    <Switch.Control><Switch.Thumb/></Switch.Control>
    <Switch.HiddenInput/>
  </Switch>
  <Switch class="flex w-full items-center justify-between" checked={showJourney}
    onCheckedChange={(details) => showJourney = details.checked}>
    <Switch.Label class="text-sm">Geselecteerde reis</Switch.Label>
    <Switch.Control><Switch.Thumb/></Switch.Control>
    <Switch.HiddenInput/>
  </Switch>

  <hr class="hr" />
  <Switch class="flex w-full items-center justify-between" checked={perspective}
    onCheckedChange={(details) => perspective = details.checked}>
    <Switch.Label class="flex items-center gap-2 text-sm"><Building2 size={16}/>3D-gebouwen en perspectief</Switch.Label>
    <Switch.Control><Switch.Thumb/></Switch.Control>
    <Switch.HiddenInput/>
  </Switch>
  <p class="text-xs opacity-70">Gebouwhoogtes worden getoond waar de geodata beschikbaar is.</p>
  <p class="text-xs opacity-70">© OpenStreetMap-bijdragers, via OpenFreeMap.</p>
</section>
