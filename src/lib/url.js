// The whole app state lives in the address bar, so any view is linkable.
//
// Two shapes, both valid:
//   /?from=kolkata&to=new-york&at=2026-09-21T14:30&fmt=24   the home page
//   /kolkata/to/new-york?at=2026-09-21T14:30&fmt=24         a pair page
//
// The pair form is the canonical, indexable one; the query form is the escape
// hatch for the 230k gazetteer places that have no prerendered page.
import { findBySlug } from '../data/cities.js'

const AT = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/

const NOTHING = { from: null, to: null, slugs: {}, dateStr: null, timeStr: null, hour12: null }

/** Read state from the current URL. Missing or malformed values return null. */
export function readParams() {
  if (typeof location === 'undefined') return NOTHING
  const q = new URLSearchParams(location.search)

  const at = q.get('at') || ''
  const m = AT.exec(at)

  const fromSlug = q.get('from') || ''
  const toSlug = q.get('to') || ''

  return {
    from: findBySlug(fromSlug) || null,
    to: findBySlug(toSlug) || null,
    // Kept so the app can retry against the lazy gazetteer.
    slugs: { from: fromSlug, to: toSlug },
    dateStr: m ? m[1] : null,
    timeStr: m ? m[2] : null,
    hour12: q.get('fmt') === '24' ? false : q.get('fmt') === '12' ? true : null,
  }
}

/** The canonical path for a city pair: /new-york/to/london. */
export const pairPath = (from, to) => `/${from.slug}/to/${to.slug}`

/**
 * A pair page only exists for cities in the built-in list. Gazetteer places —
 * every village and state — have no prerendered page, so they fall back to the
 * query-string form rather than 404 on reload.
 */
const hasPage = (city) => !city.place

/**
 * Build the address for a given state.
 *
 * On a pair page the cities live in the path and only the extras go in the
 * query string; everywhere else the query string carries all of it.
 */
export function buildUrl({ from, to, live, dateStr, timeStr, hour12 }, routed = false) {
  const q = new URLSearchParams()
  const onPairPage = routed && hasPage(from) && hasPage(to)

  if (!onPairPage) {
    q.set('from', from.slug)
    q.set('to', to.slug)
  }
  if (!live && dateStr && timeStr) q.set('at', dateStr + 'T' + timeStr)
  if (!hour12) q.set('fmt', '24')

  // Colons are legal in a query string; leaving them encoded just looks worse.
  const search = q.toString().replace(/%3A/g, ':')
  return (onPairPage ? pairPath(from, to) : '/') + (search ? '?' + search : '')
}

/**
 * Reflect state in the address bar without touching history — the back button
 * should leave the app, not step through every city change. replaceState is
 * used rather than the Next router so that changing a city never re-runs a
 * server render; the page is already showing the answer.
 */
export function syncUrl(state, routed = false) {
  if (typeof history === 'undefined') return
  const next = buildUrl(state, routed)
  if (next !== location.pathname + location.search) history.replaceState(null, '', next)
}

/** Absolute link to the current view, for the copy button. */
export function shareLink(state, routed = false) {
  return location.origin + buildUrl(state, routed)
}
