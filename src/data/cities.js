// The city list is two layers:
//
//  1. CURATED — hand-written entries for the places people actually search for,
//     with aliases ("Bombay", "NYC", "PST") and human city names that are not
//     zone names (Mumbai and New Delhi both live in Asia/Kolkata).
//  2. DERIVED — every remaining IANA time zone, labelled from the zone name.
//     This is what makes the full world available rather than a shortlist.
//
// Curated entries outrank derived ones when scores tie, so common cities stay
// at the top while obscure zones remain findable.
import { ZONE_TABLE } from './zones.js'
import { allowedTypos, closest, squash } from '../lib/fuzzy.js'
import { offsetMinutes } from '../lib/time.js'
import { ABBREVIATIONS } from './abbreviations.js'

// [city, country, ISO-2 country code (drives the flag), IANA zone, aliases?]
const raw = [
  ['Kolkata', 'India', 'IN', 'Asia/Kolkata', 'calcutta ist india standard time'],
  ['Mumbai', 'India', 'IN', 'Asia/Kolkata', 'bombay'],
  ['New Delhi', 'India', 'IN', 'Asia/Kolkata', 'delhi ncr'],
  ['Bengaluru', 'India', 'IN', 'Asia/Kolkata', 'bangalore blr'],
  ['Hyderabad', 'India', 'IN', 'Asia/Kolkata', ''],
  ['Chennai', 'India', 'IN', 'Asia/Kolkata', 'madras'],
  ['Kathmandu', 'Nepal', 'NP', 'Asia/Kathmandu', 'katmandu'],
  ['Colombo', 'Sri Lanka', 'LK', 'Asia/Colombo', 'ceylon'],
  ['Dhaka', 'Bangladesh', 'BD', 'Asia/Dhaka', 'dacca'],
  ['Karachi', 'Pakistan', 'PK', 'Asia/Karachi', 'pkt'],
  ['Kabul', 'Afghanistan', 'AF', 'Asia/Kabul', ''],
  ['Dubai', 'United Arab Emirates', 'AE', 'Asia/Dubai', 'uae emirates gst'],
  ['Abu Dhabi', 'United Arab Emirates', 'AE', 'Asia/Dubai', 'uae emirates'],
  ['Doha', 'Qatar', 'QA', 'Asia/Qatar', ''],
  ['Riyadh', 'Saudi Arabia', 'SA', 'Asia/Riyadh', 'ksa'],
  ['Tehran', 'Iran', 'IR', 'Asia/Tehran', ''],
  ['Baghdad', 'Iraq', 'IQ', 'Asia/Baghdad', ''],
  ['Jerusalem', 'Israel', 'IL', 'Asia/Jerusalem', 'tel aviv idt'],
  ['Istanbul', 'Turkey', 'TR', 'Europe/Istanbul', 'turkiye trt'],
  ['Moscow', 'Russia', 'RU', 'Europe/Moscow', 'msk'],
  ['Yekaterinburg', 'Russia', 'RU', 'Asia/Yekaterinburg', 'ekaterinburg'],
  ['Vladivostok', 'Russia', 'RU', 'Asia/Vladivostok', ''],
  ['Tashkent', 'Uzbekistan', 'UZ', 'Asia/Tashkent', ''],
  ['Almaty', 'Kazakhstan', 'KZ', 'Asia/Almaty', ''],
  ['Bangkok', 'Thailand', 'TH', 'Asia/Bangkok', 'ict'],
  ['Hanoi', 'Vietnam', 'VN', 'Asia/Ho_Chi_Minh', ''],
  ['Ho Chi Minh City', 'Vietnam', 'VN', 'Asia/Ho_Chi_Minh', 'saigon hcmc'],
  ['Yangon', 'Myanmar', 'MM', 'Asia/Yangon', 'rangoon burma'],
  ['Jakarta', 'Indonesia', 'ID', 'Asia/Jakarta', 'wib'],
  ['Bali', 'Indonesia', 'ID', 'Asia/Makassar', 'denpasar wita'],
  ['Singapore', 'Singapore', 'SG', 'Asia/Singapore', 'sgt'],
  ['Kuala Lumpur', 'Malaysia', 'MY', 'Asia/Kuala_Lumpur', 'kl myt'],
  ['Manila', 'Philippines', 'PH', 'Asia/Manila', 'pht'],
  ['Hong Kong', 'Hong Kong', 'HK', 'Asia/Hong_Kong', 'hkt'],
  ['Taipei', 'Taiwan', 'TW', 'Asia/Taipei', ''],
  ['Shanghai', 'China', 'CN', 'Asia/Shanghai', 'china standard time'],
  ['Beijing', 'China', 'CN', 'Asia/Shanghai', 'peking'],
  ['Shenzhen', 'China', 'CN', 'Asia/Shanghai', ''],
  ['Seoul', 'South Korea', 'KR', 'Asia/Seoul', 'kst korea'],
  ['Tokyo', 'Japan', 'JP', 'Asia/Tokyo', 'jst'],
  ['Osaka', 'Japan', 'JP', 'Asia/Tokyo', ''],
  ['Perth', 'Australia', 'AU', 'Australia/Perth', 'awst'],
  ['Adelaide', 'Australia', 'AU', 'Australia/Adelaide', 'acst acdt'],
  ['Brisbane', 'Australia', 'AU', 'Australia/Brisbane', 'queensland'],
  ['Sydney', 'Australia', 'AU', 'Australia/Sydney', 'aest aedt nsw'],
  ['Melbourne', 'Australia', 'AU', 'Australia/Melbourne', 'victoria'],
  ['Auckland', 'New Zealand', 'NZ', 'Pacific/Auckland', 'nzst nzdt'],
  ['Suva', 'Fiji', 'FJ', 'Pacific/Fiji', ''],
  ['Honolulu', 'United States', 'US', 'Pacific/Honolulu', 'hawaii hst'],
  ['Anchorage', 'United States', 'US', 'America/Anchorage', 'alaska akst'],
  ['Los Angeles', 'United States', 'US', 'America/Los_Angeles', 'la pst pdt pacific time california'],
  ['San Francisco', 'United States', 'US', 'America/Los_Angeles', 'sf bay area silicon valley'],
  ['Seattle', 'United States', 'US', 'America/Los_Angeles', 'washington state'],
  ['Las Vegas', 'United States', 'US', 'America/Los_Angeles', 'nevada'],
  ['Phoenix', 'United States', 'US', 'America/Phoenix', 'arizona mst'],
  ['Denver', 'United States', 'US', 'America/Denver', 'mst mdt mountain time colorado'],
  ['Dallas', 'United States', 'US', 'America/Chicago', 'texas'],
  ['Houston', 'United States', 'US', 'America/Chicago', 'texas'],
  ['Chicago', 'United States', 'US', 'America/Chicago', 'cst cdt central time illinois'],
  ['Atlanta', 'United States', 'US', 'America/New_York', 'georgia'],
  ['Miami', 'United States', 'US', 'America/New_York', 'florida'],
  ['Boston', 'United States', 'US', 'America/New_York', 'massachusetts'],
  ['Washington DC', 'United States', 'US', 'America/New_York', 'dc capital'],
  ['New York', 'United States', 'US', 'America/New_York', 'nyc ny est edt eastern time manhattan'],
  ['Toronto', 'Canada', 'CA', 'America/Toronto', 'ontario'],
  ['Montreal', 'Canada', 'CA', 'America/Toronto', 'quebec'],
  ['Vancouver', 'Canada', 'CA', 'America/Vancouver', 'british columbia'],
  ['Mexico City', 'Mexico', 'MX', 'America/Mexico_City', 'cdmx'],
  ['Bogota', 'Colombia', 'CO', 'America/Bogota', 'bogota'],
  ['Lima', 'Peru', 'PE', 'America/Lima', ''],
  ['Santiago', 'Chile', 'CL', 'America/Santiago', ''],
  ['Buenos Aires', 'Argentina', 'AR', 'America/Argentina/Buenos_Aires', 'art'],
  ['Sao Paulo', 'Brazil', 'BR', 'America/Sao_Paulo', 'sao paulo brt'],
  ['Rio de Janeiro', 'Brazil', 'BR', 'America/Sao_Paulo', 'rio'],
  ['Reykjavik', 'Iceland', 'IS', 'Atlantic/Reykjavik', 'reykjavik'],
  ['Dublin', 'Ireland', 'IE', 'Europe/Dublin', 'eire'],
  ['London', 'United Kingdom', 'GB', 'Europe/London', 'uk britain england gmt bst'],
  ['Edinburgh', 'United Kingdom', 'GB', 'Europe/London', 'uk scotland'],
  ['Lisbon', 'Portugal', 'PT', 'Europe/Lisbon', 'lisboa wet'],
  ['Madrid', 'Spain', 'ES', 'Europe/Madrid', 'espana cet'],
  ['Barcelona', 'Spain', 'ES', 'Europe/Madrid', 'catalonia'],
  ['Paris', 'France', 'FR', 'Europe/Paris', 'cet cest'],
  ['Brussels', 'Belgium', 'BE', 'Europe/Brussels', 'bruxelles'],
  ['Amsterdam', 'Netherlands', 'NL', 'Europe/Amsterdam', 'holland'],
  ['Berlin', 'Germany', 'DE', 'Europe/Berlin', 'deutschland cet cest'],
  ['Munich', 'Germany', 'DE', 'Europe/Berlin', 'munchen muenchen bavaria'],
  ['Frankfurt', 'Germany', 'DE', 'Europe/Berlin', ''],
  ['Zurich', 'Switzerland', 'CH', 'Europe/Zurich', 'zuerich schweiz'],
  ['Milan', 'Italy', 'IT', 'Europe/Rome', 'milano'],
  ['Rome', 'Italy', 'IT', 'Europe/Rome', 'roma italia'],
  ['Vienna', 'Austria', 'AT', 'Europe/Vienna', 'wien'],
  ['Prague', 'Czechia', 'CZ', 'Europe/Prague', 'praha czech republic'],
  ['Warsaw', 'Poland', 'PL', 'Europe/Warsaw', 'warszawa'],
  ['Stockholm', 'Sweden', 'SE', 'Europe/Stockholm', 'sverige'],
  ['Oslo', 'Norway', 'NO', 'Europe/Oslo', 'norge'],
  ['Copenhagen', 'Denmark', 'DK', 'Europe/Copenhagen', 'kobenhavn'],
  ['Helsinki', 'Finland', 'FI', 'Europe/Helsinki', 'eet'],
  ['Athens', 'Greece', 'GR', 'Europe/Athens', 'eet eest'],
  ['Bucharest', 'Romania', 'RO', 'Europe/Bucharest', 'bucuresti'],
  ['Kyiv', 'Ukraine', 'UA', 'Europe/Kyiv', 'kiev'],
  ['Cairo', 'Egypt', 'EG', 'Africa/Cairo', 'eet'],
  ['Casablanca', 'Morocco', 'MA', 'Africa/Casablanca', ''],
  ['Lagos', 'Nigeria', 'NG', 'Africa/Lagos', 'wat'],
  ['Accra', 'Ghana', 'GH', 'Africa/Accra', ''],
  ['Nairobi', 'Kenya', 'KE', 'Africa/Nairobi', 'eat'],
  ['Addis Ababa', 'Ethiopia', 'ET', 'Africa/Addis_Ababa', ''],
  ['Johannesburg', 'South Africa', 'ZA', 'Africa/Johannesburg', 'joburg sast'],
  ['Cape Town', 'South Africa', 'ZA', 'Africa/Johannesburg', 'sast'],
  ['UTC', 'Coordinated Universal Time', 'UN', 'UTC', 'gmt zulu z utc+0'],
]

