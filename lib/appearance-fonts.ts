import {Inter, Literata, Newsreader, Source_Sans_3} from 'next/font/google'

const inter = Inter({subsets: ['latin'], variable: '--font-inter'})
const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
})

// Optional preset fonts load when used, without preloading them for everyone.
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
  sourceSans.variable,
  literata.variable,
].join(' ')
