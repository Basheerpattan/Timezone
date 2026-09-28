<<<<<<< HEAD
# 🌍 ChronoGlobe — Time Zone Converter

Pick a **From** city and a **To** city, see the time in both. Built on **Next.js 16 (App
Router)** with **React 19**, prerendered to static HTML and deployed on Vercel.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # prerenders the site
npm start        # serve the production build locally
```

## Why Next.js

The app used to be a client-only Vite SPA: one blank `index.html` that filled in once the
JavaScript ran. That is invisible to search engines, and "new york to london time" is a
query people type thousands of times a day.

The App Router rebuild keeps every one of the original React components and adds a server
layer around them:

| | Vite SPA | Next.js App Router |
| --- | --- | --- |
| HTML delivered | empty `<div id="root">` | full page, already showing both clocks |
| Indexable URLs | 1 | 871 prerendered + unlimited on demand |
| Per-page titles | one, fixed | generated per city pair |
| Fonts | render-blocking Google Fonts request | self-hosted at build time |
| Hosting | any static host | Vercel, with ISR |

## Routes

```
/                          the converter, with popular pairs below it
/new-york/to/london        a page per city pair — the SEO surface
/?from=x&to=y&at=…&fmt=24  the escape hatch for gazetteer places
/sitemap.xml  /robots.txt  generated from the same city list
```

871 pair pages are prerendered at build time from the 30 busiest cities
(`TOP` in `src/lib/pair.js`). Any other pair of known cities — all 400-odd of them — still
works: it renders on the first request and is cached from then on (`dynamicParams`). A pair
that names a city nobody knows 404s rather than serving an empty page.

Each pair page revalidates daily, so the stated UTC offsets follow daylight saving without a
redeploy. The home page revalidates hourly.

## How it works

- Two pickers — click either one, type a city, country or zone ("India", "New York",
  "Abidjan", "Asia/Tokyo"), arrow keys + Enter to choose.
- **Every time zone, and ~230k places** — search resolves in three layers:
  1. ~109 **curated cities** with aliases (Bombay, NYC, PST) — these win ties.
  2. All **321 IANA zones**, so Kiritimati and the Antarctic bases are reachable.
  3. A lazy **gazetteer** of 229,709 cities, towns and villages plus 3,784 states
     and provinces, fetched on first search (see below).
- Both times update live every second, with the date, zone abbreviation where one exists
  (EDT, PST) and the UTC offset underneath.
- **⇄** swaps the two sides.
- The difference between the zones is shown at the bottom right (e.g. `+9h 30m`).
- **Any date and time, not just now** — set the date and time (read as wall-clock time in
  the **From** city), step days with − / +, or hit **Now** to go back to live.
- A *Next day* / *Previous day* badge appears when the two cities are on different dates.
- **Shareable links** — the whole view lives in the address, so it survives a reload and can
  be pasted to someone else. The link button in the header copies it.

      /kolkata/to/new-york?at=2026-11-01T14:30&fmt=24

- **Daylight-saving warnings** — ask for 2:30 AM in New York on a spring-forward date and
  the app says that time doesn't exist and shows what it used instead; on a fall-back date
  it flags the hour that happens twice.
- **Search that understands aliases** — "Bombay", "Bangalore", "NYC", "UAE", "Saigon",
  "USA", and zone shorthand like "IST", "PST" or "CET" all resolve. Matching is
  word-prefix based, so "usa" no longer matches *Jer**usa**lem*.
- **Light and dark themes** — light by default, dark one click away in the header. Your
  choice is remembered. An inline script in the root layout applies it before first paint,
  so a returning dark-mode visitor never sees a flash of light.

## Server and client

`src/components/Converter.jsx` is the whole interactive app and carries `'use client'`.
Everything else under `src/app/` runs on the server.

The rule that keeps hydration clean: **no browser-only value is read during render.** The
converter's initial state comes entirely from props — `fromId`, `toId` and `serverNow` —
so the first client render is identical to the server's HTML. The things only a browser
knows are applied in one effect straight after mount:

- the visitor's own time zone (`detectLocal()`),
- the query string,
- the saved theme.

The live clock is handled the same way. The server renders the time at `serverNow`; the
client hydrates with that exact value, then a `useLayoutEffect` replaces it with the real
time *before the browser paints*, so no stale time is ever visible.

## Time math

No date library. Offsets and daylight saving come from the browser's own IANA database
via `Intl.DateTimeFormat`, so they're always current — including half-hour zones like
Kolkata (UTC+5:30) and Kathmandu (UTC+5:45). See `src/lib/time.js`.

The prerendered pages deliberately never state a clock time in their indexable text — a
cached page claiming "it is 3:14 PM in Tokyo" is wrong seconds later. They state the
*offset gap*, which is stable for months. See `src/lib/pair.js`.

## Files

```
src/
  app/
    layout.jsx               metadata, theme script, self-hosted Inter
    page.jsx                 home page + popular pairs
    [from]/to/[to]/page.jsx  the prerendered pair pages
    sitemap.js  robots.js    generated from the city list
    not-found.jsx            404
    globals.css              theme tokens (:root = light, [data-theme='dark'])
  components/
    Converter.jsx            'use client' — the whole interactive app
    CityPicker.jsx           'use client' — the searchable dropdown
    PairLinks.jsx            server-rendered link grid
    icons.jsx                inline line icons
  lib/
    time.js                  time zone helpers
    url.js                   address-bar read/write (both URL shapes)
    pair.js                  pair facts, prebuilt list, related links
    site.js                  absolute URLs for canonical/OG/sitemap
  data/
    cities.js                city → IANA zone list, local-zone detection
    zones.js                 GENERATED — every IANA zone + country code
    places.js                lazy gazetteer: fetch, index, search
