// Supported-locale map. The per-locale payload is empty for now; future
// per-locale prompt config may live here.
export const AI_LOCALES = {
  'vi-VN': {},
} as const
export type AiLocale = keyof typeof AI_LOCALES

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

// Per-request timeout for LM Studio calls — well under the Hobby function
// ceiling (300s with Fluid compute) so the invoking action/route still has
// headroom for DB writes
export const AI_REQUEST_TIMEOUT_MS = 45_000

// Persona drafting emits a full JSON object (bio + systemPrompt); constrained
// decoding on the local model can exceed the 45s per-request default. Server-side
// timeout only — a deployed platform's execution ceiling still caps real runs.
export const AI_DRAFT_TIMEOUT_MS = 120_000
