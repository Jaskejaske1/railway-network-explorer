// All defaults and limits use Europe/Brussels, regardless of browser time zone.
export function belgianNow(at = new Date()) {
  const pieces = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels', hourCycle: 'h23', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(at).map(part => [part.type, part.value]))
  return { date: `${pieces.year}-${pieces.month}-${pieces.day}`,
    time: `${pieces.hour}:${pieces.minute}` }
}

function nextDay(today) {
  const [year, month, day] = today.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

function nextDepartureFrom(now) {
  const [hour, minute] = now.time.split(':').map(Number)
  const minutes = Math.ceil((hour * 60 + minute + 5) / 5) * 5
  return { date: minutes >= 1440 ? nextDay(now.date) : now.date,
    time: `${String(Math.floor(minutes % 1440 / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}` }
}

export function initialDeparture(at = new Date()) {
  return nextDepartureFrom(belgianNow(at))
}

export function futureDepartureValid(date, time, now = belgianNow()) {
  return !!(date && time && (date > now.date || date === now.date && time > now.time))
}

export function clampToFuture(date, time, now = belgianNow()) {
  if (futureDepartureValid(date, time, now)) return { date, time }
  return nextDepartureFrom(now)
}
