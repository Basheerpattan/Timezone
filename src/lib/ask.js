// Turns a typed question into converter state — entirely in the browser.
//
//   "3pm London in Tokyo"              → from London at 15:00, to Tokyo
//   "tokyo time at 9am in nyc"         → the time belongs to NYC, not Tokyo
//   "NYC to Kolkata tomorrow 9:30"     → a date as well as a time
//   "time in Sydney"                   → one city: show it live
//   "difference between Dubai and LA"  → two cities, no time: live
//
// No model and no network: the pieces people type are few (times, dates, city
// names, a handful of joining words), so a small tokenizer covers them and the
// existing city search does the fuzzy part.
import { findAbbreviation } from '../data/abbreviations.js'
import { cityAtOffset, detectLocal, findCountry, fuzzyCities, searchCities } from '../data/cities.js'
import { fuzzyPlaces, loadPlaces, searchPlaces } from '../data/places.js'
import { squash } from './fuzzy.js'
import { addDays, formatHHMM, formatYMD } from './time.js'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const pad = (n) => String(n).padStart(2, '0')

const TIME =
  /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.?|p\.m\.?)(?![a-z])|\b([01]?\d|2[0-3]):([0-5]\d)\b|\b(noon|midday|midnight)\b/
const NOW = /\b(right now|now|currently|current)\b/
const DATE_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/
const MONTH_NAMES = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?'
const DATE_MD = new RegExp('\\b' + MONTH_NAMES + '\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b')
const DATE_DM = new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + MONTH_NAMES)
const RELATIVE = /\b(today|tonight|tomorrow|tmrw|yesterday)\b/
const WEEKDAY = /\b(next\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday)?\b/

// "UTC+5:30", "gmt -4", "UTC+0545". Pulled out before times are parsed, or
// the "5:30" would be read as half past five.
const OFFSET = /\b(?:utc|gmt)\s*([+\-−])\s*(\d{1,2})(?::?(\d{2}))?\b/g
const OFFSET_TOKEN = /^__off_([pm])(\d+)__$/

const LOCAL = /\b(my (?:time ?zone|timezone|time|place|city)|local time|where i am|here)\b/g

// Words that join two places. Recorded, because "3pm in London" and
// "3pm London to Tokyo" attach the time to different cities.
const JOINER = /\s*(?:\b(?:in|to|vs|versus|and|from|at|on|for|into)\b|->|→|=>|,|\?|\.|;)\s*/g

// Everything else a question is padded with.
const FILLER = new Set(
  (
    "what whats what's which time times is it its it's when will be there the a an of " +
    'convert conversion show me tell please difference between how many hours ahead behind ' +
    "clock o'clock oclock do does if would should i have my schedule meeting call o " +
    'zone timezone equals equal same compared hi hello hey hiya thanks thank you ok okay ' +
    'weather today date day there can could get find give know want need'
  ).split(' ')
)

function parseTime(text) {
  const m = TIME.exec(text)
  if (!m) return null
  let hour
  let minute = 0
  if (m[6]) {
    hour = m[6] === 'midnight' ? 0 : 12
  } else if (m[1]) {
    hour = Number(m[1])
    minute = Number(m[2] || 0)
    if (hour < 1 || hour > 12 || minute > 59) return null
    const pm = m[3].startsWith('p')
    if (hour === 12) hour = pm ? 12 : 0
    else if (pm) hour += 12
  } else {
    hour = Number(m[4])
    minute = Number(m[5])
  }
  return { match: m, hhmm: pad(hour) + ':' + pad(minute) }
}

/**
 * A date, as a function of the zone it is read in — "tomorrow" in Tokyo can be
 * a different calendar day from "tomorrow" in Los Angeles.
 */
