import Converter from '../components/Converter.jsx'
import PairLinks from '../components/PairLinks.jsx'
import { findBySlug } from '../data/cities.js'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '../lib/site.js'

// Regenerated hourly, so the prerendered clock is never far from the truth and
// the page still serves from the CDN rather than from a render on every hit.
export const revalidate = 3600

// The visitor's own zone is not knowable on the server, so the prerendered
// HTML shows a neutral, universally sensible pair. The client swaps "from" to
// the local zone in an effect, before the first paint anyone can read.
const DEFAULT_FROM = 'New York|America/New_York'
const DEFAULT_TO = 'London|Europe/London'

const POPULAR = [
  ['new-york', 'london'],
  ['london', 'new-york'],
  ['kolkata', 'new-york'],
  ['new-york', 'kolkata'],
  ['london', 'kolkata'],
  ['san-francisco', 'bengaluru'],
  ['new-york', 'los-angeles'],
  ['london', 'dubai'],
  ['sydney', 'london'],
  ['tokyo', 'new-york'],
  ['singapore', 'london'],
  ['dubai', 'kolkata'],
  ['los-angeles', 'tokyo'],
  ['berlin', 'new-york'],
  ['chicago', 'london'],
  ['toronto', 'kolkata'],
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires JavaScript',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
}

export default function HomePage() {
  const pairs = POPULAR.map(([a, b]) => ({ from: findBySlug(a), to: findBySlug(b) })).filter(
    (p) => p.from && p.to
  )

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Converter fromId={DEFAULT_FROM} toId={DEFAULT_TO} serverNow={Date.now()} />

      <section className="seo">
        <h2>Popular conversions</h2>
        <PairLinks pairs={pairs} />

        <h2>How it works</h2>
        <p>
          Pick a city on each side and both clocks run live, second by second. Offsets and
          daylight-saving rules come straight from your browser&rsquo;s own IANA time zone
          database, so they stay current without the app shipping a date library or phoning
          home &mdash; including the half-hour and quarter-hour zones like Kolkata (UTC+5:30)
          and Kathmandu (UTC+5:45).
        </p>
        <p>
          Search reaches every one of the 321 IANA time zones plus a gazetteer of roughly
          230,000 cities, towns and villages and 3,800 states and provinces. Aliases work too:
          type <em>Bombay</em>, <em>NYC</em>, <em>Saigon</em>, <em>UAE</em> or <em>PST</em> and
          the right place comes up.
        </p>
        <p>
          You are not limited to right now. Set any date and time &mdash; read as wall-clock
          time in the <strong>From</strong> city &mdash; to plan a call or a deployment window.
          If you ask for an hour that daylight saving skips, the app says so and shows what it
          used instead; if you ask for an hour that happens twice, it flags that too.
        </p>
        <p>
          Every view lives in its address, so the link in the header copies a URL that restores
          exactly what you are looking at, right down to the date, the time and the 12- or
          24-hour format.
        </p>
      </section>
    </main>
  )
}
