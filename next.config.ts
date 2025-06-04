import type {NextConfig} from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

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
export default withNextIntl(nextConfig)
