/**
 * Import paths must not use alias, otherwise it will cause error.
 */

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
  dialog: `bg-${theme}-100 text-${theme}-800`,
  themeShadow: `shadow-${theme}-500/20!`,
}))

type TypographyThemeProps = Partial<
  Record<
    NoteTheme,
    {
      css: Record<string, string>
    }
  >
>
export const typographyThemeBuilder = (
  theme: (theme: string) => string,
): TypographyThemeProps => {
  const typoTheme: TypographyThemeProps = {}
  for (const themeName of customizableThemes) {
    const css: Record<string, string> = {}
    for (const {element, pallete} of typographyThemePalette) {
      css[`--tw-prose-${element}`] = theme(`colors.${themeName}[${pallete}]`)
    }

    typoTheme[themeName] = {css}
  }

  return typoTheme
}

export const twNoteThemeBuilder = twNoteThemeConfig.reduce(
  (acc: Record<string, Record<string, unknown>>, config) => {
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

// https://tailwindcss.com/docs/content-configuration#safelisting-classes
export const safelistClasses = twNoteThemeConfig.flatMap(({theme}) => [
  `prose-${theme}`,
  `dialog-${theme}`,
  `picker-${theme}`,
  `shadow-theme-${theme}`,
])
