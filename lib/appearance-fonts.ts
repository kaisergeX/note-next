import {Inter, Literata, Newsreader, Source_Sans_3} from 'next/font/google'
import localFont from 'next/font/local'

const inter = Inter({subsets: ['latin'], variable: '--font-inter'})
const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
})

// Optional preset fonts load when used, without preloading them for everyone.
const googleSans = localFont({
  src: [
    {
      path: './fonts/google-sans/GoogleSans-Variable.woff2',
      weight: '400 700',
      style: 'normal',
    },
    {
      path: './fonts/google-sans/GoogleSans-Italic-Variable.woff2',
      weight: '400 700',
      style: 'italic',
    },
  ],
  variable: '--font-google-sans',
  adjustFontFallback: 'Arial',
  preload: false,
})
const sourceSans = Source_Sans_3({
  variable: '--font-source-sans',
  subsets: ['latin', 'vietnamese'],
  style: ['normal', 'italic'],
  preload: false,
})
const literata = Literata({
  variable: '--font-literata',
  subsets: ['latin', 'vietnamese'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  preload: false,
})

export const appearanceFontVariables = [
  inter.variable,
  newsreader.variable,
  googleSans.variable,
  sourceSans.variable,
  literata.variable,
].join(' ')