function parseDate(text) {
  let m = DATE_ISO.exec(text)
  if (m) return { match: m, resolve: () => m[0] }

  const monthDay = (monthWord, day) => (zone) => {
    const year = formatYMD(new Date(), zone).slice(0, 4)
    return year + '-' + pad(MONTHS.indexOf(monthWord.slice(0, 3)) + 1) + '-' + pad(day)
  }
  m = DATE_MD.exec(text)
  if (m && Number(m[2]) <= 31) return { match: m, resolve: monthDay(m[1], Number(m[2])) }
  m = DATE_DM.exec(text)
  if (m && Number(m[1]) <= 31) return { match: m, resolve: monthDay(m[2], Number(m[1])) }

  m = RELATIVE.exec(text)
  if (m) {
    const shift = { tomorrow: 1, tmrw: 1, yesterday: -1 }[m[1]] || 0
    return { match: m, resolve: (zone) => addDays(formatYMD(new Date(), zone), shift) }
  }

  m = WEEKDAY.exec(text)
  if (m) {
    const target = WEEKDAYS.findIndex((d) => d.startsWith(m[2].slice(0, 3)))
    return {
      match: m,
      resolve: (zone) => {
        const today = formatYMD(new Date(), zone)
        const [y, mo, d] = today.split('-').map(Number)
        const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
        let ahead = (target - dow + 7) % 7
        if (m[1] && ahead === 0) ahead = 7
        return addDays(today, ahead)
      },
    }
  }
  return null
}

// A real town spelled exactly as typed beats a typo'd famous city only when it
// is a sizeable place: "pune" is Pune, but "tokio" is Tokyo, not Tokio, Texas.
const BIG_TOWN = 100000
// A typo is only corrected to a town people are likely to mean; below this,
// ordinary words land on small towns ("weather" is one edit from Wetter).
const TYPO_TOWN = 50000

// The picker's search is prefix-based for typing ahead; a sentence needs the
// whole name, or "dubaii" becomes "Dubai Investments Park".
const namedExactly = (place, phrase) =>
  [place.city, place.ascii].some((n) => n && squash(n) === squash(phrase))

/**
 * Best city for a free-text phrase, and whether a typo had to be corrected:
 * exact built-in match, then exact gazetteer or fuzzy built-in, then fuzzy
 * gazetteer.
 */
async function resolvePlace(phrase) {
  if (phrase === '__local__') return { city: detectLocal() }

  const off = OFFSET_TOKEN.exec(phrase)
  if (off) {
    const minutes = (off[1] === 'm' ? -1 : 1) * Number(off[2])
    const city = cityAtOffset(minutes)
    const label = 'UTC' + (minutes < 0 ? '−' : '+') + Math.floor(Math.abs(minutes) / 60) +
      (Math.abs(minutes) % 60 ? ':' + pad(Math.abs(minutes) % 60) : '')
    return city ? { city, note: `${label} read as ${city.city}.` } : { city: null }
  }

  const abbr = findAbbreviation(phrase)
  if (abbr) {
    const city = searchCities(phrase)[0]
    const also = abbr.also ? ` ${abbr.code} can also mean ${abbr.also} — name a city to use that.` : ''
    return { city, note: `${abbr.code} read as ${abbr.name} (${city.city}).${also}` }
  }

  const exact = searchCities(phrase)[0]
  // A bare country resolves to its main city, and remembers it was a country
  // so the answer can show every zone it spans.
  if (exact) return { city: exact, country: findCountry(phrase) }

  const near = fuzzyCities(phrase, 1)[0]
  await loadPlaces()
  const town = searchPlaces(phrase, 20).find((p) => namedExactly(p, phrase))
  if (town && (!near || town.pop >= BIG_TOWN)) return { city: town }
  if (near) return { city: near, corrected: true }

  const farTown = fuzzyPlaces(phrase, 20).find((p) => p.pop >= TYPO_TOWN)
  return farTown ? { city: farTown, corrected: true } : { city: null }
}

/**
 * Split what is left after times and dates are cut out into place phrases,
 * remembering the joining word in front of each and where the time sat.
 */
