import {hasLocale, type AppConfig} from 'next-intl'
import * as rootParams from 'next/root-params'
import {getRequestConfig} from 'next-intl/server'
import {localeRouting} from './routing'

export default getRequestConfig(async () => {
  const requested = await rootParams.locale()
  const locale = hasLocale(localeRouting.locales, requested)
    ? requested
    : localeRouting.defaultLocale

  return {
    locale,
    messages: (
      (await import(`../dictionaries/${locale}.json`)) as {
        default: AppConfig['Messages']
      }
    ).default,
  }
})
