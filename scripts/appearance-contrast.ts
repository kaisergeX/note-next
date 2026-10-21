import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import postcss from 'postcss'
import {APPEARANCE_IDS} from '../lib/appearance'

// Run with `node --import tsx scripts/appearance-contrast.ts`. Read the shipped tokens,
// interpolate in Oklab, clip to sRGB, then apply WCAG relative luminance.
const css = postcss.parse(readFileSync('app/globals.css', 'utf8'))
const selectors = [
  ':root',
  '.dark',
  ...APPEARANCE_IDS.filter((id) => id !== 'paper-ink').flatMap((id) => [
    `html[data-appearance='${id}']`,
    `html.dark[data-appearance='${id}']`,
  ]),
]
const palettes = new Map<string, Record<string, string>>()
css.walkRules((rule) => {
  for (const selector of selectors) {
    if (!rule.selectors.includes(selector)) continue
    const values: Record<string, string> = {}
    rule.each((node) => {
      if (node.type === 'decl') values[node.prop] = node.value
    })
    palettes.set(selector, {...palettes.get(selector), ...values})
  }
})

function lab(value: string, tokens: Record<string, string>): number[] {
  if (value.startsWith('var(')) return lab(tokens[value.slice(4, -1)], tokens)
  const lch = value.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/)
  if (lch) {
    const [, l, c, h] = lch.map(Number)
    return [
      l,
      c * Math.cos((h * Math.PI) / 180),
      c * Math.sin((h * Math.PI) / 180),
    ]
  }
  const mix = value.match(
    /^color-mix\(in oklab, var\((--[\w-]+)\) (\d+)%, var\((--[\w-]+)\)\)$/,
  )
  assert(mix, `Unsupported color: ${value}`)
  const a = lab(tokens[mix[1]], tokens),
    b = lab(tokens[mix[3]], tokens),
    weight = Number(mix[2]) / 100
  return a.map((v, i) => v * weight + b[i] * (1 - weight))
}

function luminance([l, a, b]: number[]) {
  const x = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const y = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const z = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z,
    -1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z,
    -0.0041960863 * x - 0.7034186147 * y + 1.707614701 * z,
  ]
    .map((v) => Math.max(0, Math.min(1, v)))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
}

const pairs: [string, string, number][] = [
  ['ink', 'paper', 12],
  ['paper', 'ink', 12],
  ...[
    'ink',
    'ink-muted',
    'accent',
    'destructive',
    'success',
    'warning',
  ].flatMap((fg) =>
    ['paper', 'paper-raised'].map((bg): [string, string, number] => [
      fg,
      bg,
      4.5,
    ]),
  ),
  ['paper', 'ink-hover', 4.5],
  ['paper', 'destructive', 4.5],
  ['accent', 'raised-hover', 4.5],
  ['control-border', 'paper', 3],
  ['control-border', 'paper-raised', 3],
]
const results: string[][] = []
for (const appearance of APPEARANCE_IDS) {
  for (const mode of ['light', 'dark']) {
    const presetSelector = `html[data-appearance='${appearance}']`
    const darkPresetSelector = `html.dark[data-appearance='${appearance}']`
    if (appearance !== 'paper-ink') {
      assert(
        palettes.has(presetSelector),
        `Missing ${appearance} light palette`,
      )
      assert(
        palettes.has(darkPresetSelector),
        `Missing ${appearance} dark palette`,
      )
    }
    const tokens = {
      ...palettes.get(':root'),
      ...(mode === 'dark' ? palettes.get('.dark') : {}),
      ...(appearance !== 'paper-ink' ? palettes.get(presetSelector) : {}),
      ...(appearance !== 'paper-ink' && mode === 'dark'
        ? palettes.get(darkPresetSelector)
        : {}),
    }
    results.push(
      pairs.map(([fg, bg, minimum]) => {
        const a = luminance(lab(tokens[`--${fg}`], tokens))
        const b = luminance(lab(tokens[`--${bg}`], tokens))
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
        assert(
          ratio >= minimum,
          `${appearance}/${mode}: ${fg}/${bg} ${ratio.toFixed(2)} < ${minimum}`,
        )
        return ratio.toFixed(2)
      }),
    )
  }
}
console.log(
  `| Foreground / background | Minimum | ${APPEARANCE_IDS.flatMap((id) => [`${id} light`, `${id} dark`]).join(' | ')} |`,
)
console.log(
  `| --- | ---: | ${APPEARANCE_IDS.flatMap(() => ['---:', '---:']).join(' | ')} |`,
)
pairs.forEach(([fg, bg, minimum], i) =>
  console.log(
    `| ${fg} / ${bg} | ${minimum}:1 | ${results.map((r) => `${r[i]}:1`).join(' | ')} |`,
  ),
)
