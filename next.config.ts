import type {NextConfig} from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
  transpilePackages: ['@kaiverse/k'],
  cacheComponents: true,
  cacheLife: {
    neverRevalidate: {
      revalidate: 2592000, // 30 days in seconds
    },
  },
  experimental: {
    globalNotFound: true,
    optimizePackageImports: ['@kaiverse/k'],
    instantInsights: {
      validationLevel: 'manual-warning',
    },
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

const withNextIntl = createNextIntlPlugin()

export default withNextIntl(nextConfig)
