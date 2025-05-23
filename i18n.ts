import {hasLocale, type AppConfig} from 'next-intl'
import {getRequestConfig} from 'next-intl/server'
import {localeRouting} from './config/localization'

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale
  const locale = hasLocale(localeRouting.locales, requested)
    ? requested
    : localeRouting.defaultLocale

  return {
    locale,
    messages: (
      (await import(`./dictionaries/${locale}.json`)) as {
        default: AppConfig['Messages']
      }
    ).default,
  }
})
