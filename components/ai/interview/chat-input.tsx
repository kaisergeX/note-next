'use client'

import {IconPlayerStop, IconSend} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {useEffect, useRef} from 'react'
import {cn} from 'cn'
import Button from '~/components/ui/button'

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
      className="bg-paper border-hairline container mx-auto flex flex-col gap-2 border-t pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pt-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div
        className={cn(
          'bg-paper-raised border-control-border focus-within:border-accent focus-within:ring-accent focus-within:shadow-sheet relative flex min-w-0 items-end gap-2 rounded-4xl border p-2 transition-[border-color,box-shadow] focus-within:ring-2',
          isBusy && 'animate-composer-thinking',
        )}
      >
        {isBusy && (
          <span aria-hidden="true" className="composer-orbit-clip">
            <span className="composer-orbit-streak" />
          </span>
        )}
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
          aria-label={t('inputPlaceholder')}
          className="text-ink placeholder:text-ink-muted field-sizing-content h-auto max-h-80 min-h-10 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2 text-sm transition-[height] outline-none [interpolate-size:allow-keywords]"
        />
        {isBusy ? (
          <Button
            type="button"
            variant="secondary"
            iconOnly
            aria-label={t('stop')}
            onClick={onStop}
          >
            <IconPlayerStop size="18" />
          </Button>
        ) : (
          <Button
            type="submit"
            variant="primary"
            iconOnly
            aria-label={t('send')}
            disabled={!value.trim()}
          >
            <IconSend size="18" />
          </Button>
        )}
      </div>
      <div className="text-ink-muted flex min-h-5 items-center justify-between gap-3 px-1 text-xs">
        <span>{t('keyboardHint')}</span>
        {value.length > maxLengthHint - 1000 && (
          <span className="shrink-0 tabular-nums">
            {value.length}/{maxLengthHint}
          </span>
        )}
      </div>
    </form>
  )
}
