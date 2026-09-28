'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import ChatBar from './ChatBar.jsx'
import CityPicker from './CityPicker.jsx'
import { CheckIcon, GlobeIcon, LinkIcon, MoonIcon, SunIcon, SwapIcon } from './icons.jsx'
import { detectLocal, findById } from '../data/cities.js'
import {
  abbreviation,
  addDays,
  diffLabel,
  diffMinutes,
  dstNote,
  formatFullDate,
  formatHHMM,
  formatTime,
  formatYMD,
  offsetLabel,
  zonedParts,
  zonedTimeToDate,
} from '../lib/time.js'
import { findPlaceBySlug } from '../data/places.js'
import { readParams, shareLink, syncUrl } from '../lib/url.js'

const THEME_KEY = 'tzc.theme'
// How far the time steppers move per click. Half an hour covers meeting slots
// and reaches a whole hour in two clicks.
const STEP_MINUTES = 30

// The server has no layout to measure, so useLayoutEffect would only warn
// there. On the client it runs before paint, which is what the first tick
// needs: the server-rendered time is replaced without a visible stale frame.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect

// Light unless this visitor has toggled to dark before. Must agree with the
// inline THEME_SCRIPT in app/layout.jsx, which does the same thing before
// React ever runs.
function storedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage blocked — the default stands, the theme just won't persist */
  }
  return 'light'
}

// Tints the browser's own chrome (address bar on mobile, title bar on some
// desktops) to match. Kept in step with the toggle rather than with the OS.
const CHROME_TINT = { light: '#f7f8fa', dark: '#0b0d12' }

/**
 * The whole interactive app.
 *
 * Every piece of initial state comes from props rather than from the browser,
 * so the first client render is identical to the server's. Anything only the
 * browser knows — the visitor's own time zone, the query string, the saved
 * theme — is applied in an effect straight after mount.
 */