public/places.txt            GENERATED — 230k places + 3.8k states (6 MB)
scripts/                     data generators
```

## Theming

Every colour is a CSS custom property declared twice in `src/app/globals.css` — once on
`:root` (light, the default) and once on `[data-theme='dark']`. Nothing else hardcodes a
colour, so restyling means editing those two blocks.

To add a city, append a row to `raw` in `src/data/cities.js` — the flag comes from the
ISO-2 country code automatically, and the fifth field is optional search aliases:

```js
['Tallinn', 'Estonia', 'EE', 'Europe/Tallinn', 'reval eet'],
```

Country-wide search terms (so every US city answers to "usa") live in `COUNTRY_ALIASES`
in the same file.

## The gazetteer

`public/places.txt` holds every populated place GeoNames records with a population of
500 or more, plus every admin-1 region (state, province, oblast). It is 6.2 MB — about
2.5 MB gzipped — and is **not** part of the JS bundle: it is fetched the first time a
picker opens, so first paint never waits for it. `next.config.mjs` serves it with a
one-year immutable cache header. If the fetch fails the app carries on with the built-in
city list.

Loading and indexing takes ~230 ms and ~36 MB of heap; a keystroke resolves in 0.1–6 ms.
That speed comes from a word-prefix bucket index — every word of every name is bucketed
by its first two letters, so a query scans a few hundred candidates instead of 230k rows.
Ties break on population, so "springfield" leads with Missouri.

### Coverage caveat

GeoNames stores population 0 for most Indian villages, so the ≥500 filter drops them:
India has only ~7,000 entries here. The full per-country dumps do have them — India's
own file lists 557,995 populated places. To go deeper, download a country file
(`https://download.geonames.org/export/dump/IN.zip`) and extend the generator to accept
feature class `P` regardless of population.

### Regenerating

```bash
# download cities500.zip + admin1CodesASCII.txt, unzip into <dir>
node scripts/generate-places.mjs <dir>
```

## Regenerating the zone table

`src/data/zones.js` is generated — every IANA zone paired with its ISO-2 country code, as
a 6 KB string. Country *names* are not embedded; the browser derives them from the code
via `Intl.DisplayNames`. After a tzdata update:

```bash
npm run gen:zones
```

`countries-and-timezones` is a devDependency used only by that script. The app itself
still ships with zero runtime dependencies beyond React and Next.

---

# Publishing

## 1. Put the project in its own Git repository

**This matters:** `Downloads/rentx` is currently *inside* the repository at
`C:\Users\PattanNagurBasheer` — it has no `.git` of its own. Give it one before doing
anything else:

