// Each layer answers its own question. Turning off the physical tracks
// never hides the (schematic) selected train itinerary.
export const OVERLAY_LAYERS = Object.freeze({
  network: ['rail-shadow', 'rail-base'],
  journey: ['route-glow', 'route-lines', 'route-fallback'],
  stations: ['stations-halo', 'station-names', 'chosen-halo'],
})

export function applyOverlayVisibility(map, { showNetwork, showJourney, showStations }) {
  for (const [group, visible] of [
    ['network', showNetwork],
    ['journey', showJourney],
    ['stations', showStations],
  ]) {
    for (const id of OVERLAY_LAYERS[group]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
  }
}
