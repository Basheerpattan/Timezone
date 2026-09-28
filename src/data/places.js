// Lazy gazetteer: ~230k cities, towns and villages plus ~3.8k states.
//
// The data lives in public/places.txt (6 MB, ~2.5 MB gzipped) and is fetched
// only when someone actually searches, so first paint never waits for it.
// Matching uses a word-prefix bucket index, which keeps a keystroke to a scan
// of a few hundred candidates rather than all 230k rows.
import { countryOf, flagOf, slugify } from './cities.js'
import { allowedTypos, closest, squash } from '../lib/fuzzy.js'

let promise = null
let db = null

const SECTION = '\n--\n'

function parse(text) {
  const [zoneLine, regionLine, cityBlock, stateBlock] = text.split(SECTION)
  const zones = zoneLine.split('\t')
  const regions = regionLine.split('\t')
  const rows = cityBlock.split('\n').concat(stateBlock ? stateBlock.split('\n') : [])
  const stateFrom = cityBlock.split('\n').length

  // Bucket every row under the first two letters of each word in its name, so
  // "york" finds "New York" and "san fr" finds "San Francisco".
  const buckets = new Map()
  const push = (key, i) => {
    let list = buckets.get(key)
    if (!list) buckets.set(key, (list = []))
    list.push(i)
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const tab = row.indexOf('\t')
    const name = row.slice(0, tab)
    const rest = row.slice(tab + 1)
    const ascii = rest.slice(0, rest.indexOf('\t'))
    for (const label of ascii ? [name, ascii] : [name]) {
      for (const word of label.toLowerCase().split(/[\s'’\-()]+/)) {
        if (word.length >= 2) push(word.slice(0, 2), i)
      }
    }
  }

  // Int32Array is a third of the memory of a JS number array.
  const index = new Map()
  for (const [key, list] of buckets) index.set(key, Int32Array.from(new Set(list)))

  return { zones, regions, rows, stateFrom, index }
}

/** Fetch and index the gazetteer. Safe to call repeatedly. */
export function loadPlaces() {
  if (!promise) {
    const url = '/places.txt'
    promise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('places.txt ' + r.status)
        return r.text()
      })
      .then((text) => {
        db = parse(text)
        return db
      })
      .catch((err) => {
        // Leave the app usable on the built-in city list.
        console.warn('[places] could not load gazetteer:', err.message)
        promise = null
        return null
      })
  }
  return promise
}

export const placesReady = () => db !== null

function toEntry(i) {
  const [name, ascii, cc, region36, zone36, pop36] = db.rows[i].split('\t')
  const regionKey = db.regions[parseInt(region36, 36)] || ''
  const region = regionKey.slice(regionKey.indexOf('|') + 1)
  const country = countryOf(cc) || cc
  const isState = i >= db.stateFrom

  return {
    id: name + '|' + cc + '|' + region + '|' + i,
    slug: [slugify(name), cc.toLowerCase(), region && slugify(region)].filter(Boolean).join('-'),
    city: name,
    country: region && region !== name ? region + ', ' + country : country,
    cc,
    zone: db.zones[parseInt(zone36, 36)],
    flag: flagOf(cc),
    curated: false,
    place: true,
    isState,
    ascii,
    pop: parseInt(pop36, 36) || 0,
  }
}

function scoreRow(i, q) {
  const row = db.rows[i]
  const tab = row.indexOf('\t')
  const name = row.slice(0, tab).toLowerCase()
  const rest = row.slice(tab + 1)
  const ascii = rest.slice(0, rest.indexOf('\t')).toLowerCase()

  const compact = q.replace(/[\s'’\-()]+/g, '')
  for (const label of ascii ? [name, ascii] : [name]) {
    if (label === q) return 1000
    if (label.startsWith(q)) return 800
    // "saltlakecity" for "Salt Lake City".
    if (compact.length >= 4) {
      const squashed = label.replace(/[\s'’\-()]+/g, '')
      if (squashed === compact) return 950
      if (squashed.startsWith(compact)) return 700
    }
    if (label.split(/[\s'’\-()]+/).some((w) => w.startsWith(q))) return 600
  }
  return 0
}

/**
 * Places matching `query`, best first. Returns [] until the data has loaded,
 * and for queries under two characters (the built-in city list covers those).
 */
export function searchPlaces(query, limit = 60) {
  const q = query.trim().toLowerCase()
  if (!db || q.length < 2) return []

  const candidates = db.index.get(q.slice(0, 2))
  if (!candidates) return []

  const hits = []
  for (const i of candidates) {
    const s = scoreRow(i, q)
    // Population breaks ties, so "springfield" leads with the biggest one.
    if (s) hits.push({ i, rank: s * 1e7 + Math.min(popOf(i), 9e6) })
  }

  hits.sort((a, b) => b.rank - a.rank)
  return hits.slice(0, limit).map((h) => toEntry(h.i))
}

/**
 * Places within a typo or two of `query`, fewest edits first, then biggest.
 * Only rows sharing the query's first two letters are checked — the same
 * bucket the exact search uses — which keeps this to a few thousand rows.
 */
export function fuzzyPlaces(query, limit = 20) {
  const q = squash(query)
  const max = allowedTypos(q)
  if (!db || !max) return []

  const candidates = db.index.get(q.slice(0, 2))
  if (!candidates) return []

  const hits = []
  for (const i of candidates) {
    const row = db.rows[i]
    const tab = row.indexOf('	')
    const name = row.slice(0, tab).toLowerCase()
    const rest = row.slice(tab + 1)
    const ascii = rest.slice(0, rest.indexOf('	')).toLowerCase()
    const labels = [name, ascii].filter(Boolean)
    const d = closest(q, [...labels.map(squash), ...labels.flatMap((l) => l.split(/[\s'’\-()]+/))], max)
    if (d !== Infinity) hits.push({ i, d, pop: popOf(i) })
  }
  hits.sort((a, b) => a.d - b.d || b.pop - a.pop)
  return hits.slice(0, limit).map((h) => toEntry(h.i))
}

function popOf(i) {
  const row = db.rows[i]
  return parseInt(row.slice(row.lastIndexOf('\t') + 1), 36) || 0
}

/** Resolve a place slug from a shared URL. Loads the data if needed. */
export async function findPlaceBySlug(slug) {
  if (!slug || slug.length < 2) return null
  await loadPlaces()
  if (!db) return null

  const candidates = db.index.get(slug.slice(0, 2))
  if (!candidates) return null
  for (const i of candidates) {
    const entry = toEntry(i)
    if (entry.slug === slug) return entry
  }
  return null
}
