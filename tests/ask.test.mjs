// Regression tests for the search bar's parser and the city search under it.
//
//   npm test
//
// Every case here was a real bug or a behaviour someone asked for, so a
// failure means a change broke something a visitor would notice.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

// The gazetteer is fetched from /places.txt in the browser; serve it from disk.
globalThis.fetch = async () => ({
  ok: true,
  text: async () => readFileSync(new URL('../public/places.txt', import.meta.url), 'utf8'),
})

const { ask } = await import('../src/lib/ask.js')
const { countryZones, findById, searchCities } = await import('../src/data/cities.js')
const { editDistance } = await import('../src/lib/fuzzy.js')
const { addDays, formatYMD } = await import('../src/lib/time.js')

const current = {
  from: findById('Kolkata|Asia/Kolkata'),
  to: findById('London|Europe/London'),
}
const today = (zone) => formatYMD(new Date(), zone)

/** Ask, and insist it succeeded. */
async function ok(question) {
  const r = await ask(question, current)
  assert.ok(r.ok, `"${question}" failed: ${JSON.stringify(r)}`)
  return r
}

describe('conversions', () => {
  test('time after the city it belongs to', async () => {
    const r = await ok('3pm London in Tokyo')
    assert.equal(r.from.city, 'London')
    assert.equal(r.to.city, 'Tokyo')
    assert.equal(r.timeStr, '15:00')
    assert.equal(r.dateStr, today('Europe/London'))
    assert.equal(r.live, false)
  })

  test('"in X" after the time names the owner, wherever it sits', async () => {
    const r = await ok('tokyo time at 9am in nyc')
    assert.equal(r.from.city, 'New York')
    assert.equal(r.to.city, 'Tokyo')
    assert.equal(r.timeStr, '09:00')
  })

  test('city before the time owns it when another follows', async () => {
    const r = await ok('London 3pm to Tokyo')
    assert.equal(r.from.city, 'London')
  })

  test('a trailing time belongs to the first city', async () => {
    const r = await ok('NYC to Kolkata tomorrow 9:30am')
    assert.equal(r.from.city, 'New York')
    assert.equal(r.to.city, 'Kolkata')
    assert.equal(r.timeStr, '09:30')
    assert.equal(r.dateStr, addDays(today('America/New_York'), 1))
  })

  test('24-hour times and month names', async () => {
    const r = await ok('Paris to Chennai on Oct 5 at 18:00')
    assert.equal(r.timeStr, '18:00')
    assert.match(r.dateStr, /-10-05$/)
  })

  test('noon, weekdays and "my time"', async () => {
    const r = await ok('noon Friday in Berlin to my time')
    assert.equal(r.from.city, 'Berlin')
    assert.equal(r.timeStr, '12:00')
    const [y, m, d] = r.dateStr.split('-').map(Number)
    assert.equal(new Date(Date.UTC(y, m - 1, d)).getUTCDay(), 5)
  })

  test('two cities and no time is live', async () => {
    const r = await ok('difference between Dubai and LA')
    assert.equal(r.from.city, 'Dubai')
    assert.equal(r.to.city, 'Los Angeles')
    assert.equal(r.live, true)
  })

  test('one city and no time shows it live', async () => {
    const r = await ok('time in Sydney')
    assert.equal(r.to.city, 'Sydney')
    assert.equal(r.live, true)
    assert.equal(r.single, true)
  })
})

describe('refusals', () => {
  for (const [question, reason] of [
    ['hello', 'no-place'],
    ['weather please', 'no-place'],
    ['please convert', 'no-place'],
    ['time in xyzzyq', 'unknown'],
    ['london to london', 'same'],
  ]) {
    test(`"${question}" → ${reason}`, async () => {
      const r = await ask(question, current)
      assert.equal(r.ok, false)
      assert.equal(r.reason, reason)
    })
  }
})

