'use client'

import {useId, useRef, useSyncExternalStore} from 'react'
import {useTranslations} from 'next-intl'
import Button from '~/components/ui/button'
import {Input} from '~/components/ui/input'
import LoadingIndicator from '~/components/ui/loading-indicator'
import {NOTE_SEARCH_QUERY_LIMIT, normalizeSearchText} from '~/lib/notes/search'
import type {NoteSearchErrorCode} from '~/lib/notes/search-client'

const subscribeToHydration = () => () => {}

export default function NoteSearchControls({
  value,
  onChange,
  onCompositionChange,
  pending,
  count,
  complete,
  error,
  onRetry,
}: {
  value: string
  onChange: (value: string) => void
  onCompositionChange: (composing: boolean) => void
  pending: boolean
  count: number
  complete: boolean
  error: NoteSearchErrorCode | null
  onRetry: () => void
}) {
  const t = useTranslations('note.search')
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const ready = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  )
  const active = Boolean(normalizeSearchText(value))
  const clear = () => {
    onChange('')
    input.current?.focus()
  }
  return (
    <form
      role="search"
      aria-label={t('label')}
      className="mb-4 space-y-2"
      onSubmit={(event) => event.preventDefault()}
    >
      <label htmlFor={id} className="text-ink block text-sm font-medium">
        {t('label')}
      </label>
      <div className="flex items-center gap-2">
        <Input
          ref={input}
          id={id}
          type="search"
          disabled={!ready}
          className="min-w-0 flex-1"
          value={value}
          maxLength={NOTE_SEARCH_QUERY_LIMIT}
          placeholder={t('placeholder')}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${id}-help`}
          onChange={(event) => onChange(event.currentTarget.value)}
          onCompositionStart={() => onCompositionChange(true)}
          onCompositionEnd={() => onCompositionChange(false)}
          onKeyDown={(event) => {
            if (
              event.key === 'Escape' &&
              !event.nativeEvent.isComposing &&
              value
            ) {
              event.preventDefault()
              clear()
            }
          }}
        />
        {value && (
          <Button variant="ghost" onClick={clear}>
            {t('clear')}
          </Button>
        )}
      </div>
      <p id={`${id}-help`} className="text-ink-muted text-xs">
        {t('scope')}
      </p>
      {active &&
        (error ? (
          <div className="flex flex-wrap items-center gap-2">
            <p role="alert" className="text-destructive text-sm">
              {t(
                error === 'not_ready'
                  ? 'notReady'
                  : error === 'account_changed'
                    ? 'accountChanged'
                    : 'failed',
              )}
            </p>
            <Button variant="secondary" onClick={onRetry}>
              {t(error === 'account_changed' ? 'refresh' : 'retry')}
            </Button>
          </div>
        ) : pending ? (
          <LoadingIndicator label={t('searching')} />
        ) : (
          <p
            role="status"
            aria-atomic="true"
            className="text-ink-muted text-sm"
          >
            {complete && count === 0
              ? t('noResults')
              : t(complete ? 'count' : 'loadedCount', {count})}
          </p>
        ))}
    </form>
  )
}
