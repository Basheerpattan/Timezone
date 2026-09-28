import Link from 'next/link'
import { pairPath } from '../lib/url.js'

/** A grid of "A to B" links. Server-rendered, so crawlers follow them. */
export default function PairLinks({ pairs }) {
  if (!pairs.length) return null

  return (
    <ul className="pair-links">
      {pairs.map(({ from, to }) => (
        <li key={from.slug + '>' + to.slug}>
          <Link href={pairPath(from, to)} prefetch={false}>
            <span className="flag" aria-hidden="true">
              {from.flag}
            </span>
            {from.city}
            <span className="arrow" aria-hidden="true">
              &rarr;
            </span>
            <span className="flag" aria-hidden="true">
              {to.flag}
            </span>
            {to.city}
          </Link>
        </li>
      ))}
    </ul>
  )
}
