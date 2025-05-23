import {createNavigation} from 'next-intl/navigation'
import {defineRouting} from 'next-intl/routing'

export const localeRouting = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'vi'],

  // If this locale is matched, pathnames work without a prefix (e.g. `/any`)
  defaultLocale: 'en',
})

// Lightweight wrappers around Next.js' navigation
// APIs that consider the routing configuration
export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(localeRouting)
