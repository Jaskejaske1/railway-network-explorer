import test from 'node:test'
import assert from 'node:assert/strict'
import { belgianNow, initialDeparture, futureDepartureValid, clampToFuture } from './travelDate.js'

test('Europe/Brussels local time is used rather than host UTC', () => {
  assert.deepEqual(belgianNow(new Date('2026-10-14T20:45:00Z')),
    {date:'2026-10-14', time:'22:45'})
})

test('initial date/time are later than now, including rollover at midnight', () => {
  assert.deepEqual(initialDeparture(new Date('2026-10-14T21:58:00Z')),
    {date:'2026-10-15', time:'00:05'})
})

test('past departure cannot be selected; tomorrow is accepted', () => {
  const now = {date:'2026-10-14',time:'22:45'}
  assert.equal(futureDepartureValid('2026-10-13','09:00',now),false)
  assert.equal(futureDepartureValid('2026-10-14','08:00',now),false)
  assert.equal(futureDepartureValid('2026-10-15','08:00',now),true)
  assert.deepEqual(clampToFuture('2026-10-14','08:00',now), {date:'2026-10-14',time:'22:50'})
})
