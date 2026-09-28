import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import kvIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache'

/**
 * How the app runs on Cloudflare Workers.
 *
 * The incremental cache is what makes ISR work: it holds the rendered HTML for
 * the pair pages so that `revalidate` actually revalidates, and so a pair
 * outside the prebuilt set is rendered once rather than on every request.
 *
 * Workers KV is used because it is part of the Workers free plan — no payment
 * method, no separate product to enable. Its ceiling is 1,000 writes a day,
 * which is far more than this app's revalidations need; a write only happens
 * when someone actually requests a page whose cache entry has expired.
 *
 * If the site ever outgrows that, swap the two lines above for:
 *
 *   import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'
 *   export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache })
 *
 * and bind an R2 bucket as NEXT_INC_CACHE_R2_BUCKET in wrangler.jsonc.
 */
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
})
