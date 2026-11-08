'use client'

import {useEffect, useId, useRef, useState, useSyncExternalStore} from 'react'
import {useTranslations} from 'next-intl'
import {IconSearch, IconX} from '@tabler/icons-react'
import Button from '~/components/ui/button'
import {Input} from '~/components/ui/input'
import {LoadingSpark} from '~/components/ui/loading-indicator'
import {NOTE_SEARCH_QUERY_LIMIT, normalizeSearchText} from '~/lib/notes/search'

const subscribeToHydration = () => () => {}

export default function NoteSearchControls({
  value,
  onChange,
  onCompositionChange,
  pending,
  fetching,
}: {
  value: string
  onChange: (value: string) => void
  onCompositionChange: (composing: boolean) => void
  pending: boolean
  fetching: boolean
}) {
  const t = useTranslations('note.search')
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(Boolean(value))
  const restoreTriggerFocus = useRef(false)
  const ready = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  )
  const active = Boolean(normalizeSearchText(value))
  const busy = active && pending
  const [loadingVisible, setLoadingVisible] = useState(false)
  const loadingStartedAt = useRef(0)
  useEffect(() => {
    if (active && loadingVisible && busy) return
    if (active && !loadingVisible && !fetching) return
    const delay = !active
      ? 0
      : loadingVisible
        ? Math.max(0, 300 - (Date.now() - loadingStartedAt.current))
        : 150
    const timer = setTimeout(() => {
      if (!loadingVisible) loadingStartedAt.current = Date.now()
      setLoadingVisible(active && !loadingVisible)
    }, delay)
    return () => clearTimeout(timer)
  }, [active, busy, fetching, loadingVisible])
  const open = expanded || Boolean(value)
  const clear = () => {
    onChange('')
    input.current?.focus()
  }
  const close = () => {
    setExpanded(false)
    restoreTriggerFocus.current = true
  }
  useEffect(() => {
    if (expanded) input.current?.focus()
    else if (restoreTriggerFocus.current) {
      trigger.current?.focus()
      restoreTriggerFocus.current = false
    }
  }, [expanded])
  return (
    <div className="note-search" data-expanded={open}>
      <Button
        ref={trigger}
        variant="ghost"
        iconOnly
        disabled={!ready}
        aria-label={t('label')}
        title={t('label')}
        className="note-search-trigger"
        pressMotion={false}
        inert={open}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setExpanded(true)}
      >
        <IconSearch size={18} aria-hidden />
      </Button>
      <form
        id={`${id}-panel`}
        role="search"
        aria-label={t('label')}
        inert={!open}
        className="note-search-panel min-w-0"
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor={id} className="sr-only">
          {t('label')}
        </label>
        <div className="relative">
          <span
            aria-hidden="true"
            className="text-ink-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          >
            {active && loadingVisible ? (
              <LoadingSpark />
            ) : (
              <IconSearch size={18} />
            )}
          </span>
          <Input
            ref={input}
            id={id}
            type="search"
            disabled={!ready}
            className="pr-12 pl-10 [&::-webkit-search-cancel-button]:appearance-none"
            value={value}
            maxLength={NOTE_SEARCH_QUERY_LIMIT}
            placeholder={t('placeholder')}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${id}-help`}
            aria-busy={busy}
            onChange={(event) => onChange(event.currentTarget.value)}
            onCompositionStart={() => onCompositionChange(true)}
            onCompositionEnd={() => onCompositionChange(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
                event.preventDefault()
                if (value) clear()
                else close()
              }
            }}
          />
          <Button
            variant="ghost"
            iconOnly
            aria-label={t(value ? 'clear' : 'close')}
            title={t(value ? 'clear' : 'close')}
            className="absolute top-1/2 right-1 -translate-y-1/2"
            pressMotion={false}
            onClick={value ? clear : close}
          >
            <IconX size={18} aria-hidden />
          </Button>
        </div>
        <p id={`${id}-help`} className="sr-only">
          {t('scope')}
        </p>
        <span role="status" className="sr-only">
          {active && loadingVisible ? t('searching') : ''}
        </span>
      </form>
    </div>
  )
}
