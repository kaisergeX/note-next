'use client'

import {classNames} from '@kaiverse/k/utils'
import {IconPlayerStop, IconSend} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {useEffect, useRef} from 'react'

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
      <div className="relative min-w-0 flex-1 rounded-lg border border-zinc-300 py-2 focus-within:outline dark:border-zinc-700">
        <textarea
          ref={textareaRef}
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
            'w-full min-w-0 px-3 text-sm outline-none',
            'field-sizing-content h-auto max-h-80 min-h-10 resize-none overflow-y-auto transition-[height] [interpolate-size:allow-keywords]',
            'dark:bg-zinc-900',
          )}
        />
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