```bash
cd /c/Users/PattanNagurBasheer/Downloads/rentx
git init -b main
git add .
git commit -m "ChronoGlobe: Next.js App Router rebuild"
```

Check that the gazetteer actually went in — the old `.gitignore` excluded `places.txt`,
`index.html` and `assets`, which would have shipped a broken deploy:

```bash
git ls-files public/places.txt     # must print the path
```

## 2. Push to GitHub

```bash
gh repo create chronoglobe --public --source=. --remote=origin --push
```

Or, without the `gh` CLI: create an empty repo on github.com, then

```bash
git remote add origin https://github.com/<you>/chronoglobe.git
git push -u origin main
```

## 3. Deploy on Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project**, pick the `chronoglobe` repo, **Import**.
3. Change nothing. Vercel detects Next.js, and the framework preset already runs
   `next build` and serves the output. Click **Deploy**.
4. About a minute later you get `https://chronoglobe-<hash>.vercel.app`.

Every push to `main` redeploys. Every pull request gets its own preview URL.

Prefer the terminal?

```bash
npm i -g vercel
vercel          # preview deploy, answers the setup prompts once
vercel --prod   # production deploy
```

## 4. Set the site URL

Canonical links, Open Graph tags and `sitemap.xml` need an absolute URL. On Vercel this
works with no configuration — `src/lib/site.js` falls back to
`VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets for you.

Once a custom domain is attached, override it so nothing points at the `.vercel.app`
address: **Project → Settings → Environment Variables**

```
NEXT_PUBLIC_SITE_URL = https://yourdomain.com
```

Then redeploy. (Env var changes do not take effect until the next deployment.)

## 5. Custom domain

**Project → Settings → Domains → Add.** Vercel then tells you which record to create at
your registrar:

| Record | Name | Value |
| --- | --- | --- |
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

Vercel issues the HTTPS certificate automatically once DNS propagates (minutes to a few
hours). Confirm the exact values in the dashboard — they occasionally change.

## 6. After going live

- Submit `https://yourdomain.com/sitemap.xml` in
  [Google Search Console](https://search.google.com/search-console) so the 871 pair pages
  get crawled.
- Run Lighthouse on a pair page — it should be near-perfect; the only heavy asset is the
  gazetteer, and that is not fetched until someone opens a picker.
- To prerender more pairs, add slugs to `TOP` in `src/lib/pair.js`. It is quadratic:
  30 cities → 870 pages, 50 → 2,450.

---

# Deploying to Cloudflare Workers

Vercel's free tier forbids commercial use; Cloudflare's does not, and it does not meter
bandwidth — which matters here, because the 6 MB gazetteer is the largest thing this site
ships. The adapter is already configured in this repo.

## What is already set up

| File | Purpose |
| --- | --- |
| `open-next.config.ts` | Tells the adapter to keep ISR working, backed by Workers KV |
| `wrangler.jsonc` | Worker name, asset directory, KV binding, compatibility flags |
| `public/_headers` | Edge cache rules — Cloudflare serves assets before the Worker runs, so `headers()` in `next.config.mjs` never sees them |
| `next.config.mjs` | Calls `initOpenNextCloudflareForDev()` so `npm run dev` gets the same bindings as production |
| `.dev.vars` | `NEXTJS_ENV=development` for local runs |

## 1. Sign up and log in

Create a free account at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
No payment method is needed for Workers, Workers KV or static assets.

```bash
npx wrangler login
```

A browser window opens; approve the request. Confirm it worked:

```bash
npx wrangler whoami
```

## 2. Create the KV namespace

This is where rendered pages are cached, which is what makes `revalidate` do anything.

```bash
npx wrangler kv namespace create NEXT_INC_CACHE_KV
```

It prints something like:

```
{ "binding": "NEXT_INC_CACHE_KV", "id": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4" }
```

Copy that `id` into `wrangler.jsonc`, replacing `PASTE_KV_NAMESPACE_ID_HERE`. This is the
only manual edit in the whole process.

## 3. Try it locally first

```bash
npm run cf:preview
```

This builds the Worker and runs it in `workerd` — the real Cloudflare runtime, not a Node
imitation — on http://localhost:8787. If the app works here it will work deployed.

## 4. Deploy

```bash
npm run cf:deploy
```

A minute later you have `https://chronoglobe.<your-subdomain>.workers.dev`.

## 5. Set the site URL

Canonical links, Open Graph tags and `sitemap.xml` need an absolute URL, and unlike Vercel,
Cloudflare does not provide one automatically. Set it as a secret-free plain variable —
add this to `wrangler.jsonc` and redeploy:

```jsonc
"vars": {
  "NEXT_PUBLIC_SITE_URL": "https://chronoglobe.<your-subdomain>.workers.dev"
}
```

Because it is `NEXT_PUBLIC_`, it is read at **build** time, so it must be set before
`cf:deploy` runs, not afterwards.

## 6. Custom domain

Your domain has to use Cloudflare for DNS — which is free, and the point at which
Cloudflare is easier than everyone else.

1. **Dashboard → Add a site**, enter the domain, pick the **Free** plan.
2. Cloudflare scans your existing records and gives you two nameservers.
3. Change the nameservers at your registrar to those two. Propagation takes minutes to a
   few hours.
4. Once the domain is active: **Workers & Pages → chronoglobe → Settings → Domains &
   Routes → Add → Custom domain**, enter `yourdomain.com`.

The certificate is issued automatically. No A or CNAME records to manage — Cloudflare is
already authoritative for the zone.

Then update `NEXT_PUBLIC_SITE_URL` to the real domain and redeploy.

## 7. Continuous deployment from GitHub

Optional; the CLI is enough on its own. To redeploy on every push, add
`.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx opennextjs-cloudflare build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy
```

Create the token at **My Profile → API Tokens → Create Token → Edit Cloudflare Workers**,
then add it to the repo under **Settings → Secrets and variables → Actions** as
`CLOUDFLARE_API_TOKEN`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Normal Next.js dev server, with Cloudflare bindings available |
| `npm run cf:preview` | Build and run the real Worker locally on :8787 |
| `npm run cf:deploy` | Build and deploy to Cloudflare |
| `npm run cf:typegen` | Regenerate binding types after changing `wrangler.jsonc` |
| `npx wrangler tail` | Live-stream logs from the deployed Worker |

## Free plan headroom

| Resource | Free limit | What this app uses |
| --- | --- | --- |
| Static asset bandwidth | Unlimited | The 6 MB gazetteer, all JS and CSS |
| Static asset requests | Unlimited | Every prerendered page, served from the edge |
| Worker invocations | 100,000/day | Only uncached ISR renders |
| KV reads | 100,000/day | One per ISR page served from cache |
| KV writes | 1,000/day | One per page that actually expires and is re-requested |
| Builds | 500/month | Only if using GitHub Actions |

The binding constraint is KV writes, and only in the unlikely case that a large share of
the 870 pair pages expire and get re-requested on the same day. If that happens, switch
the cache to R2 — the swap is two lines, documented at the top of `open-next.config.ts`.

## Known limits of the adapter

- `export const runtime = 'edge'` is not supported. This app does not use it.
- `next/image` optimization needs an `images` binding in `wrangler.jsonc`. This app does
  not use `next/image`.
- Node APIs work through the `nodejs_compat` flag, which is already set.

## Other hosts

- **Vercel** — the reference platform for the App Router, zero config, but the free Hobby
  tier is personal use only. See the section above.
- **Netlify** — works via `@netlify/plugin-nextjs`, installed automatically on import.
  Commercial use is allowed on the free plan; bandwidth is metered.
- **Any Node host** — `npm run build && npm start`, behind a reverse proxy on port 3000.
- **GitHub Pages** — would need `output: 'export'`, which drops ISR; every pair page would
  have to be prebuilt and offsets would go stale between deploys. Not recommended here.
=======
# Timezone
Fast time zone converter built with Next.js 16. Compare any two of 230,000+ cities live, or plan ahead with date and time. The plain-English search bar understands "3pm London in Tokyo", typos, time zone codes (PST, IST, CET), UTC offsets and multi-zone countries. Daylight saving is handled.
>>>>>>> e22bf7631eaf1018862d985f1ccd5a6c14503e4a
