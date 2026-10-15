import test from 'node:test'
import assert from 'node:assert/strict'
import { initialState, plannerReducer } from './plannerState.js'
const leuven = { id: 'A', name: 'Leuven' }
const weerde = { id: 'B', name: 'Weerde' }
test('swapping reverses stops but keeps the VIA constraint and timetable inputs', () => {
  const before = { ...initialState, from: leuven, to: weerde, via: { id: 'C', name: 'Bordet' } }
  const after = plannerReducer(before, { type: 'swap' })
  assert.equal(after.from.id, 'B')
  assert.equal(after.to.id, 'A')
  assert.equal(after.via.id, 'C')
  assert.equal(after.date, before.date)
})
test('examples select identifiers and clear previous VIA constraint', () => {
  const state = plannerReducer({ ...initialState, via: { id: 'C' } }, { type: 'example', value: { from: leuven, to: weerde } })
  assert.equal(state.via, null)
  assert.equal(state.from.id, 'A')
})
test('localisation renames all selected stations but does not modify their IDs', () => {
  const state = plannerReducer({ ...initialState, from: leuven, to: weerde, via: { id: 'C', name: 'Bordet' } }, { type: 'localized', value: new Map([['A', 'Louvain'], ['C', 'Bordet']]) })
  assert.equal(state.from.id, 'A')
  assert.equal(state.from.name, 'Louvain')
  assert.equal(state.to.name, 'Weerde')
})
