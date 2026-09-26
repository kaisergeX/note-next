export const AI_LOCALES = {
  'vi-VN': {regions: ['Bắc', 'Trung', 'Nam']},
} as const
export type AiLocale = keyof typeof AI_LOCALES
export type AiRegion = (typeof AI_LOCALES)[AiLocale]['regions'][number]

export const AI_DEFAULT_LOCALE: AiLocale = 'vi-VN'

// LM Studio via Tailscale Funnel — one-line model A/B swap
export const LM_STUDIO_ENDPOINT =
  process.env.LM_STUDIO_ENDPOINT ?? 'http://localhost:1234/v1'
export const LM_STUDIO_API_KEY = process.env.LM_STUDIO_API_KEY ?? ''
export const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL ?? ''

// Sampler constants (DRY sampler etc. are server-side LM Studio settings — never replicated here)
export const AI_SAMPLER = {
  temperature: 1.0,
  min_p: 0.1,
  top_p: null, // disabled
  top_k: null, // disabled
  enable_thinking: false, // explicitly off
} as const
