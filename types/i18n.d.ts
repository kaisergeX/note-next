import type {Locales} from '.'
import type messages from '../dictionaries/en.json'

declare module 'next-intl' {
  interface AppConfig {
    Locale: Locales
    Messages: typeof messages
  }
}
