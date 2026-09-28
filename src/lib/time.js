// Time-zone helpers built on Intl — no external date library needed.

const partsCache = new Map()
function formatterFor(zone, options) {
  const key = zone + JSON.stringify(options)
  let f = partsCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, ...options })
    partsCache.set(key, f)
  }
  return f
}

const NUMERIC = {
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
}

/** Wall-clock fields of `date` as seen in `zone`. */
export function zonedParts(date, zone) {
  const parts = formatterFor(zone, NUMERIC).formatToParts(date)
  const out = {}
  for (const p of parts) if (p.type !== 'literal') out[p.type] = Number(p.value)
  // Intl renders midnight as hour 24 in some engines.
  if (out.hour === 24) out.hour = 0
  return out
}

/** Offset of `zone` from UTC at `date`, in minutes (east positive). */
export function offsetMinutes(date, zone) {
  const p = zonedParts(date, zone)
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000)
}

/** "UTC+5:30" style label. */
export function offsetLabel(date, zone) {
  const m = offsetMinutes(date, zone)
  const sign = m < 0 ? '-' : '+'
  const abs = Math.abs(m)
  const h = Math.floor(abs / 60)
  const mm = abs % 60
  return 'UTC' + sign + h + (mm ? ':' + String(mm).padStart(2, '0') : '')
}

/**
 * Short zone name, e.g. "IST", "EDT". Returns '' for zones where Intl only
 * offers a "GMT+5:30" style name, since the offset is already shown separately.
 */
export function abbreviation(date, zone) {
  const parts = formatterFor(zone, { timeZoneName: 'short' }).formatToParts(date)
  const name = parts.find((p) => p.type === 'timeZoneName')
  if (!name || /^(GMT|UTC)/.test(name.value)) return ''
  return name.value
}

/** Difference `zone` minus `baseZone`, in minutes, at `date`. */
export function diffMinutes(date, zone, baseZone) {
  return offsetMinutes(date, zone) - offsetMinutes(date, baseZone)
}

export function diffLabel(minutes) {
  if (minutes === 0) return 'Same time'
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const mm = abs % 60
  const hours = h ? h + 'h' : ''
  const mins = mm ? (h ? ' ' : '') + mm + 'm' : ''
  return sign + (hours + mins || '0h')
}

export function formatTime(date, zone, hour12) {
  return formatterFor(zone, { hour: 'numeric', minute: '2-digit', hour12 })
    .format(date)
    .replace(/ /g, ' ')
}

export function formatSeconds(date, zone) {
  return formatterFor(zone, { second: '2-digit', hour12: false }).format(date)
}

export function formatDate(date, zone) {
  return formatterFor(zone, { weekday: 'short', month: 'short', day: 'numeric' }).format(date)
}

export function formatFullDate(date, zone) {
  return formatterFor(zone, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

/** Fractional hour-of-day (0–24) in `zone`, for sun-position visuals. */
export function hourFraction(date, zone) {
  const p = zonedParts(date, zone)
  return p.hour + p.minute / 60 + p.second / 3600
}

/**
 * Calendar-day offset of `zone` relative to `baseZone`: -1, 0 or +1.
 * Used to show "Yesterday" / "Tomorrow" badges.
 */
export function dayShift(date, zone, baseZone) {
  const a = zonedParts(date, zone)
  const b = zonedParts(date, baseZone)
  const da = Date.UTC(a.year, a.month - 1, a.day)
  const db = Date.UTC(b.year, b.month - 1, b.day)
  return Math.round((da - db) / 86400000)
}

export const PERIODS = [
  { key: 'night', label: 'Night', icon: '\u{1F319}', from: 0, to: 6 },
  { key: 'morning', label: 'Morning', icon: '\u{1F305}', from: 6, to: 12 },
  { key: 'day', label: 'Afternoon', icon: '☀️', from: 12, to: 18 },
  { key: 'evening', label: 'Evening', icon: '\u{1F306}', from: 18, to: 22 },
  { key: 'night', label: 'Night', icon: '\u{1F319}', from: 22, to: 24 },
]

export function periodFor(hour) {
  return PERIODS.find((p) => hour >= p.from && hour < p.to) || PERIODS[0]
}

/** Rough working-hours classification used by the meeting planner strip. */
export function slotQuality(hour) {
  if (hour >= 9 && hour < 18) return 'good'
  if ((hour >= 7 && hour < 9) || (hour >= 18 && hour < 22)) return 'ok'
  return 'bad'
}

/**
 * Build a Date whose wall-clock time in `zone` matches the given fields.
 * Solves for the instant by correcting with the zone offset twice, which
 * handles DST boundaries correctly for all but the skipped hour.
 */
export function zonedTimeToDate({ year, month, day, hour, minute }, zone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0)
  let date = new Date(guess - offsetMinutes(new Date(guess), zone) * 60000)
  date = new Date(guess - offsetMinutes(date, zone) * 60000)
  return date
}

/** "HH:MM" in `zone`, zero-padded — the format an <input type="time"> expects. */
export function formatHHMM(date, zone) {
  const p = zonedParts(date, zone)
  return String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0')
}

/** Calendar arithmetic on a "YYYY-MM-DD" string, free of any time zone. */
export const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + n))
  return next.toISOString().slice(0, 10)
}

/** "YYYY-MM-DD" in `zone` — the format an <input type="date"> expects. */
export function formatYMD(date, zone) {
  const p = zonedParts(date, zone)
  return (
    p.year + '-' + String(p.month).padStart(2, '0') + '-' + String(p.day).padStart(2, '0')
  )
}

/**
 * Whether the wall-clock time asked for actually exists in `zone`, and what
 * the app is showing instead. On a spring-forward day 02:30 does not exist;
 * on a fall-back day 01:30 happens twice.
 */
export function dstNote(ymd, hhmm, zone) {
  if (!ymd || !hhmm) return null
  const [year, month, day] = ymd.split('-').map(Number)
  const [hour, minute] = hhmm.split(':').map(Number)
  const date = zonedTimeToDate({ year, month, day, hour, minute }, zone)
  const landed = formatHHMM(date, zone)

  if (landed !== hhmm) return { kind: 'skipped', asked: hhmm, shown: landed }

  // Ambiguous: an instant an hour either side shows the same wall clock, which
  // only happens when the zone falls back and repeats the hour.
  const neighbours = [date.getTime() - 3600000, date.getTime() + 3600000]
  if (neighbours.some((t) => formatHHMM(new Date(t), zone) === hhmm)) {
    return { kind: 'repeated', asked: hhmm }
  }

  return null
}
