import {hasLocale, type AppConfig} from 'next-intl'
import * as rootParams from 'next/root-params'
import {getRequestConfig} from 'next-intl/server'
import {localeRouting} from './routing'

export default getRequestConfig(async ({locale}) => {
  // Explicit override (e.g. getTranslations({locale}) from route handlers
  // or server actions) wins. Only read root params when no override exists.
  let resolvedLocale = locale
  if (resolvedLocale && !hasLocale(localeRouting.locales, resolvedLocale)) {
    resolvedLocale = localeRouting.defaultLocale
  }
  if (!resolvedLocale) {
    try {
      const paramValue = await rootParams.locale()
      resolvedLocale = hasLocale(localeRouting.locales, paramValue)
        ? paramValue
        : localeRouting.defaultLocale
    } catch {
      // Outside [locale] segment (e.g. /api routes)
      resolvedLocale = localeRouting.defaultLocale
    }
  }

  return {
    locale: resolvedLocale,
    messages: (
      (await import(`../dictionaries/${resolvedLocale}.json`)) as {
        default: AppConfig['Messages']
      }
    ).default,
  }
})
