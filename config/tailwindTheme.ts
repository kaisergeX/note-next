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

export const twNoteThemeConfig: {
  theme: NoteTheme
  picker: string
  dialog: string
  themeShadow: string
}[] = customizableThemes.map((theme) => ({
  theme,
  picker: `bg-${theme}-400`,
  dialog: `bg-${theme}-100 text-${theme}-800 dark:bg-${theme}-100/80`,
  themeShadow: `shadow-${theme}-500/20!`,
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
    for (const {element, pallete} of typographyThemePalette) {
      css[`--tw-prose-${element}`] = pluginApi.theme(
        `colors.${color}.${pallete}`,
      ) as string
    }

    components[`.prose-${color}`] = css
  }

  pluginApi.addComponents(components)
})

const twNoteThemeBuilder = twNoteThemeConfig.reduce(
  (acc: Record<string, Record<string, any>>, config) => {
    acc[`.dialog-${config.theme}`] = {
      [`@apply ${config.dialog}`]: {},
    }

    acc[`.picker-${config.theme}`] = {
      [`@apply ${config.picker}`]: {},
    }

    acc[`.shadow-theme-${config.theme}`] = {
      [`@apply ${config.themeShadow}`]: {},
    }
    return acc
  },
  {},
)

export const customThemePlugin = createPlugin((pluginApi) => {
  pluginApi.addComponents(twNoteThemeBuilder)
})

const prefixes = ['prose', 'dialog', 'picker', 'shadow-theme']
export const tailwindSourceInline = `@source inline("{${prefixes.join('-,')}}{${customizableThemes.join(',')}}");\n`