function phrases(text) {
  const out = []
  let joiner = ''
  let last = 0
  const push = (chunk) => {
    const words = chunk
      .split(/\s+/)
      .map((w) => w.replace(/['’]s$/, ''))
      .filter((w) => w && !FILLER.has(w))
    if (words.length) out.push({ text: words.join(' '), joiner })
  }
  for (const m of text.matchAll(JOINER)) {
    push(text.slice(last, m.index))
    joiner = m[0].trim() || joiner
    last = m.index + m[0].length
  }
  push(text.slice(last))
  return out
}

/**
 * Parse a question. Resolves to either
 *   { ok: true, from, to, live, dateStr?, timeStr?, single }
 * or
 *   { ok: false, reason }
 *
 * `current` is the converter's present { from, to }, used to fill in whichever
 * side the question leaves out.
 */
export async function ask(input, current) {
  let text = ' ' + input.toLowerCase().replace(/\s+/g, ' ') + ' '
  text = text.replace(LOCAL, ' __local__ ')
  text = text.replace(OFFSET, (_, sign, h, m) => {
    const minutes = Number(h) * 60 + Number(m || 0)
    return ` __off_${sign === '+' ? 'p' : 'm'}${minutes}__ `
  })

  const time = parseTime(text)
  const date = parseDate(text)

  // Cut the time and date out, leaving a marker where the time was so we can
  // tell which city it sits next to.
  const cuts = [time && { m: time.match, mark: ' @@ ' }, date && { m: date.match, mark: ' ' }]
    .filter(Boolean)
    .sort((a, b) => b.m.index - a.m.index)
  for (const { m, mark } of cuts) {
    text = text.slice(0, m.index) + mark + text.slice(m.index + m[0].length)
  }
  text = text.replace(NOW, ' ')

  // Split on the marker first: phrases before it and after it.
  const [before, after = ''] = text.split('@@')
  const pre = phrases(before)
  const post = phrases(after)
  const all = [...pre, ...post]

  if (!all.length) {
    return { ok: false, reason: 'no-place' }
  }

  const found = await Promise.all(all.map((p) => resolvePlace(p.text)))
  const missing = all.filter((_, i) => !found[i].city).map((p) => p.text)
  if (missing.length) return { ok: false, reason: 'unknown', missing }
  const resolved = found.map((f) => f.city)
  const notes = found.map((f) => f.note).filter(Boolean)
  const corrections = all
    .map((p, i) => found[i].corrected && { typed: p.text, city: found[i].city.city })
    .filter(Boolean)

  // Which city owns the time? The one right after it when joined by "in" / "at"
  // or nothing ("3pm in London", "3pm London"); the one right before it when
  // another city follows ("London 3pm to Tokyo"); and the first named when the
  // time trails the sentence ("NYC to Kolkata at 9:30").
  let ownerIndex = 0
  if (time && post.length) {
    ownerIndex = ['', 'in', 'at', 'for'].includes(post[0].joiner) || !pre.length ? pre.length : pre.length - 1
  }

  const owner = resolved[ownerIndex]
  if (resolved.length > 1 && resolved.every((c) => c.id === owner.id)) {
    return { ok: false, reason: 'same', city: owner }
  }
  const other = resolved.find((c, i) => i !== ownerIndex && c.id !== owner.id)

  let from
  let to
  let single = false
  if (other) {
    from = owner
    to = other
  } else if (time || date) {
    // "3pm in Tokyo" — what's that where I am?
    from = owner
    const local = detectLocal()
    to = local.zone !== owner.zone ? local : owner.id !== current.from.id ? current.from : current.to
    single = true
  } else {
    // "time in Tokyo" — show it against whatever is already on the left.
    from = owner.id === current.from.id ? current.to : current.from
    to = owner
    single = true
  }

  if (from.id === to.id) return { ok: false, reason: 'same', city: from }

  // Which sides were named as a whole country ("usa") rather than a city.
  const countryFor = (city) => found.find((f) => f.city === city)?.country || null
  const countries = { from: countryFor(from), to: countryFor(to) }

  if (!time && !date) return { ok: true, from, to, live: true, single, corrections, countries, notes }

  const dateStr = date ? date.resolve(from.zone) : formatYMD(new Date(), from.zone)
  const timeStr = time ? time.hhmm : formatHHMM(new Date(), from.zone)
  return { ok: true, from, to, live: false, dateStr, timeStr, single, corrections, countries, notes }
}

export const EXAMPLES = [
  '3pm London in Tokyo',
  'NYC to Kolkata tomorrow 9:30am',
  'time in Sydney',
  'noon Friday in Berlin to my time',
]
