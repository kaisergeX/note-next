// import defaultTheme from 'tailwindcss/defaultTheme'
import plugin from 'tailwindcss/plugin'
import {
  safelistClasses,
  twNoteThemeBuilder,
  typographyThemeBuilder,
} from './config/tailwindTheme'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      typography: (theme) => ({
        DEFAULT: {
          css: {
            code: {
              '&::before, &::after': {
                display: 'none',
              },
            },
            a: {
              '&:hover': {
                color: 'var(--color-blue-400)',
              },
            },
          },
        },
        ...typographyThemeBuilder(theme),
      }),
    },
  },
  plugins: [
    plugin((pluginApi) => {
      pluginApi.addComponents(twNoteThemeBuilder)
    }),
  ],
  safelist: [
    // https://github.com/ycs77/headlessui-float/blob/main/packages/react/src/class-resolvers/tailwindcss.ts
    'origin-bottom',
    'origin-top',
    'origin-right',
    'origin-left',
    'origin-bottom-left',
    'origin-bottom-right',
    'origin-top-left',
    'origin-top-right',
    ...safelistClasses,
  ],
}
