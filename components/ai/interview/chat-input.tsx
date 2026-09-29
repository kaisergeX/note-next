'use client'

import {classNames} from '@kaiverse/k/utils'
import {
  IconChevronDown,
  IconChevronUp,
  IconPlayerStop,
  IconSend,
} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {useEffect, useLayoutEffect, useRef, useState} from 'react'

type ChatInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isBusy: boolean
  onStop: () => void
  maxLengthHint?: number
}

/**
 * ChatGPT/Claude-style composer: auto-growing textarea (2 natural rows, capped
 * at 160px, or up to 50dvh when expanded), an in-corner expand/collapse toggle
 * (shown once the content reaches 2 lines), a late char counter, and the
 * Send/Stop swap. The textarea stays editable while a reply streams so the
 * next question can be pre-drafted.
 */
export default function ChatInput({
  value,
  onChange,
  onSubmit,
  isBusy,
  onStop,
  maxLengthHint = 8000,
}: ChatInputProps) {
  const t = useTranslations('ai.interview.chat')
  const [isExpanded, setIsExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow: collapse to the natural height, then stretch to the content.
  // CSS max-height caps the box; overflow scrolling kicks in past the cap.
  // The same pass counts rendered lines; the expand toggle only appears once
  // the content is at least 2 lines tall. When the input shrinks back under
  // 2 lines the expanded mode is force-collapsed: it has no room for it.
  // useLayoutEffect(() => {
  //   const textarea = textareaRef.current
  //   if (!textarea) return
  //   if (isExpanded) {
  //     textarea.style.removeProperty('height')
  //     return
  //   }

  //   // Measure the content alone: at height 0 scrollHeight is exactly the
  //   // padded content, so the padding and the 2-row baseline are stripped.
  //   // Hide the scrollbar while measuring: it narrows the wrap width, which
  //   // would overcount line breaks that only exist during measurement.
  //   textarea.style.overflowY = 'hidden'
  //   textarea.style.height = '0px'
  //   const contentScrollHeight = textarea.scrollHeight + 2
  //   const style = getComputedStyle(textarea)
  //   const contentHeight =
  //     contentScrollHeight -
  //     parseFloat(style.paddingTop) -
  //     parseFloat(style.paddingBottom)
  //   const lineHeightPx = parseFloat(style.lineHeight) || 20
  //   const nextCanExpand = Math.floor(contentHeight / lineHeightPx) >= 2
  //   setCanExpand(nextCanExpand)
  //   if (!nextCanExpand) setIsExpanded(false)
  //   // Then set the working height: auto collapses to the content (CSS rows
  //   // baseline), clamped by the CSS max-height caps. Restore overflow so the
  //   // CSS overflow-y-auto class applies again after measurement.
  //   textarea.style.height = 'auto'
  //   textarea.style.height = `${textarea.scrollHeight + 2}px`
  //   textarea.style.overflowY = ''
  // }, [value, isExpanded])
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const submit = () => {
    if (isBusy) return
    onSubmit()
    textareaRef.current?.focus()
  }

  return (
    <form
      className="bg-default container mx-auto flex items-end gap-2 border-t border-zinc-200/60 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-zinc-700/60"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="relative min-w-0 flex-1">
        <textarea
          ref={textareaRef}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) {
              return
            }
            e.preventDefault()
            submit()
          }}
          placeholder={t('inputPlaceholder')}
          className={classNames(
            'w-full min-w-0 resize-none overflow-y-auto rounded-md px-3 py-2 text-sm',
            'border border-zinc-300 transition-[height] [interpolate-size:allow-keywords] dark:border-zinc-700 dark:bg-zinc-900',
            isExpanded ? 'h-[40dvh]' : 'h-auto max-h-60',
          )}
        />
        {canExpand && (
          <button
            type="button"
            aria-pressed={isExpanded}
            title={isExpanded ? t('collapseInput') : t('expandInput')}
            aria-label={isExpanded ? t('collapseInput') : t('expandInput')}
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-400"
          >
            {isExpanded ? (
              <IconChevronDown size="16" />
            ) : (
              <IconChevronUp size="16" />
            )}
          </button>
        )}
      </div>
      {value.length > maxLengthHint - 1000 && (
        <span className="text-muted-foreground self-center text-xs tabular-nums">
          {value.length}/{maxLengthHint}
        </span>
      )}
      {isBusy ? (
        <button type="button" className="button-secondary" onClick={onStop}>
          <IconPlayerStop size="18" /> {t('stop')}
        </button>
      ) : (
        <button type="submit" className="button" disabled={!value.trim()}>
          <IconSend size="18" /> {t('send')}
        </button>
      )}
    </form>
  )
}
