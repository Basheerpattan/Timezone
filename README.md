# 🌍 Timezone — Time Zone Converter

A fast, free time zone converter. Pick two places and instantly see the time in both.

Built with **Next.js 16** and **React 19**.

---

## ✨ Features

- **Compare any two places** — 230,000+ cities, towns and states, plus every time zone.
- **Ask in plain English** — type things like:
  - `3pm London in Tokyo`
  - `NYC to Kolkata tomorrow 9:30`
  - `time in Sydney`
- **Smart search** — understands nicknames (NYC, Bombay), zone codes (IST, PST, CET) and typos.
- **Live clocks** — times update every second.
- **Plan ahead** — choose any date and time, not just "now".
- **Daylight saving handled** — warns you when a time is skipped or happens twice.
- **Shareable links** — copy the page link and send it to anyone.
- **Light and dark mode** — your choice is remembered.

---

## 🚀 Getting Started

You need **Node.js 20.9 or newer**.

```bash
# 1. Install dependencies
npm install

# 2. Start the app
npm run dev
```

Then open **http://localhost:3000** in your browser.

---

## 📜 Commands

| Command              | What it does                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Start the app for development                 |
| `npm run build`      | Build the app for production                  |
| `npm start`          | Run the production build                      |
| `npm test`           | Run the tests                                 |
| `npm run cf:preview` | Test the Cloudflare version locally (port 8787) |
| `npm run cf:deploy`  | Deploy to Cloudflare                          |

---

## 📁 Project Structure

```
src/
  app/          Pages and routes (home page, city-to-city pages, sitemap)
  components/   UI pieces (converter, city picker, chat search bar)
  lib/          Time calculations, search parsing, URL helpers
  data/         City and time zone lists
public/
  places.txt    Big list of 230k places (loaded only when you search)
scripts/        Scripts that regenerate the data files
tests/          Automated tests
```

---

## 🔗 Page URLs

| URL                    | Shows                                  |
| ---------------------- | -------------------------------------- |
| `/`                    | The main converter                     |
| `/new-york/to/london`  | A ready-made page for one city pair    |
| `/sitemap.xml`         | List of all pages (for search engines) |

---

## ☁️ Deployment

### Option 1 — Cloudflare (recommended, free for commercial use)

This project is already set up for Cloudflare.

```bash
npx wrangler login     # log in once
npm run cf:deploy      # build and deploy
```

Your site will be live at `https://chronoglobe.<your-subdomain>.workers.dev`.

### Option 2 — Vercel (free for personal use)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New → Project** and pick this repository.
3. Click **Deploy**. No settings to change.

### Using your own domain

Set this environment variable to your domain so links and the sitemap point to it:

```
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

- **Cloudflare:** add it under `"vars"` in `wrangler.jsonc`, then deploy again.
- **Vercel:** add it in **Project → Settings → Environment Variables**, then redeploy.

---

## 🛠️ Common Tasks

**Add a city** — add a line to `src/data/cities.js`:

```js
['Tallinn', 'Estonia', 'EE', 'Europe/Tallinn', 'reval eet'],
//  name     country   code  time zone         extra search words (optional)
```

**Change colors** — edit the color variables at the top of `src/app/globals.css`
(one block for light mode, one for dark mode).

**Update time zone data** — run `npm run gen:zones`.

---

## 💡 How It Works (short version)

- Time math uses the browser's built-in time zone database — no extra libraries.
- Popular city-pair pages are built ahead of time so they load instantly and show up in Google.
- The large places list is downloaded only when you open a search box, so the page loads fast.
