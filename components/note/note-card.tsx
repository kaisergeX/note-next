import {cn} from 'cn'
import type {ReactNode} from 'react'
import type {NoteTheme} from '~/db/schema/notes'

export default function NoteCard({
  theme,
  children,
  className,
}: {
  theme?: NoteTheme | null
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'group relative rounded-lg transition-shadow',
        theme
          ? `dialog-${theme} shadow-theme-${theme}`
          : 'bg-paper-raised border-hairline hover:shadow-sheet focus-within:shadow-sheet border',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function NoteCardSummary({
  title,
  content,
  theme,
  plainText = false,
  compact = false,
}: {
  title: string | null
  content: string | null
  theme?: NoteTheme | null
  plainText?: boolean
  compact?: boolean
}) {
  const prose = theme ? `prose-${theme}` : 'prose-appearance'
  return (
    <>
      {title && (
        <article
          className={cn(
            'prose sm:prose-lg line-clamp-3 font-semibold wrap-anywhere sm:leading-normal',
            prose,
          )}
          {...(plainText
            ? {children: title}
            : {dangerouslySetInnerHTML: {__html: title}})}
        />
      )}
      <article
        className={cn(
          'prose pt-3 wrap-anywhere',
          compact ? 'line-clamp-2' : 'line-clamp-10',
          prose,
        )}
        {...(plainText
          ? {children: content}
          : {dangerouslySetInnerHTML: {__html: content || ''}})}
      />
    </>
  )
}
