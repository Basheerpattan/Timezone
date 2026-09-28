// Everything the prerendered /a/to/b pages need, computed on the server.
//
// Deliberately avoids the live clock: a static page that claims "it is 3:14 PM
// in Tokyo" is wrong the moment it is cached. Offsets and the gap between two
// zones are stable for months at a time, so those are what the page states in
// its indexable text. The running clock is the client widget's job.
import { CITIES, findBySlug } from '../data/cities.js'
import { diffLabel, diffMinutes, offsetLabel } from './time.js'

/**
 * The cities that get prerendered pages.
 *
 * Every curated entry is in; the derived zone entries are reachable but
 * rendered on demand. 100-odd cities is ~10k pairs, which is more than a build
 * should spend time on, so `TOP` caps what gets built ahead of time.
 */
export const PAIR_CITIES = CITIES.filter((c) => c.curated)

// Prebuilt pairs are limited to the busiest cities; everything else still
// works, it just renders on the first request and is cached from then on.
const TOP = [
  'new-york', 'london', 'los-angeles', 'chicago', 'toronto', 'sao-paulo',
  'kolkata', 'mumbai', 'new-delhi', 'bengaluru', 'dubai', 'singapore',
  'tokyo', 'sydney', 'melbourne', 'hong-kong', 'shanghai', 'seoul',
  'paris', 'berlin', 'madrid', 'amsterdam', 'zurich', 'dublin',
  'san-francisco', 'denver', 'moscow', 'istanbul', 'johannesburg', 'utc',
]

/** The [from, to] slug pairs built at deploy time. */
export function prebuiltPairs() {
  const pairs = []
  for (const from of TOP) {
    for (const to of TOP) {
      if (from !== to) pairs.push({ from, to })
    }
  }
  return pairs
}

/** Resolve a pair of slugs, or null if either one has no page. */
export function resolvePair(fromSlug, toSlug) {
  const from = findBySlug(fromSlug)
  const to = findBySlug(toSlug)
  if (!from || !to || from.id === to.id) return null
  // Only the canonical slug gets a page, so /asia%2Fkolkata/to/... does not
  // become a second URL serving identical content.
  if (from.slug !== fromSlug || to.slug !== toSlug) return null
  return { from, to }
}

/**
 * The facts that go into the page title, description and body copy.
 *
 * `at` is the moment the offsets are measured at — build time for a prebuilt
 * page. Both zones are read at the same instant, so the gap is correct even
 * when only one of them is on daylight saving.
 */
export function pairFacts(from, to, at = new Date()) {
  const minutes = diffMinutes(at, to.zone, from.zone)
  const gap = diffLabel(minutes)
  const ahead = minutes > 0 ? 'ahead of' : minutes < 0 ? 'behind' : 'the same time as'

  return {
    from,
    to,
    minutes,
    gap,
    ahead,
    fromOffset: offsetLabel(at, from.zone),
    toOffset: offsetLabel(at, to.zone),
    // "Tokyo is 13h 30m ahead of New York" / "…is the same time as…"
    sentence:
      minutes === 0
        ? `${to.city} is the same time as ${from.city}.`
        : `${to.city} is ${gap.replace(/^[+-]/, '')} ${ahead} ${from.city}.`,
  }
}

/** A handful of other pairs to link to, so every page has somewhere to go. */
export function relatedPairs(from, to, limit = 8) {
  const seen = new Set([from.slug, to.slug])
  const out = []

  for (const slug of TOP) {
    if (out.length >= limit) break
    if (seen.has(slug)) continue
    const city = findBySlug(slug)
    if (!city) continue
    seen.add(slug)
    out.push({ from, to: city })
  }
  return out
}
