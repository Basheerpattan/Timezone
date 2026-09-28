import { notFound } from 'next/navigation'
import Link from 'next/link'
import Converter from '../../../../components/Converter.jsx'
import PairLinks from '../../../../components/PairLinks.jsx'
import { pairFacts, prebuiltPairs, relatedPairs, resolvePair } from '../../../../lib/pair.js'
import { pairPath } from '../../../../lib/url.js'
import { SITE_NAME } from '../../../../lib/site.js'

// Offsets shift twice a year, so a daily rebuild is plenty. Pairs outside the
// prebuilt set render on the first request and are cached from then on.
export const revalidate = 86400
export const dynamicParams = true

export function generateStaticParams() {
  return prebuiltPairs()
}

export async function generateMetadata({ params }) {
  const { from: fromSlug, to: toSlug } = await params
  const pair = resolvePair(fromSlug, toSlug)
  if (!pair) return {}

  const { from, to } = pair
  const facts = pairFacts(from, to)
  const title = `${from.city} to ${to.city} Time Converter`
  const description =
    `Convert time between ${from.city}, ${from.country} and ${to.city}, ${to.country}. ` +
    `${facts.sentence} Live clocks, any date, and daylight-saving warnings.`
  const url = pairPath(from, to)

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} — ${SITE_NAME}`, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function PairPage({ params }) {
  const { from: fromSlug, to: toSlug } = await params
  const pair = resolvePair(fromSlug, toSlug)
  if (!pair) notFound()

  const { from, to } = pair
  const now = Date.now()
  const facts = pairFacts(from, to, new Date(now))
  const related = relatedPairs(from, to)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${from.city} to ${to.city} Time Converter`,
    description: facts.sentence,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: '/' },
        { '@type': 'ListItem', position: 2, name: `${from.city} to ${to.city}` },
      ],
    },
  }

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Converter fromId={from.id} toId={to.id} serverNow={now} routed />

      <section className="seo">
        <h2>
          {from.city} to {to.city} time difference
        </h2>
        <p>
          {facts.sentence} {from.city} runs on <strong>{from.zone}</strong> ({facts.fromOffset}) and{' '}
          {to.city} on <strong>{to.zone}</strong> ({facts.toOffset}). Either side can shift by an
          hour when one of the two enters or leaves daylight saving, so the converter above reads
          both zones live rather than assuming a fixed gap.
        </p>
        <p>
          To plan a call, set the date and time on the bar above &mdash; it is read as wall-clock
          time in {from.city} &mdash; and {to.city} follows underneath. Use the link button to copy
          a URL that reopens exactly that moment for whoever you send it to.
        </p>

        <h2>Other conversions from {from.city}</h2>
        <PairLinks pairs={related} />

        <p className="seo-back">
          <Link href={`${pairPath(to, from)}`}>
            {to.city} to {from.city}
          </Link>
          <span aria-hidden="true"> &middot; </span>
          <Link href="/">All time zones</Link>
        </p>
      </section>
    </main>
  )
}
