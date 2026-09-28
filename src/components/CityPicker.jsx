'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CITIES, fuzzyCities, searchCities } from '../data/cities.js'
import { fuzzyPlaces, loadPlaces, placesReady, searchPlaces } from '../data/places.js'
import { formatTime } from '../lib/time.js'
import { CaretIcon } from './icons.jsx'

const LIMIT = 120

/** A button showing the chosen city; clicking it opens a searchable list. */
export default function CityPicker({ label, city, now, hour12, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // The gazetteer is fetched the moment the list opens, not at page load.
  const [gazetteer, setGazetteer] = useState(placesReady)
  useEffect(() => {
    if (open && !gazetteer) loadPlaces().then((db) => setGazetteer(Boolean(db)))
  }, [open, gazetteer])

  const exact = useMemo(() => {
    const base = searchCities(query)
    if (!gazetteer || query.trim().length < 2) return base
    // Built-in cities first (they carry aliases and better names), then every
    // other town, village and state, with duplicates of the same zone+name gone.
    const seen = new Set(base.map((c) => c.city.toLowerCase() + '|' + c.zone))
    const extra = searchPlaces(query, 200).filter((p) => {
      const key = p.city.toLowerCase() + '|' + p.zone
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return [...base, ...extra]
  }, [query, gazetteer])

  // Nothing spelled that way: offer the near misses ("londn", "new yrok").
  const all = useMemo(
    () =>
      exact.length || !query.trim()
        ? exact
        : [...fuzzyCities(query), ...(gazetteer ? fuzzyPlaces(query) : [])],
    [exact, query, gazetteer]
  )

  const matches = useMemo(() => all.slice(0, LIMIT), [all])

  // Times only change once a minute, so don't re-format 120 zones every second.
  const minute = Math.floor(now.getTime() / 60000)
  const times = useMemo(
    () => matches.map((c) => formatTime(now, c.zone, hour12)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matches, minute, hour12]
  )

  useEffect(() => setCursor(0), [query])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Keep the highlighted row in view while arrowing through the list.
  useEffect(() => {
    if (!open) return
    listRef.current?.children[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor, open])

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (c) => {
    onChange(c)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((i) => Math.min(i + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && matches[cursor]) {
      e.preventDefault()
      pick(matches[cursor])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="picker" ref={wrapRef}>
      <span className="picker-label">{label}</span>

      <button
        type="button"
        className="picker-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flag">{city.flag}</span>
        <span className="picker-text">
          <strong>{city.city}</strong>
          <small>{city.country}</small>
        </span>
        <span className="caret"><CaretIcon /></span>
      </button>

      {open && (
        <div className="picker-menu">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              gazetteer ? 'Search any city, village, state or zone…' : `Search ${CITIES.length} cities and time zones…`
            }
            aria-label="Search city, country or time zone"
          />
          <div className="picker-list" ref={listRef} role="listbox">
            {matches.length === 0 && <div className="picker-empty">No match for “{query}”</div>}
            {matches.map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={c.id === city.id}
                title={c.zone}
                className={'picker-item' + (i === cursor ? ' active' : '')}
                onMouseEnter={() => setCursor(i)}
                onClick={() => pick(c)}
              >
                <span className="flag">{c.flag}</span>
                <span className="picker-item-text">
                  <div className="name">
                    {c.city}
                    {c.isState && <span className="kind">State</span>}
                  </div>
                  <div className="sub">
                    {c.country}
                    <span className="zone-hint">{c.zone}</span>
                  </div>
                </span>
                <span className="zone">{times[i]}</span>
              </button>
            ))}
          </div>

          {all.length > matches.length ? (
            <div className="picker-more">
              Showing {matches.length} of {all.length} — keep typing to narrow.
            </div>
          ) : (
            !gazetteer && <div className="picker-more">Loading the full world list…</div>
          )}
        </div>
      )}
    </div>
  )
}
