import type {NoteTheme} from '~/db/schema/notes'

// Plain-text summaries only. React escapes the result; never insert it as HTML.
export function noteText(html: string | null) {
  return (html ?? '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(
      /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
      (_, entity: string) => {
        const named: Record<string, string> = {
          amp: '&',
          lt: '<',
          gt: '>',
          quot: '"',
          apos: "'",
          nbsp: ' ',
        }
        if (!entity.startsWith('#')) return named[entity.toLowerCase()] ?? ''
        const value =
          entity[1].toLowerCase() === 'x'
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10)
        return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : ''
      },
    )
    .replace(/\s+/g, ' ')
    .trim()
}

export type TrashItem = {
  id: string
  title: string
  excerpt: string
  deadlineToken: string
  theme?: NoteTheme | null
}
