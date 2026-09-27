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
 * Parses the researcher's question script into an ordered question list.
 * Textarea lines map 1:1 to questions (leading list markers stripped, blank
 * lines dropped) — the review-step design: Detect questions fills the
 * textarea, the user edits it, Create uses the lines as-is. No LLM here.
 */
export function parseQuestionScript(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(RUN_SCRIPT_LIST_MARKER, '').trim())
    .filter((line) => line.length > 0)
}
