// Use Belgian civil time even when the browser or Node process is in UTC.
export function belgianNow(at: Date = new Date()) {
  const pieces = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels', hourCycle: 'h23', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).formatToParts(at).map(part => [part.type, part.value]));
  return { date: pieces.year + '-' + pieces.month + '-' + pieces.day,
    time: pieces.hour + ':' + pieces.minute };
}
function tomorrow(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}
export function initialDeparture(at = new Date()) {
  const now = belgianNow(at);
  const [hh, mm] = now.time.split(':').map(Number);
  const minutes = Math.ceil((hh * 60 + mm + 5) / 5) * 5;
  return { date: minutes >= 1440 ? tomorrow(now.date) : now.date,
    time: String(Math.floor((minutes % 1440) / 60)).padStart(2, '0') + ':' +
      String(minutes % 60).padStart(2, '0') };
}
export function isFuture(date: string, time: string, now = belgianNow()) {
  return Boolean(date && time && (date > now.date || (date === now.date && time > now.time)));
}
