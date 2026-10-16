/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Import paths must not use alias, otherwise it will cause error.
 */

import createPlugin from 'tailwindcss/plugin'
import {themePgEnum, type NoteTheme} from '../db/schema/notes'

const customizableThemes = themePgEnum.enumValues.filter(
  (theme) => theme !== 'encrypted',
)

const typographyThemePalette = [
  {element: 'body', pallete: 800},
  {element: 'headings', pallete: 900},
  {element: 'lead', pallete: 700},
  {element: 'links', pallete: 900},
  {element: 'bold', pallete: 900},
  {element: 'counters', pallete: 600},
  {element: 'bullets', pallete: 400},
  {element: 'hr', pallete: 300},
  {element: 'quotes', pallete: 900},
  {element: 'quote-borders', pallete: 300},
  {element: 'captions', pallete: 700},
  {element: 'code', pallete: 900},
  {element: 'code-pg', pallete: 300},
  {element: 'pre-code', pallete: 100},
  {element: 'pre-bg', pallete: 900},
]

// Dark-mode counterpart of `typographyThemePalette`: flips each prose color var
// to the light end of the hue family so text stays readable on the dark
// hue-tinted card background (e.g. body 800 -> 300 ≈ 4.7:1 on dialog cards).
const darkTypographyThemePalette: Record<string, number> = {
  body: 300,
  headings: 200,
  lead: 300,
  links: 300,
  bold: 200,
  counters: 400,
  bullets: 400,
  hr: 600,
  quotes: 200,
  'quote-borders': 600,
  captions: 400,
  code: 200,
  'code-pg': 800,
  'pre-code': 300,
  'pre-bg': 950,
}

export const twNoteThemeConfig: {
  theme: NoteTheme
  picker: string
  dialog: string
  themeShadow: string
  themeBorder: string
}[] = customizableThemes.map((theme) => ({
  theme,
  picker: `bg-${theme}-400`,
  dialog: `bg-${theme}-100 text-${theme}-800 dark:bg-[color-mix(in_oklab,var(--color-${theme}-950)_15%,var(--paper-raised))] dark:text-${theme}-300`,
  themeShadow: `shadow-${theme}-500/20`,
  themeBorder: `border-${theme}-400`,
}))

// type TypographyThemeProps = Partial<
//   Record<
//     NoteTheme,
//     {
//       css: Record<string, string>
//     }
//   >
// >
// export const typographyThemeBuilder = (
//   utils: PluginAPI,
// ): TypographyThemeProps => {
//   const typoTheme: TypographyThemeProps = {}
//   for (const themeName of customizableThemes) {
//     const css: Record<string, string> = {}
//     for (const {element, pallete} of typographyThemePalette) {
//       css[`--tw-prose-${element}`] = utils.theme(
//         `colors.${themeName}[${pallete}]`,
//       ) as string
//     }

//     typoTheme[themeName] = {css}
//   }

//   return typoTheme
// }

export const customTypographyPlugin = createPlugin((pluginApi) => {
  const components: Record<string, any> = {}

  for (const color of customizableThemes) {
    const css: Record<string, string> = {}
    const darkCss: Record<string, string> = {}
    for (const {element, pallete} of typographyThemePalette) {
      css[`--tw-prose-${element}`] = pluginApi.theme(
        `colors.${color}.${pallete}`,
      ) as string
      darkCss[`--tw-prose-${element}`] = pluginApi.theme(
        `colors.${color}.${darkTypographyThemePalette[element]}`,
      ) as string
    }

    components[`.prose-${color}`] = {
      ...css,
      '&:where(.dark, .dark *)': darkCss,
    }
  }

  pluginApi.addComponents(components)
})

const twNoteThemeBuilder = (pluginApi: any) =>
  twNoteThemeConfig.reduce(
    (acc: Record<string, Record<string, any>>, config) => {
      acc[`.dialog-${config.theme}`] = {
        backgroundColor: pluginApi.theme(
          `colors.${config.theme}.100`,
        ) as string,
        color: pluginApi.theme(`colors.${config.theme}.800`) as string,
        '&:where(.dark, .dark *)': {
          backgroundColor: `color-mix(in oklab, var(--color-${config.theme}-950) 15%, var(--paper-raised))`,
          color: pluginApi.theme(`colors.${config.theme}.300`) as string,
        },
      }

      acc[`.picker-${config.theme}`] = {
        [`@apply ${config.picker}`]: {},
      }

      acc[`.shadow-theme-${config.theme}`] = {
        [`@apply ${config.themeShadow}`]: {},
      }

      acc[`.border-theme-${config.theme}`] = {
        [`@apply ${config.themeBorder}`]: {},
      }
      return acc
    },
    {},
  )

export const customThemePlugin = createPlugin((pluginApi) => {
  pluginApi.addComponents(twNoteThemeBuilder(pluginApi))
})

const prefixes = ['prose', 'dialog', 'picker', 'shadow-theme', 'border-theme']
export const tailwindSourceInline = `@source inline("{${prefixes.join('-,')}}{${customizableThemes.join(',')}}");\n`