// Country-level search terms, applied to every city in that country.
const COUNTRY_ALIASES = {
  'United States': 'usa us america american states',
  'United Kingdom': 'uk gb britain british great britain',
  'United Arab Emirates': 'uae emirates',
  India: 'bharat',
  Netherlands: 'holland nl',
  Germany: 'deutschland de',
  Switzerland: 'schweiz suisse ch',
  Czechia: 'czech republic',
  'South Korea': 'korea rok',
  'New Zealand': 'nz',
  'Saudi Arabia': 'ksa',
  'Coordinated Universal Time': 'utc gmt',
}

export function flagOf(cc) {
  if (!cc || cc === 'UN') return '\u{1F310}'
  return cc.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

export const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const words = (s) => s.toLowerCase().split(/[\s_/,-]+/).filter(Boolean)

// The browser knows every country's name; no need to ship them.
let regionNames = null
try {
  regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
} catch {
  /* very old engine — fall back to the bare country code */
}
export function countryOf(cc) {
  if (!cc) return ''
  try {
    return regionNames?.of(cc) || cc
  } catch {
    return cc
  }
}

/** "Asia/Ho_Chi_Minh" → "Ho Chi Minh"; "America/Indiana/Knox" → "Knox, Indiana". */
function labelForZone(zone) {
  const parts = zone.split('/')
  const tidy = (s) => s.replace(/_/g, ' ')
  const last = tidy(parts[parts.length - 1])
  return parts.length === 3 ? last + ', ' + tidy(parts[1]) : last
}

function makeEntry({ city, country, cc, zone, aliases = '', curated }) {
  return {
    id: city + '|' + zone,
    city,
    country,
    cc,
    zone,
    flag: flagOf(cc),
    curated,
    cityWords: words(city),
    // "New York" as "newyork", so a name typed without its spaces still matches.
    cityCompact: words(city).join(''),
    countryWords: words(country),
    aliasWords: words(aliases + ' ' + (COUNTRY_ALIASES[country] || '')),
    zoneWords: words(zone),
  }
}

const curated = raw.map(([city, country, cc, zone, aliases = '']) =>
  makeEntry({ city, country, cc, zone, aliases, curated: true })
)

// A derived entry is redundant when a curated one already names the same place
// in the same zone. Compared on the base label, so the curated "Buenos Aires"
// absorbs the derived "Buenos Aires, Argentina".
const covered = new Set(curated.map((c) => slugify(c.city) + '|' + c.zone))
const baseLabel = (zone) => labelForZone(zone).split(',')[0]

const derived = ZONE_TABLE.filter(
  ([zone]) => !covered.has(slugify(baseLabel(zone)) + '|' + zone)
).map(([zone, cc]) =>
  makeEntry({
    city: labelForZone(zone),
    country: countryOf(cc) || 'Coordinated Universal Time',
    cc,
    zone,
    curated: false,
  })
)

export const CITIES = [...curated, ...derived]

// The city a bare country name stands for. Without this, "usa" lands on
// Anchorage — every US city ties, and it sorts first. Countries not listed
// fall back to their first curated city, then their first zone.
const PRIMARY = {
  US: 'New York',
  CA: 'Toronto',
  AU: 'Sydney',
  RU: 'Moscow',
  BR: 'Sao Paulo',
  MX: 'Mexico City',
  ID: 'Jakarta',
  IN: 'New Delhi',
  CN: 'Beijing',
}
{
  const marked = new Set()
  const mark = (test) => {
    for (const c of CITIES) {
      if (c.cc && !marked.has(c.cc) && test(c)) {
        c.primary = true
        marked.add(c.cc)
      }
    }
  }
  mark((c) => PRIMARY[c.cc] === c.city)
  mark((c) => c.curated)
  mark(() => true)
}

// Hang each abbreviation on the one city it means, so "ist" is New Delhi
// rather than a tie with Istanbul, and the picker finds "pt" at all.
for (const [code, [name]] of Object.entries(ABBREVIATIONS)) {
  const city = CITIES.find((c) => c.curated && c.city === name)
  if (city) (city.abbrs ||= []).push(code)
}

// Slugs drive shareable URLs, so they have to be unique. Curated cities are
// slugged first and keep the pretty form ("new-york"); anything that collides
// falls back to its zone ("america-indiana-knox").
{
  const taken = new Set()
  for (const c of CITIES) {
    let slug = slugify(c.city)
    if (taken.has(slug)) slug = slugify(c.zone)
    let n = 2
    while (taken.has(slug)) slug = slugify(c.zone) + '-' + n++
    taken.add(slug)
    c.slug = slug
  }
}

export const findById = (id) => CITIES.find((c) => c.id === id)

/** Accepts a slug, or a raw IANA zone so `?from=Asia/Kolkata` also works. */
export const findBySlug = (slug) =>
  CITIES.find((c) => c.slug === slug) ||
  CITIES.find((c) => c.zone.toLowerCase() === String(slug).toLowerCase())

const startsWithAny = (list, q) => list.some((w) => w.startsWith(q))

/**
 * Score a city against a query. Higher is better, 0 means "no match".
 *
 * Matching is word-prefix based rather than plain substring, so "usa" does not
 * match "jerUSAlem" and "uk" reaches London via its alias instead of surfacing
 * Kyiv through "ukraine".
 */
function score(city, q) {
  const cityName = city.cityWords.join(' ')
  const countryName = city.countryWords.join(' ')
  const compact = squash(q)

  if (cityName === q) return 1000
  if (city.abbrs?.includes(q)) return 950
  if (city.aliasWords.includes(q)) return 900
  if (cityName.startsWith(q)) return 800
  // Typed without its spaces: "newyork", "hongkong". Four letters minimum so
  // short queries keep their word-prefix ranking.
  if (compact.length >= 4 && city.cityCompact === compact) return 950
  if (compact.length >= 4 && city.cityCompact.startsWith(compact)) return 750
  if (countryName === q) return 700
  if (startsWithAny(city.cityWords, q)) return 600
  if (countryName.startsWith(q)) return 500
  if (startsWithAny(city.countryWords, q)) return 450
  if (startsWithAny(city.aliasWords, q)) return 400
  if (startsWithAny(city.zoneWords, q)) return 300
  return 0
}

/**
 * Cities matching `query`, best first. Ties break towards curated entries, so
 * "london" leads with the curated London rather than a derived duplicate.
 * An empty query returns the curated shortlist followed by everything else.
 */
export function searchCities(query) {
  const q = query.trim().toLowerCase()
  if (!q) return CITIES

  return CITIES.map((city) => ({ city, s: score(city, q) }))
    .filter((r) => r.s > 0)
    .sort(
      (a, b) =>
        b.s - a.s ||
        Number(Boolean(b.city.primary)) - Number(Boolean(a.city.primary)) ||
        Number(b.city.curated) - Number(a.city.curated) ||
        a.city.city.localeCompare(b.city.city)
    )
    .map((r) => r.city)
}

/**
 * Cities within a typo or two of `query` — the fallback when searchCities finds
 * nothing. Fewest edits first, then curated first. A near-miss on the city's
 * own name outranks one on its country, so "tokio" is Tokyo while "indai"
 * still reaches India.
 */
export function fuzzyCities(query, limit = 20) {
  const q = squash(query)
  const max = allowedTypos(q)
  if (!max) return []

  const hits = []
  for (const city of CITIES) {
    const own = closest(q, [city.cityCompact, ...city.cityWords, ...city.aliasWords], max)
    const country = closest(q, [city.countryWords.join(''), ...city.countryWords], max) + 0.5
    const d = Math.min(own, country)
    if (d !== Infinity) hits.push({ city, d })
  }
  return hits
    .sort((a, b) => a.d - b.d || Number(b.city.curated) - Number(a.city.curated))
    .slice(0, limit)
    .map((h) => h.city)
}

/**
 * The best-known city on a given UTC offset at `at`, for "UTC+5:30" — the
 * main city of its country if one fits, else any curated city, else any zone.
 */
export function cityAtOffset(minutes, at = new Date()) {
  const on = CITIES.filter((c) => offsetMinutes(at, c.zone) === minutes)
  if (minutes === 0) return on.find((c) => c.city === 'UTC') || on[0] || null
  return on.find((c) => c.primary && c.curated) || on.find((c) => c.curated) || on[0] || null
}

/**
 * The country a phrase names outright — "usa", "america", "australia" — or
 * null. A phrase that is also a city's own name ("singapore") is a city.
 */
export function findCountry(phrase) {
  const q = phrase.trim().toLowerCase()
  if (!q || CITIES.some((c) => c.cityWords.join(' ') === q)) return null
  const hit = CITIES.find(
    (c) =>
      c.cc &&
      (c.countryWords.join(' ') === q ||
        (' ' + (COUNTRY_ALIASES[c.country] || '') + ' ').includes(' ' + q + ' '))
  )
  return hit ? { cc: hit.cc, name: hit.country } : null
}

/**
 * A country's time zones as they stand at `at`, one group per distinct UTC
 * offset, east to west. Zones that share an offset right now (New York and
 * Detroit) are one group; each group leads with its best-known city.
 */
export function countryZones(cc, at) {
  const groups = new Map()
  for (const c of CITIES) {
    if (c.cc !== cc) continue
    const offset = offsetMinutes(at, c.zone)
    if (!groups.has(offset)) groups.set(offset, { offset, cities: [] })
    groups.get(offset).cities.push(c)
  }
  // Main city, then the city a zone is named after (Chicago for
  // America/Chicago, not Dallas), then any curated one.
  const namesZone = (c) => squash(c.city) === squash(c.zone.split('/').pop())
  const rank = (c) => (c.primary ? 4 : 0) + (c.curated && namesZone(c) ? 2 : 0) + (c.curated ? 1 : 0)
  return [...groups.values()]
    .map((g) => {
      g.cities.sort((a, b) => rank(b) - rank(a))
      return { ...g, lead: g.cities[0] }
    })
    .sort((a, b) => b.offset - a.offset)
}

// Legacy zone names some browsers still report (Chrome says "Asia/Calcutta").
const ALIASES = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Rangoon': 'Asia/Yangon',
  'Europe/Kiev': 'Europe/Kyiv',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'Australia/Canberra': 'Australia/Sydney',
  'Etc/UTC': 'UTC',
  'Etc/GMT': 'UTC',
}

/** Best-guess entry for the browser's own time zone. */
export function detectLocal() {
  const reported = Intl.DateTimeFormat().resolvedOptions().timeZone
  const zone = ALIASES[reported] || reported
  const known = CITIES.find((c) => c.zone === zone)
  if (known) return known
  // Unknown to both layers: build a throwaway entry so the app still works.
  const entry = makeEntry({ city: labelForZone(zone), country: 'Local time', cc: '', zone, curated: false })
  entry.slug = slugify(zone)
  return entry
}
