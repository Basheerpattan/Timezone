import Link from 'next/link'

export const metadata = { title: 'Page not found', robots: { index: false } }

export default function NotFound() {
  return (
    <main>
      <div className="backdrop" aria-hidden="true" />
      <div className="shell">
        <section className="seo notfound">
          <h1>That page is not here</h1>
          <p>
            No time zone answers to this address. Try the converter and search for the city you
            want &mdash; every IANA zone and about 230,000 places are in there.
          </p>
          <p className="seo-back">
            <Link href="/">Open the time zone converter</Link>
          </p>
        </section>
      </div>
    </main>
  )
}
