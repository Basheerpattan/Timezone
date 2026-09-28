import { Inter } from 'next/font/google'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '../lib/site.js'
import './globals.css'

// next/font self-hosts Inter at build time: no render-blocking request to
// fonts.googleapis.com, and no layout shift from a late swap.
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_TAGLINE} — ${SITE_NAME}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'time zone converter',
    'world clock',
    'time difference',
    'meeting planner',
    'utc offset',
    'daylight saving time',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_TAGLINE} — ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_TAGLINE} — ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
  },
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235b8cff' stroke-width='2'><circle cx='12' cy='12' r='9'/><path d='M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18'/></svg>",
        type: 'image/svg+xml',
      },
    ],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7f8fa',
}

// Runs before first paint so a returning visitor who chose dark never sees a
// flash of light. It has to be inline — a bundled script would arrive after
// the first frame. A first-time visitor gets light, which is what :root
// already declares, so there is nothing to correct.
//
// To follow the operating system instead, make the fallback:
//   t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
// and mirror it in storedTheme() in components/Converter.jsx.
const THEME_SCRIPT = `(function () {
  try {
    var t = localStorage.getItem('tzc.theme')
    if (t !== 'light' && t !== 'dark') t = 'light'
    document.documentElement.dataset.theme = t
  } catch (e) {
    document.documentElement.dataset.theme = 'light'
  }
})()`

export default function RootLayout({ children }) {
  return (
    // The theme script rewrites data-theme before React hydrates, which would
    // otherwise be reported as a mismatch.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
