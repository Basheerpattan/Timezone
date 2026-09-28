import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/places.txt',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
        ],
      },
    ]
  },
}

export default nextConfig

// Gives `next dev` the same bindings the deployed Worker has (the KV cache,
// the asset store), backed by local simulations rather than the live ones.
// Safe to call during `next build` too — it only wires up dev.
initOpenNextCloudflareForDev()