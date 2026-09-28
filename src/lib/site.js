// Single source of truth for anything that needs an absolute URL: canonical
// links, Open Graph tags, the sitemap and JSON-LD.
//
// Vercel sets VERCEL_PROJECT_PRODUCTION_URL on every deployment, so the app
// gets a correct absolute URL with no configuration. Set NEXT_PUBLIC_SITE_URL
// once you point a custom domain at it and that wins.
const fromEnv =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL &&
    `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)

export const SITE_URL = (fromEnv || 'http://localhost:3000').replace(/\/$/, '')
export const SITE_NAME = 'ChronoGlobe'
export const SITE_TAGLINE = 'Time Zone Converter'
export const SITE_DESCRIPTION =
  'Compare the current time between any two countries and cities worldwide. Live clocks, daylight-saving warnings and shareable links.'

export const absolute = (path = '/') => SITE_URL + path
