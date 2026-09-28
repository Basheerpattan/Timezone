// Builds public/places.txt — the searchable gazetteer of world places.
//
//   node scripts/generate-places.mjs <geonames-dir>
//
// Inputs (download from https://download.geonames.org/export/dump/):
//   cities500.txt        every populated place with population >= 500
//   admin1CodesASCII.txt every state / province / region
//
// Output is a packed text file, fetched lazily by the app at first search.
// Layout — four sections separated by a line containing only "--":
//   1. tab-separated IANA zones           (referenced by index)
//   2. tab-separated "CC|Region name"     (referenced by index)
//   3. city rows
//   4. state rows
// Row: name \t asciiName \t cc \t regionIdx36 \t zoneIdx36 \t pop36
// asciiName is empty when it matches name case-insensitively.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) {
  console.error('usage: node scripts/generate-places.mjs <dir with cities500.txt, admin1.txt>')
  process.exit(1)
}

const b36 = (n) => n.toString(36)

// ── regions ────────────────────────────────────────────────────────────────
const regionName = new Map() // "IN.16" -> "Karnataka"
for (const line of readFileSync(join(dir, 'admin1.txt'), 'utf8').split('\n')) {
  const [code, name] = line.split('\t')
  if (code && name) regionName.set(code, name)
}

// ── cities ─────────────────────────────────────────────────────────────────
const zones = []
const zoneIdx = new Map()
const regions = []
const regionIdx = new Map()

const indexOfZone = (z) => {
  let i = zoneIdx.get(z)
  if (i === undefined) {
    i = zones.push(z) - 1
    zoneIdx.set(z, i)
  }
  return i
}
const indexOfRegion = (key) => {
  let i = regionIdx.get(key)
  if (i === undefined) {
    i = regions.push(key) - 1
    regionIdx.set(key, i)
  }
  return i
}

const seen = new Map() // name|cc|admin1 -> row, keeping the most populous
const rows = []
const statePop = new Map() // "IN.16" -> { pop, zone } of its largest city

const raw = readFileSync(join(dir, 'cities500.txt'), 'utf8')
for (const line of raw.split('\n')) {
  if (!line) continue
  const f = line.split('\t')
  const name = f[1]
  const ascii = f[2]
  const cc = f[8]
  const admin1 = f[10]
  const pop = Number(f[14]) || 0
  const zone = f[17]
  if (!name || !cc || !zone) continue

  const regionKey = cc + '.' + admin1
  const region = regionName.get(regionKey) || ''

  // Track each region's biggest city, to give the region itself a time zone.
  const best = statePop.get(regionKey)
  if (region && (!best || pop > best.pop)) statePop.set(regionKey, { pop, zone, cc, region })

  const dedupe = name.toLowerCase() + '|' + cc + '|' + admin1
  const prev = seen.get(dedupe)
  if (prev && prev.pop >= pop) continue

  const row = {
    name,
    ascii: ascii && ascii.toLowerCase() !== name.toLowerCase() ? ascii : '',
    cc,
    region: indexOfRegion(cc + '|' + region),
    zone: indexOfZone(zone),
    pop,
  }
  if (prev) rows[prev.i] = row
  else {
    row.i = rows.length
    seen.set(dedupe, row)
    rows.push(row)
  }
}

// Biggest places first, so ties in the search fall towards well-known ones.
rows.sort((a, b) => b.pop - a.pop)

const cityLines = rows.map((r) =>
  [r.name, r.ascii, r.cc, b36(r.region), b36(r.zone), b36(r.pop)].join('\t')
)

// ── states ─────────────────────────────────────────────────────────────────
const stateLines = []
for (const [key, info] of statePop) {
  const name = info.region
  if (!name) continue
  stateLines.push(
    [name, '', info.cc, b36(indexOfRegion(info.cc + '|' + name)), b36(indexOfZone(info.zone)), b36(info.pop)].join('\t')
  )
}
stateLines.sort()

const out = [
  zones.join('\t'),
  regions.join('\t'),
  cityLines.join('\n'),
  stateLines.join('\n'),
].join('\n--\n')

mkdirSync(new URL('../public/', import.meta.url), { recursive: true })
writeFileSync(new URL('../public/places.txt', import.meta.url), out)

console.log(
  'wrote %d cities, %d states, %d zones, %d regions — %s MB',
  cityLines.length,
  stateLines.length,
  zones.length,
  regions.length,
  (Buffer.byteLength(out) / 1048576).toFixed(1)
)