describe('spelling', () => {
  test('names typed without their spaces', async () => {
    assert.equal((await ok('what is time in newyork')).to.city, 'New York')
    assert.equal((await ok('3pm losangeles in hongkong')).to.city, 'Hong Kong')
  })

  for (const [typed, city] of [
    ['new yrok', 'New York'],
    ['londn', 'London'],
    ['tokio', 'Tokyo'],
    ['sydeny', 'Sydney'],
    ['kolkatta', 'Kolkata'],
    ['chicgo', 'Chicago'],
    ['amsterdm', 'Amsterdam'],
    ['dubaii', 'Dubai'],
    ['eindhovn', 'Eindhoven'],
  ]) {
    test(`typo "${typed}" → ${city}, and says so`, async () => {
      const r = await ok('time in ' + typed)
      assert.equal(r.to.city, city)
      assert.equal(r.corrections.length, 1)
    })
  }

  test('a real town is not "corrected" into a famous one', async () => {
    const r = await ok('time in pune')
    assert.equal(r.to.city, 'Pune')
    assert.equal(r.corrections.length, 0)
  })

  test('swapped letters count as one edit', () => {
    assert.equal(editDistance('newyrok', 'newyork', 2), 1)
    assert.equal(editDistance('abc', 'xyz', 1), Infinity)
  })
})

describe('countries', () => {
  for (const [name, city] of [
    ['usa', 'New York'],
    ['america', 'New York'],
    ['canada', 'Toronto'],
    ['australia', 'Sydney'],
  ]) {
    test(`"${name}" searches to ${city} first`, () => {
      assert.equal(searchCities(name)[0].city, city)
    })
  }

  test('a multi-zone country is flagged, with every zone listed', async () => {
    const r = await ok('time in usa')
    assert.equal(r.countries.to.cc, 'US')
    const zones = countryZones('US', new Date())
    assert.ok(zones.length >= 6, `only ${zones.length} US zones`)
    // East to west, each zone led by its best-known city.
    assert.equal(zones[0].lead.city, 'New York')
    const leads = zones.map((z) => z.lead.city)
    for (const city of ['Chicago', 'Los Angeles', 'Honolulu']) assert.ok(leads.includes(city), city)
  })

  test('a city that shares its country name stays a city', async () => {
    const r = await ok('time in singapore')
    assert.equal(r.countries.to, null)
  })
})

describe('abbreviations', () => {
  for (const [question, from, to] of [
    ['3pm PST to IST', 'Los Angeles', 'New Delhi'],
    ['9am EST to CET', 'New York', 'Paris'],
    ['10am ET to PT', 'New York', 'Los Angeles'],
    ['6pm JST to AEST', 'Tokyo', 'Sydney'],
    ['noon GMT to SGT', 'UTC', 'Singapore'],
    ['8am BST to GST', 'London', 'Dubai'],
  ]) {
    test(`"${question}"`, async () => {
      const r = await ok(question)
      assert.equal(r.from.city, from)
      assert.equal(r.to.city, to)
      assert.equal(r.live, false)
      assert.ok(r.notes.some((n) => n.includes(' read as ')))
    })
  }

  test('an ambiguous code says what else it could mean', async () => {
    const r = await ok('3pm IST to London')
    assert.ok(r.notes.some((n) => n.includes('Israel')))
  })

  test('the picker finds abbreviations too', () => {
    assert.equal(searchCities('ist')[0].city, 'New Delhi')
    assert.equal(searchCities('est')[0].city, 'New York')
    assert.equal(searchCities('pt')[0].city, 'Los Angeles')
  })

  test('UTC offsets, not mistaken for a time of day', async () => {
    const r = await ok('3pm UTC+5:30 to London')
    assert.equal(r.from.zone, 'Asia/Kolkata')
    assert.equal(r.timeStr, '15:00')
    const west = await ok('time in gmt-10')
    assert.equal(west.to.zone, 'Pacific/Honolulu')
  })
})
