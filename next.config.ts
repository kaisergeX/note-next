import type {NextConfig} from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import withSerwistInit from '@serwist/next'

const nextConfig: NextConfig = {
  transpilePackages: ['@kaiverse/k'],
  experimental: {
    // ppr: true,
    optimizePackageImports: ['@kaiverse/k'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
  },
}

const withNextIntl = createNextIntlPlugin('./i18n.ts')

// PWA & Service Worker support
const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // disable: process.env.NODE_ENV === 'development',
})

export default withNextIntl(withSerwist(nextConfig))
