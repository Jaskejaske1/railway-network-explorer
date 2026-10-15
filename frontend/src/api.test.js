import test from 'node:test'
import assert from 'node:assert/strict'
import { api, journeyPath, stationSearchPath } from './api.js'
test('route query encodes identifiers and optional transfer safely', () => {
  const path = journeyPath({ from: 'S:a&b', to: 'S:c', date: '2026-10-20', time: '08:00', language: 'fr', via: 'S:via' })
  const parsed = new URL(path, 'http://localhost')
  assert.equal(parsed.searchParams.get('from_id'), 'S:a&b')
  assert.equal(parsed.searchParams.get('via_transfer_id'), 'S:via')
})
test('station lookup escapes special query characters', () => {
  assert.equal(new URL(stationSearchPath('Lou & vain', 'nl'), 'http://localhost').searchParams.get('search'), 'Lou & vain')
})
test('API rejects HTML gateway errors instead of misreporting a JSON response', async () => {
  const old = globalThis.fetch
  try {
    globalThis.fetch = async () => ({ ok: false, headers: { get: () => 'text/html' }, json: () => { throw new Error('should not parse HTML') } })
    await assert.rejects(api('/api/health'), /geen geldige API-respons/)
  } finally { globalThis.fetch = old }
})
