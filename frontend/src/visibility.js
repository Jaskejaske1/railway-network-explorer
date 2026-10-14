// All map overlays belonging to each checkbox.  Keeping this list in one
// place prevents route highlights or selection markers from staying visible.
export const OVERLAY_LAYERS = Object.freeze({
  network: ['rail-shadow', 'rail-base', 'route-glow', 'route-lines'],
  stations: ['stations-halo', 'station-names', 'chosen-halo'],
})

export function applyOverlayVisibility(map, { showNetwork, showStations }) {
  for (const [category, visible] of [
    ['network', showNetwork],
    ['stations', showStations],
  ]) {
    for (const layerId of OVERLAY_LAYERS[category]) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
      }
    }
  }
}
