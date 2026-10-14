import test from 'node:test'
import assert from 'node:assert/strict'
import { applyOverlayVisibility, OVERLAY_LAYERS } from './visibility.js'

function mock(missing = []) {
  const changes = new Map()
  return { changes, getLayer: name => missing.includes(name) ? null : { id: name },
    setLayoutProperty: (id, property, value) => changes.set(id, { property, value }) }
}

test('hide infrastructure while keeping journey and stations', () => {
  const map = mock()
  applyOverlayVisibility(map, { showNetwork: false, showJourney: true, showStations: true })
  for (const id of OVERLAY_LAYERS.network) assert.equal(map.changes.get(id).value, 'none')
  for (const id of OVERLAY_LAYERS.journey) assert.equal(map.changes.get(id).value, 'visible')
  for (const id of OVERLAY_LAYERS.stations) assert.equal(map.changes.get(id).value, 'visible')
})

test('hide journey without hiding tracks', () => {
  const map = mock()
  applyOverlayVisibility(map, { showNetwork: true, showJourney: false, showStations: true })
  for (const id of OVERLAY_LAYERS.journey) assert.equal(map.changes.get(id).value, 'none')
  for (const id of OVERLAY_LAYERS.network) assert.equal(map.changes.get(id).value, 'visible')
})

test('hide and restore selected markers with stations', () => {
  const map = mock()
  applyOverlayVisibility(map, { showNetwork: true, showJourney: true, showStations: false })
  for (const id of OVERLAY_LAYERS.stations) assert.equal(map.changes.get(id).value, 'none')
  applyOverlayVisibility(map, { showNetwork: true, showJourney: true, showStations: true })
  for (const id of OVERLAY_LAYERS.stations) assert.equal(map.changes.get(id).value, 'visible')
})

test('not-yet-created map layers are ignored', () => {
  const map = mock(['chosen-halo', 'route-lines'])
  applyOverlayVisibility(map, { showNetwork: false, showJourney: false, showStations: false })
  assert.equal(map.changes.has('chosen-halo'), false)
  assert.equal(map.changes.has('route-lines'), false)
})
