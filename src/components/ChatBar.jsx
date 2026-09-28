'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowIcon, SendIcon, SparkIcon } from './icons.jsx'
import { EXAMPLES, ask } from '../lib/ask.js'
import { countryZones } from '../data/cities.js'
import {
  abbreviation,
  diffLabel,
  diffMinutes,
  formatDate,
  formatTime,
  offsetLabel,
  zonedTimeToDate,
} from '../lib/time.js'

const RECENT_MAX = 5

/** Why a question could not be answered, in one line. */
function problem(r) {
  if (r.reason === 'unknown') {
    return `Couldn't find ${r.missing.map((m) => `“${m}”`).join(' or ')}. Try a city, country or abbreviation like PST.`
  }
  if (r.reason === 'same') return `Those are both ${r.city.city} — name two different places.`
  return 'Name a place or two, like “3pm London in Tokyo” or “time in Sydney”.'
}

/** The instant an answer is about: now for a live one, the asked time otherwise. */
function instantOf(r) {
  if (r.live) return new Date()
  const [year, month, day] = r.dateStr.split('-').map(Number)
  const [hour, minute] = r.timeStr.split(':').map(Number)
  return zonedTimeToDate({ year, month, day, hour, minute }, r.from.zone)
}

function Clock({ city, at, hour12 }) {
  return (
    <div className="answer-clock">
      <div className="answer-city">
        <span className="flag">{city.flag}</span>
        {city.city}
      </div>
      <div className="answer-time">{formatTime(at, city.zone, hour12)}</div>
      <div className="answer-date">{formatDate(at, city.zone)}</div>
    </div>
  )
}

/** "9h 30m behind Kolkata", "Same time as Kolkata". */
function relation(minutes, base) {
  return minutes === 0
    ? `Same time as ${base}`
    : `${diffLabel(minutes).slice(1)} ${minutes > 0 ? 'ahead of' : 'behind'} ${base}`
}

/** Every zone of a country that spans several, one row per UTC offset. */
function ZoneList({ country, groups, at, base, hour12 }) {
  return (
    <div className="zones">
      <div className="zones-head">
        {country.name} · {groups.length} time zones
      </div>
      <ul>
        {groups.map((g) => {
          const others = g.cities
            .slice(1)
            .filter((c) => c.curated)
            .slice(0, 2)
            .map((c) => c.city)
          return (
            <li key={g.offset}>
              <div className="zone-place">
                <strong>{g.lead.city}</strong>
                {others.length > 0 && <small>{others.join(', ')}</small>}
              </div>
              <div className="zone-when">
                <strong>{formatTime(at, g.lead.zone, hour12)}</strong>
                <small>
                  {[abbreviation(at, g.lead.zone), offsetLabel(at, g.lead.zone)].filter(Boolean).join(' · ')}
                  {base && ' · ' + relation(diffMinutes(at, g.lead.zone, base.zone), base.city)}
                </small>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * One result card: a single clock for "time in X", two for a conversion, and
 * a row per zone when the target is a country that spans several.
 */
function Answer({ r, hour12 }) {
  const at = instantOf(r)
  const gap = diffMinutes(at, r.to.zone, r.from.zone)
  const meta = [relation(gap, r.from.city), abbreviation(at, r.to.zone), offsetLabel(at, r.to.zone)].filter(
    Boolean
  )

  const toZones = r.countries.to ? countryZones(r.to.cc, at) : []
  const fromZones = r.countries.from ? countryZones(r.from.cc, at) : []
  const spread = toZones.length > 1
  const showFrom = !(r.single && r.live)

  return (
    <div className="answer">
      {spread ? (
        <>
          {showFrom && <Clock city={r.from} at={at} hour12={hour12} />}
          <ZoneList
            country={r.countries.to}
            groups={toZones}
            at={at}
            base={r.from}
            hour12={hour12}
          />
        </>
      ) : showFrom ? (
        <div className="answer-pair">
          <Clock city={r.from} at={at} hour12={hour12} />
          <span className="answer-arrow" aria-label="is">
            <ArrowIcon />
          </span>
          <Clock city={r.to} at={at} hour12={hour12} />
        </div>
      ) : (
        <Clock city={r.to} at={at} hour12={hour12} />
      )}
      {!spread && (
        <div className="answer-meta">
          {meta.join(' · ')}
          {r.live && <span className="live-dot" title="Updating live" />}
        </div>
      )}
      {fromZones.length > 1 && (
        <div className="answer-note">
          {r.countries.from.name} has {fromZones.length} time zones — read the time as{' '}
          {r.from.city} ({abbreviation(at, r.from.zone) || offsetLabel(at, r.from.zone)}). Name a
          city to use another.
        </div>
      )}
      {r.notes.map((n) => (
        <div key={n} className="answer-note">
          {n}
        </div>
      ))}
      {r.corrections.length > 0 && (
        <div className="answer-note">
          Read {r.corrections.map((c) => `“${c.typed}” as ${c.city}`).join(' and ')}
        </div>
      )}
    </div>
  )
}

/**
 * A search-style prompt bar. Questions are parsed in the browser (lib/ask.js);
 * a good answer drives the converter above through `onApply` and shows as a
 * single result card. Each question replaces the last; earlier ones stay one
 * click away as "recent" chips.
 */
export default function ChatBar({ current, hour12, onApply }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [recent, setRecent] = useState([])
  const [busy, setBusy] = useState(false)
  const [, setTick] = useState(0)
  const inputRef = useRef(null)

  // A "right now" answer keeps time with the clocks above it.
  const liveAnswer = result?.ok && result.live
  useEffect(() => {
    if (!liveAnswer) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [liveAnswer])

  const send = async (question) => {
    const q = question.trim()
    if (!q || busy) return
    setBusy(true)
    try {
      const r = await ask(q, current)
      if (r.ok) onApply(r)
      setResult(r)
      setRecent((list) => [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX))
      setText('')
    } catch {
      setResult({ ok: false, reason: 'error' })
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const chips = recent.length ? recent : EXAMPLES

  return (
    <section className="ask" aria-label="Ask about a time">
      <form
        className="prompt"
        onSubmit={(e) => {
          e.preventDefault()
          send(text)
        }}
      >
        <span className="prompt-icon" aria-hidden="true">
          <SparkIcon />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask anything — “3pm London in Tokyo”, “time in Sydney”"
          aria-label="Ask a time zone question"
          autoComplete="off"
          enterKeyHint="search"
        />
        <button
          type="submit"
          className={'prompt-send' + (busy ? ' busy' : '')}
          disabled={!text.trim() || busy}
          aria-label="Ask"
          title="Ask"
        >
          <SendIcon />
        </button>
      </form>

      <div aria-live="polite">
        {result &&
          (result.ok ? (
            <Answer r={result} hour12={hour12} />
          ) : (
            <div className="answer answer-miss">
              {result.reason === 'error' ? 'Something went wrong reading that. Try rephrasing it.' : problem(result)}
            </div>
          ))}
      </div>

      <div className="chips">
        <span className="chips-label">{recent.length ? 'Recent' : 'Try'}</span>
        {chips.map((c) => (
          <button key={c} type="button" className="chip" onClick={() => send(c)}>
            {c}
          </button>
        ))}
        {recent.length > 0 && (
          <button
            type="button"
            className="chips-clear"
            onClick={() => {
              setRecent([])
              setResult(null)
            }}
          >
            Clear
          </button>
        )}
      </div>
    </section>
  )
}
