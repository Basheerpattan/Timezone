import { prebuiltPairs } from '../lib/pair.js'
import { SITE_URL } from '../lib/site.js'

/**
 * Only the prebuilt pairs are listed. The on-demand ones are reachable and
 * indexable, but pointing a crawler at ten thousand near-identical URLs is a
 * good way to get the lot treated as thin content.
 */
export default function sitemap() {
  const now = new Date()

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    ...prebuiltPairs().map(({ from, to }) => ({
      url: `${SITE_URL}/${from}/to/${to}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    })),
  ]
}
