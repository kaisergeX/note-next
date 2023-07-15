import {getRequestConfig} from 'next-intl/server'
import {localeConfig} from './config/localization'

export default getRequestConfig(async ({locale}) => {
  const localeFile = localeConfig.locales.includes(locale)
    ? locale
    : localeConfig.defaultLocale

  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    messages: (await import(`./dictionaries/${localeFile}.json`)).default,
  }
})
