'use client'

import {IconPlayerStop, IconSend} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {useEffect, useRef} from 'react'
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
      className="bg-paper border-hairline container mx-auto flex items-end gap-2 border-t pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="bg-paper-raised border-hairline focus-within:border-accent focus-within:ring-accent/25 relative min-w-0 flex-1 rounded-md border py-2 transition-colors focus-within:ring-2">
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
          className="text-ink placeholder:text-ink-muted field-sizing-content h-auto max-h-80 min-h-11 w-full min-w-0 resize-none overflow-y-auto bg-transparent px-3 text-sm transition-[height] outline-none [interpolate-size:allow-keywords]"
        />
      </div>
      {value.length > maxLengthHint - 1000 && (
        <span className="text-ink-muted self-center text-xs tabular-nums">
          {value.length}/{maxLengthHint}
        </span>
      )}
      {isBusy ? (
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="min-h-11"
          onClick={onStop}
        >
          <IconPlayerStop size="18" /> {t('stop')}
        </Button>
      ) : (
        <Button
          type="submit"
          variant="primary"
          size="md"
          className="min-h-11"
          disabled={!value.trim()}
        >
          <IconSend size="18" /> {t('send')}
        </Button>
      )}
    </form>
  )
}
