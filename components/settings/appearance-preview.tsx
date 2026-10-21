'use client'

import {
  IconBold,
  IconCheck,
  IconFileText,
  IconHighlight,
  IconItalic,
  IconRestore,
} from '@tabler/icons-react'
import {cn} from 'cn'
import {useTranslations} from 'next-intl'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {Badge} from '~/components/ui/badge'
import Button from '~/components/ui/button'
import {Input} from '~/components/ui/input'
import type {AppearanceId} from '~/lib/appearance'

const tabs = ['note', 'chat', 'controls'] as const
type PreviewTab = (typeof tabs)[number]

export default function AppearancePreview({
  appearance,
}: {
  appearance: AppearanceId
}) {
  const t = useTranslations('user.appearance')
  const id = useId()
  const [tab, setTab] = useState<PreviewTab>('note')
  const [resetCount, setResetCount] = useState(0)
  const tabRefs = useRef<Partial<Record<PreviewTab, HTMLButtonElement | null>>>(
    {},
  )

  function handleTabKey(
    event: KeyboardEvent<HTMLButtonElement>,
    current: PreviewTab,
  ) {
    const index = tabs.indexOf(current)
    const next =
      event.key === 'ArrowRight'
        ? tabs[(index + 1) % tabs.length]
        : event.key === 'ArrowLeft'
          ? tabs[(index + tabs.length - 1) % tabs.length]
          : event.key === 'Home'
            ? tabs[0]
            : event.key === 'End'
              ? tabs[tabs.length - 1]
              : null
    if (!next) return
    event.preventDefault()
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="min-w-0 flex-1">
      <h3 id={`${id}-title`} className="mb-3 text-sm font-semibold">
        {t('previewTitle')}
      </h3>
      <div
        data-appearance-preview={appearance}
        className="appearance-preview border-hairline bg-paper text-ink overflow-hidden rounded-xl border font-sans"
      >
        <div className="border-hairline flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
          <span className="text-accent font-serif text-lg font-semibold">
            etoN
          </span>
          <Button
            variant="ghost"
            onClick={() => setResetCount((count) => count + 1)}
            aria-label={t('interactive.resetAll')}
          >
            <IconRestore size={16} aria-hidden />
            {t('interactive.reset')}
          </Button>
        </div>
        <p
          id={`${id}-description`}
          className="text-ink-muted px-4 pt-4 text-sm leading-relaxed"
        >
          {t('previewDescription', {preset: t(`names.${appearance}`)})}
        </p>
        <div
          role="tablist"
          aria-labelledby={`${id}-title`}
          className="border-hairline mx-4 mt-4 flex gap-1 border-b pb-2"
        >
          {tabs.map((value) => (
            <Button
              key={value}
              variant="ghost"
              role="tab"
              id={`${id}-tab-${value}`}
              aria-selected={tab === value}
              aria-controls={`${id}-panel-${value}`}
              tabIndex={tab === value ? 0 : -1}
              ref={(element) => {
                tabRefs.current[value] = element
              }}
              onClick={() => setTab(value)}
              onKeyDown={(event) => handleTabKey(event, value)}
              className="text-ink-muted aria-selected:bg-ink-tint aria-selected:text-ink min-w-0 flex-1 px-2"
            >
              {t(`interactive.tabs.${value}`)}
            </Button>
          ))}
        </div>
        <div key={resetCount}>
          {tabs.map((value) => (
            <div
              key={value}
              role="tabpanel"
              id={`${id}-panel-${value}`}
              aria-labelledby={`${id}-tab-${value}`}
              aria-describedby={`${id}-description`}
              hidden={tab !== value}
              className="min-h-96 p-4 sm:p-5"
            >
              {value === 'note' ? (
                <NotePreview />
              ) : value === 'chat' ? (
                <ChatPreview />
              ) : (
                <ControlsPreview />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function NotePreview() {
  const t = useTranslations('user.appearance')
  const id = useId()
  const [title, setTitle] = useState<string | null>(null)
  const [body, setBody] = useState<string | null>(null)
  const [format, setFormat] = useState({
    bold: false,
    italic: false,
    highlight: false,
  })
  return (
    <div className="border-hairline bg-paper-raised overflow-hidden rounded-lg border">
      <div className="border-hairline flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <span className="text-ink-muted inline-flex items-center gap-2 text-xs font-medium">
          <IconFileText size={15} aria-hidden />
          {t('previewNote')}
        </span>
        <div
          role="group"
          aria-label={t('previewFormatting')}
          className="flex gap-1"
        >
          {(
            [
              {key: 'bold', Icon: IconBold, label: 'previewBold'},
              {key: 'italic', Icon: IconItalic, label: 'previewItalic'},
              {
                key: 'highlight',
                Icon: IconHighlight,
                label: 'previewHighlight',
              },
            ] as const
          ).map(({key, Icon, label}) => (
            <Button
              key={key}
              variant="ghost"
              aria-label={t(label)}
              aria-pressed={format[key]}
              onClick={() =>
                setFormat((current) => ({...current, [key]: !current[key]}))
              }
              className="aria-pressed:bg-ink-tint aria-pressed:text-accent size-10 rounded-sm p-0"
            >
              <Icon size={16} aria-hidden />
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <Input
          aria-label={t('interactive.noteTitle')}
          maxLength={100}
          value={title ?? t('previewHeading')}
          onChange={(event) => setTitle(event.target.value)}
          className="font-serif text-xl font-medium"
        />
        <textarea
          aria-label={t('interactive.noteBody')}
          aria-describedby={`${id}-format-hint`}
          value={body ?? t('previewBody')}
          maxLength={1500}
          rows={5}
          onChange={(event) => setBody(event.target.value)}
          className={cn(
            'border-control-border text-ink focus:border-accent focus:ring-accent min-h-32 w-full resize-y rounded-md border px-3 py-2 font-serif text-lg leading-relaxed focus:ring-2 focus:outline-none',
            format.bold ? 'font-semibold' : 'font-normal',
            format.italic && 'italic',
            format.highlight ? 'bg-accent/10' : 'bg-paper-raised',
          )}
        />
        <p
          id={`${id}-format-hint`}
          className="text-ink-muted text-xs leading-relaxed"
        >
          {t('interactive.formatHint')}
        </p>
      </div>
      <p className="border-hairline text-ink-muted flex items-center gap-2 border-t px-4 py-3 text-xs">
        <IconCheck className="text-success shrink-0" size={14} aria-hidden />
        {t('interactive.localNote')}
      </p>
    </div>
  )
}

type PreviewMessage = {id: number; role: 'user' | 'assistant'; text: string}

function ChatPreview() {
  const t = useTranslations('user.appearance')
  const [messages, setMessages] = useState<PreviewMessage[]>([])
  const [draft, setDraft] = useState('')
  const [replying, setReplying] = useState(false)
  const nextId = useRef(2)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const composer = useRef<HTMLInputElement>(null)
  const transcript = useRef<HTMLDivElement>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  useEffect(() => {
    const element = transcript.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages, replying])

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || replying) return
    const message: PreviewMessage = {id: nextId.current++, role: 'user', text}
    setMessages((current) => [...current, message].slice(-4))
    setDraft('')
    setReplying(true)
    composer.current?.focus()
    timer.current = setTimeout(() => {
      const reply: PreviewMessage = {
        id: nextId.current++,
        role: 'assistant',
        text: t('interactive.sampleReply'),
      }
      setMessages((current) => [...current, reply].slice(-4))
      setReplying(false)
      timer.current = null
    }, 1200)
  }

  const displayed: PreviewMessage[] = [
    {id: 0, role: 'user', text: t('previewPrompt')},
    {id: 1, role: 'assistant', text: t('previewReply')},
    ...messages,
  ]
  return (
    <div className="space-y-4">
      <div
        ref={transcript}
        role="log"
        aria-label={t('previewChat')}
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
        className="focus-visible:outline-accent flex max-h-64 flex-col items-start gap-3 overflow-y-auto rounded-md p-1 text-sm leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {displayed.map((message) => (
          <p
            key={message.id}
            className={cn(
              'max-w-4/5 rounded-xl px-4 py-3 break-words whitespace-pre-wrap',
              message.role === 'user'
                ? 'bg-ink text-paper self-end rounded-br-sm'
                : 'border-hairline bg-paper-raised rounded-bl-sm border',
            )}
          >
            <span className="sr-only">
              {t(
                message.role === 'user'
                  ? 'interactive.you'
                  : 'interactive.sampleAssistant',
              )}
              :{' '}
            </span>
            {message.text}
          </p>
        ))}
      </div>
      <p role="status" className="text-ink-muted min-h-5 text-xs">
        {replying ? t('interactive.typing') : t('interactive.chatHint')}
      </p>
      <form onSubmit={send} className="flex items-center gap-2">
        <Input
          ref={composer}
          aria-label={t('previewMessage')}
          placeholder={t('previewMessage')}
          maxLength={300}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="min-w-0 flex-1"
        />
        {replying ? (
          <Button
            variant="secondary"
            onClick={() => {
              if (timer.current) clearTimeout(timer.current)
              timer.current = null
              setReplying(false)
            }}
          >
            {t('interactive.stop')}
          </Button>
        ) : (
          <Button type="submit" disabled={!draft.trim()}>
            {t('previewSend')}
          </Button>
        )}
      </form>
    </div>
  )
}

function ControlsPreview() {
  const t = useTranslations('user.appearance.interactive')
  const id = useId()
  const [name, setName] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaved(false)
    if (!name.trim()) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setSaving(true)
    timer.current = setTimeout(() => {
      setSaving(false)
      setSaved(true)
      timer.current = null
    }, 1200)
  }

  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t('statuses')}
      >
        <Badge status="draft" dot>
          {t('draft')}
        </Badge>
        <Badge status="active" dot>
          {t('active')}
        </Badge>
        <Badge status="archived" dot>
          {t('archived')}
        </Badge>
      </div>
      <form noValidate onSubmit={save} className="space-y-3">
        <label htmlFor={`${id}-name`} className="text-ink-muted block text-xs">
          {t('fieldLabel')}
        </label>
        <Input
          id={`${id}-name`}
          value={name}
          maxLength={80}
          invalid={invalid}
          readOnly={saving}
          aria-describedby={`${id}-${invalid ? 'error' : 'hint'}`}
          onChange={(event) => {
            setName(event.target.value)
            setInvalid(false)
            setSaved(false)
          }}
        />
        {invalid ? (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-destructive text-sm"
          >
            {t('fieldError')}
          </p>
        ) : (
          <p
            id={`${id}-hint`}
            className="text-ink-muted text-xs leading-relaxed"
          >
            {t('fieldHint')}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={saving}>
            {saving ? t('saving') : t('trySave')}
          </Button>
          <Button variant="secondary" disabled>
            {t('disabled')}
          </Button>
        </div>
        <p role="status" className="text-success min-h-5 text-sm">
          {saved ? t('saved') : ''}
        </p>
      </form>
      <div>
        <label
          htmlFor={`${id}-disabled`}
          className="text-ink-muted mb-2 block text-xs"
        >
          {t('disabledField')}
        </label>
        <Input
          id={`${id}-disabled`}
          disabled
          value={t('disabledValue')}
          className="cursor-not-allowed opacity-45"
        />
      </div>
    </div>
  )
}
