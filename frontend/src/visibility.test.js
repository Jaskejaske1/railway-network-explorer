import test from 'node:test'
import assert from 'node:assert/strict'
import { applyOverlayVisibility, OVERLAY_LAYERS } from './visibility.js'

function mapMock(missing = []) {
  const changes = new Map()
  return {
    changes,
    getLayer: name => missing.includes(name) ? null : { id: name },
    setLayoutProperty: (id, property, value) => changes.set(id, { property, value }),
  }
}

test('hide all railway layers INCLUDING active routes', () => {
  const map = mapMock()
  applyOverlayVisibility(map, { showNetwork: false, showStations: true })
  for (const id of OVERLAY_LAYERS.network) {
    assert.deepEqual(map.changes.get(id), { property: 'visibility', value: 'none' })
  }
  for (const id of OVERLAY_LAYERS.stations) {
    assert.deepEqual(map.changes.get(id), { property: 'visibility', value: 'visible' })
  }
})

test('hide stations INCLUDING chosen markers and restore layers', () => {
  const map = mapMock()
  applyOverlayVisibility(map, { showNetwork: true, showStations: false })
  for (const id of OVERLAY_LAYERS.stations) {
    assert.equal(map.changes.get(id).value, 'none')
  }
  applyOverlayVisibility(map, { showNetwork: true, showStations: true })
  for (const id of OVERLAY_LAYERS.stations) {
    assert.equal(map.changes.get(id).value, 'visible')
  }
})

test('ignore not-yet-created layers', () => {
  const map = mapMock(['chosen-halo', 'route-lines'])
  applyOverlayVisibility(map, { showNetwork: false, showStations: false })
  assert.equal(map.changes.has('chosen-halo'), false)
  assert.equal(map.changes.has('route-lines'), false)
})
