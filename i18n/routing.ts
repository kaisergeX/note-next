import {defineRouting} from 'next-intl/routing'

export const localeRouting = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'vi'],

  // If this locale is matched, pathnames work without a prefix (e.g. `/any`)
  defaultLocale: 'en',
})