export default function Converter({ fromId, toId, serverNow, routed = false }) {
  const initialFrom = useMemo(() => findById(fromId), [fromId])
  const initialTo = useMemo(() => findById(toId), [toId])

  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [theme, setTheme] = useState('light')
  const [hour12, setHour12] = useState(true)
  const [tick, setTick] = useState(() => new Date(serverNow))
  const [live, setLive] = useState(true)
  const [dateStr, setDateStr] = useState(() => formatYMD(new Date(serverNow), initialFrom.zone))
  const [timeStr, setTimeStr] = useState(() => formatHHMM(new Date(serverNow), initialFrom.zone))
  const [copied, setCopied] = useState(false)
  // Until this flips, the URL still describes the server's guess, so writing
  // to it would clobber the query string we are about to read.
  const [hydrated, setHydrated] = useState(false)
  const [pendingSlugs, setPendingSlugs] = useState(null)

  // Replace the server's build-time clock with the real one before the browser
  // paints, so nobody ever sees a stale time.
  useBeforePaint(() => {
    setTick(new Date())
  }, [])

  // Apply everything that only the browser knows, once.
  useEffect(() => {
    const params = readParams()

    // On a /a/to/b page the path already named both cities, so only an
    // explicit query string may override them.
    const nextFrom = params.from || (routed ? null : detectLocal())
    const nextTo =
      params.to ||
      (routed || !nextFrom
        ? null
        : nextFrom.zone === 'America/New_York'
          ? findById('London|Europe/London')
          : findById('New York|America/New_York'))

    if (nextFrom) setFrom(nextFrom)
    if (nextTo && (!nextFrom || nextTo.id !== nextFrom.id)) setTo(nextTo)

    if (params.dateStr && params.timeStr) {
      setDateStr(params.dateStr)
      setTimeStr(params.timeStr)
      setLive(false)
    }
    if (params.hour12 !== null) setHour12(params.hour12)

    setTheme(storedTheme())

    // Slugs the built-in list did not answer may still be villages in the
    // lazy gazetteer; resolve those after mount rather than blocking paint.
    if ((!params.from && params.slugs.from) || (!params.to && params.slugs.to)) {
      setPendingSlugs({
        from: params.from ? '' : params.slugs.from,
        to: params.to ? '' : params.slugs.to,
      })
    }

    setHydrated(true)
  }, [routed])

  useEffect(() => {
    const id = setInterval(() => setTick(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', CHROME_TINT[theme])
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* storage blocked — the theme just won't persist */
    }
  }, [theme])

  useEffect(() => {
    if (!hydrated) return
    syncUrl({ from, to, live, dateStr, timeStr, hour12 }, routed)
  }, [hydrated, routed, from, to, live, dateStr, timeStr, hour12])

  // A shared link may name a village that only exists in the lazy gazetteer.
  useEffect(() => {
    if (!pendingSlugs) return
    let cancelled = false
    for (const [key, setter] of [
      ['from', setFrom],
      ['to', setTo],
    ]) {
      const slug = pendingSlugs[key]
      if (!slug) continue
      findPlaceBySlug(slug).then((place) => {
        if (place && !cancelled) setter(place)
      })
    }
    return () => {
      cancelled = true
    }
  }, [pendingSlugs])

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(id)
  }, [copied])

  // While live, the inputs mirror the running clock in the "from" city.
  const shownDate = live ? formatYMD(tick, from.zone) : dateStr
  const shownTime = live ? formatHHMM(tick, from.zone) : timeStr

  const instant = useMemo(() => {
    if (live) return tick
    const [year, month, day] = dateStr.split('-').map(Number)
    const [hour, minute] = timeStr.split(':').map(Number)
    return zonedTimeToDate({ year, month, day, hour, minute }, from.zone)
  }, [live, tick, dateStr, timeStr, from.zone])

  const freeze = useCallback(() => {
    // Moving off "live" keeps whatever is currently on screen.
    if (!live) return
    setDateStr(formatYMD(tick, from.zone))
    setTimeStr(formatHHMM(tick, from.zone))
    setLive(false)
  }, [live, tick, from.zone])

  const nudgeDay = (n) => {
    freeze()
    setDateStr((d) => addDays(live ? formatYMD(tick, from.zone) : d, n))
  }

  /**
   * Step the time by `mins`, rolling over into the date. Wall-clock arithmetic
   * rather than instant arithmetic, so it matches the date stepper and the
   * typed input — if the result is an hour that DST skips, the note says so.
   */
  const nudgeTime = (mins) => {
    freeze()
    const day = live ? formatYMD(tick, from.zone) : dateStr
    const [h, m] = (live ? formatHHMM(tick, from.zone) : timeStr).split(':').map(Number)

    let total = h * 60 + m
    // Coming off the live clock, snap onto the step grid: 14:26 +30 becomes
    // 14:30, rather than carrying the odd minutes along as 14:56.
    if (live) {
      const step = Math.abs(mins)
      total = (mins > 0 ? Math.floor(total / step) : Math.ceil(total / step)) * step
    }
    total += mins

    const shift = Math.floor(total / 1440)
    total = ((total % 1440) + 1440) % 1440

    setDateStr(shift ? addDays(day, shift) : day)
    setTimeStr(
      String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0')
    )
  }

  const copyLink = () => {
    navigator.clipboard
      ?.writeText(shareLink({ from, to, live, dateStr, timeStr, hour12 }, routed))
      .then(
        () => setCopied(true),
        () => setCopied(false)
      )
  }

  const swap = () => {
    // The typed time belongs to the "from" city, so carry it across the swap.
    if (!live) {
      setDateStr(formatYMD(instant, to.zone))
      setTimeStr(formatHHMM(instant, to.zone))
    }
    setFrom(to)
    setTo(from)
  }

  // An answer from the chat bar replaces the whole view in one go.
  const applyAsk = useCallback(({ from, to, live, dateStr, timeStr }) => {
    setFrom(from)
    setTo(to)
    setLive(live)
    if (!live) {
      setDateStr(dateStr)
      setTimeStr(timeStr)
    }
  }, [])

  const delta = diffMinutes(instant, to.zone, from.zone)
  const a = zonedParts(instant, from.zone)
  const b = zonedParts(instant, to.zone)
  const dayGap = Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000
  )
  const note = live ? null : dstNote(dateStr, timeStr, from.zone)

  const side = (city, target) => (
    <div className={'panel side' + (target ? ' target' : '')}>
      <CityPicker
        label={target ? 'To' : 'From'}
        city={city}
        now={instant}
        hour12={hour12}
        onChange={target ? setTo : setFrom}
      />
      <div className="big-time" suppressHydrationWarning>
        {formatTime(instant, city.zone, hour12)}
      </div>
      <div className="sub-line" suppressHydrationWarning>
        {formatFullDate(instant, city.zone)}
        {target && dayGap === 1 && <span className="daybadge">Next day</span>}
        {target && dayGap === -1 && <span className="daybadge">Previous day</span>}
      </div>
      <div className="zone-line">
        {[abbreviation(instant, city.zone), offsetLabel(instant, city.zone), city.zone]
          .filter(Boolean)
          .map((part, i) => (
            <span key={part}>
              {i > 0 && <span className="sep">&middot;&nbsp;</span>}
              {part}
            </span>
          ))}
      </div>
    </div>
  )

  return (
    <>
      <div className="backdrop" aria-hidden="true" />

      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <GlobeIcon />
            </div>
            <div>
              <h1>Time Zone Converter</h1>
              <p>Compare the time between any two countries and cities.</p>
            </div>
          </div>

          <div className="tools">
            <div className="seg" role="group" aria-label="Time format">
              <button className={hour12 ? 'on' : ''} onClick={() => setHour12(true)}>
                12h
              </button>
              <button className={!hour12 ? 'on' : ''} onClick={() => setHour12(false)}>
                24h
              </button>
            </div>
            <button
              className={'icon-btn' + (copied ? ' ok' : '')}
              onClick={copyLink}
              title="Copy a link to this view"
              aria-label="Copy link"
            >
              {copied ? <CheckIcon /> : <LinkIcon />}
            </button>
            <button
              className="icon-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </header>

        <ChatBar current={{ from, to }} hour12={hour12} onApply={applyAsk} />

        <div className="panel bar">
          <div className="bar-when">
            <label className="bar-label" htmlFor="at-date">
              Date and time in {from.city}
            </label>
            <div className="bar-controls">
              <span className="field">
                <button
                  className="step"
                  onClick={() => nudgeDay(-1)}
                  title="Previous day"
                  aria-label="Previous day"
                >
                  &minus;
                </button>
                <input
                  id="at-date"
                  type="date"
                  value={shownDate}
                  suppressHydrationWarning
                  onChange={(e) => {
                    if (!e.target.value) return
                    freeze()
                    setDateStr(e.target.value)
                  }}
                />
                <button
                  className="step"
                  onClick={() => nudgeDay(1)}
                  title="Next day"
                  aria-label="Next day"
                >
                  +
                </button>
              </span>

              <span className="field">
                <button
                  className="step"
                  onClick={() => nudgeTime(-STEP_MINUTES)}
                  title={STEP_MINUTES + ' minutes earlier'}
                  aria-label={STEP_MINUTES + ' minutes earlier'}
                >
                  &minus;
                </button>
                <input
                  id="at-time"
                  type="time"
                  aria-label={'Time in ' + from.city}
                  value={shownTime}
                  suppressHydrationWarning
                  onChange={(e) => {
                    if (!e.target.value) return
                    freeze()
                    setTimeStr(e.target.value)
                  }}
                />
                <button
                  className="step"
                  onClick={() => nudgeTime(STEP_MINUTES)}
                  title={STEP_MINUTES + ' minutes later'}
                  aria-label={STEP_MINUTES + ' minutes later'}
                >
                  +
                </button>
              </span>

              <button className="btn" onClick={() => setLive(true)} disabled={live}>
                Now
              </button>
            </div>
          </div>

          <div className="bar-right">
            <div className={'delta-big' + (delta === 0 ? ' same' : '')}>{diffLabel(delta)}</div>
            <div className="delta-sub">
              {to.city} relative to {from.city}
            </div>
          </div>
        </div>

        {note && (
          <p className="note" role="status">
            {note.kind === 'skipped' ? (
              <>
                <strong>{note.asked}</strong> doesn&rsquo;t exist in {from.city} on this date &mdash;
                clocks jump forward for daylight saving. Showing <strong>{note.shown}</strong>{' '}
                instead.
              </>
            ) : (
              <>
                <strong>{note.asked}</strong> happens twice in {from.city} on this date, as clocks go
                back for daylight saving. Showing the first.
              </>
            )}
          </p>
        )}

        <div className="convert">
          {side(from, false)}
          <div className="swap-wrap">
            <button className="swap" onClick={swap} title="Swap cities" aria-label="Swap cities">
              <SwapIcon />
            </button>
          </div>
          {side(to, true)}
        </div>

        <p className="summary" suppressHydrationWarning>
          <strong>{formatTime(instant, from.zone, hour12)}</strong> in {from.city} is{' '}
          <strong>{formatTime(instant, to.zone, hour12)}</strong> in {to.city}
          {dayGap === 1 ? ', the next day' : dayGap === -1 ? ', the previous day' : ''}.
          {live && <span className="live-dot" title="Updating live" />}
        </p>
      </div>
    </>
  )
}
