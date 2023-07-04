// eslint-disable-next-line @typescript-eslint/no-var-requires
const withNextIntl = require('next-intl/plugin')()

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    domains: ['pbs.twimg.com'],
  },
}

module.exports = withNextIntl(nextConfig)
