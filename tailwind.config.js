// import defaultTheme from 'tailwindcss/defaultTheme'
import {tailwindcssOriginSafelist} from '@headlessui-float/react'

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['var(--font-inter)'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
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
                color: theme('colors.blue.400'),
              },
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@headlessui/tailwindcss'),
    ({addComponents, addVariant}) => {
      addComponents({
        '.flex-center-between': {
          // '@apply flex items-center justify-between gap-4': {},
          alignItems: 'center',
          justifyContent: 'space-between',
          display: 'flex',
          gap: '1rem',
        },
        '.flex-center': {
          alignItems: 'center',
          justifyContent: 'center',
          display: 'flex',
          gap: '1rem',
        },
        '.disabled': {
          '@apply pointer-events-none cursor-not-allowed opacity-50': {},
        },
      })
      addVariant(
        'sm-only',
        "@media screen and (max-width: theme('screens.sm'))",
      )
    },
  ],
  safelist: [...tailwindcssOriginSafelist],
}
