/**
 * Question-script parsing for batch runs: pure text handling, no LLM and no
 * server-only imports, so both server actions and client components can use
 * it (the 'use server' actions file must only export async functions).
 */

/** Leading list marker on a script line ("1.", "2)", "•", "-", …). */
const RUN_SCRIPT_LIST_MARKER = /^\s*(?:\d+[.)]|[·•*\-–—])\s+/

export const RUN_SCRIPT_MAX_QUESTIONS = 50

export const RUN_SCRIPT_MAX_QUESTION_LENGTH = 1000

/**
 * Strips a leading list marker ("1.", "2)", "•", "-", …) from a line and
 * trims the remainder. Shared by parseQuestionScript and the LLM question-
 * extraction parser (interview actions) so both normalize lines alike.
 */
export function stripListMarker(line: string): string {
  return line.replace(RUN_SCRIPT_LIST_MARKER, '').trim()
}

/**
 * Lowercases, NFC-normalizes, and strips everything that is not a letter or
 * digit (unicode property escapes keep Vietnamese diacritics intact). Used
 * as the comparison basis for verbatim repair matching.
 */
export function normalizeForMatch(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

/** Classic Levenshtein edit distance via a single-row DP. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let previous = new Array<number>(b.length + 1)
  let current = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) previous[j] = j
  for (let i = 1; i <= a.length; i++) {
    current[0] = i
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, substitution)
    }
    ;[previous, current] = [current, previous]
  }
  return previous[b.length]!
}

/**
 * Restores question text verbatim from the researcher's own paste: the model
 * output is used only for segmentation, so special characters survive
 * exactly. Finds the best-matching source line by normalized Levenshtein
 * similarity and returns the ORIGINAL source line when the similarity clears
 * `minSimilarity`; otherwise the (possibly corrupted) model line passes
 * through unchanged.
 */
export function repairVerbatimLine(
  modelLine: string,
  sourceLines: string[],
  minSimilarity = 0.55,
): string {
  if (sourceLines.length === 0) return modelLine
  const modelNorm = normalizeForMatch(modelLine)
  let bestLine: string | undefined
  let bestSimilarity = -1
  for (const sourceLine of sourceLines) {
    const sourceNorm = normalizeForMatch(sourceLine)
    const maxLen = Math.max(modelNorm.length, sourceNorm.length)
    if (maxLen === 0) continue
    // Length-gap early-skip: the Levenshtein distance is at least the
    // length delta, so when even that best case leaves the similarity
    // under the threshold the pair cannot clear it — skip the O(len²) DP.
    // Keeps the worst-case server-action cost bounded for long lines.
    const lengthGapSimilarity =
      1 - Math.abs(modelNorm.length - sourceNorm.length) / maxLen
    if (lengthGapSimilarity < minSimilarity) continue
    const distance = levenshtein(modelNorm, sourceNorm)
    const similarity = 1 - distance / maxLen
    if (similarity >= minSimilarity && similarity > bestSimilarity) {
      bestSimilarity = similarity
      bestLine = sourceLine
    }
  }
  return bestLine ?? modelLine
}

/**
 * True when a '?'-less line looks like a section header rather than a
 * question (e.g. "II. CHUYÊN MÔN → GIÁ TRỊ DỊCH VỤ"): after stripping the
 * list marker, the remaining letters are ALL uppercase (Vietnamese range
 * À-Ỹ + Đ + A-Z) with at least 2 of them, AND the line carries a header
 * marker — either a section separator ('→', '–' or '-') or a leading roman
 * numeral ("I.", "II.", "III.", …).
 *
 * Rationale: survey headers use ALL-CAPS + arrow/numbering; real shouted
 * questions without '?' (e.g. "ANH LÀM NGHỀ GÌ") are rare and recoverable
 * via manual edit, so prefer not silently dropping them — the old
 * all-caps-only rule dropped them.
 */
export function looksLikeSectionHeader(line: string): boolean {
  const withoutMarker = stripListMarker(line)
  const letters = withoutMarker.replace(/[^A-ZÀ-ỸĐa-zà-ỹđ]/gu, '')
  if (letters.length < 2 || letters !== letters.toUpperCase()) return false
  const hasSeparator = /→|–|-/.test(withoutMarker)
  const hasRomanMarker = /^\s*(?:I{1,3}|IV|V|VI{0,3})\s*[.:)-]?/i.test(
    withoutMarker,
  )
  return hasSeparator || hasRomanMarker
}

/**
 * Parses the researcher's question script into an ordered question list.
 * Textarea lines map 1:1 to questions (leading list markers stripped, blank
 * lines dropped) — the review-step design: Detect questions fills the
 * textarea, the user edits it, Create uses the lines as-is. No LLM here.
 */
export function parseQuestionScript(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map(stripListMarker)
    .filter((line) => line.length > 0)
}
