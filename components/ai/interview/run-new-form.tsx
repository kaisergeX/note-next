'use client'

import {useDisclosure} from '@kaiverse/k/hooks'
import {Dialog} from '@kaiverse/k/ui'
import {IconArrowLeft, IconLoader2} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useState, useTransition} from 'react'
import Button from '~/components/ui/button'
import {
  createRunAction,
  extractQuestionsAction,
} from '~/app/[locale]/ai/interview/actions'

export type RunPersonaOption = {
  id: string
  name: string
  region: string
  hasSystemPrompt: boolean
  age: number | null
}

type RunNewFormProps = {
  personas: RunPersonaOption[]
}

export default function RunNewForm({personas}: RunNewFormProps) {
  const t = useTranslations('ai.interview.run')
  const tChat = useTranslations('ai.interview.chat')
  const router = useRouter()
  const [script, setScript] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [formError, setFormError] = useState<'script' | 'personas' | null>(null)
  const [submitError, setSubmitError] = useState<'offline' | 'error' | null>(
    null,
  )
  const [detectError, setDetectError] = useState<
    'offline' | 'error' | 'validation' | null
  >(null)
  const [context, setContext] = useState('')
  const [noAccess, setNoAccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, {open: openConfirm, close: closeConfirm}] =
    useDisclosure()

  const togglePersona = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    )
  }

  /**
   * Detect questions: asks the LLM to pull every question out of the pasted
   * text VERBATIM and REPLACE the textarea content (one per line). The user
   * then reviews/edits before Create — Create itself stays LLM-free.
   */
  const handleDetect = () => {
    if (detecting || creating || isPending) return
    if (script.trim().length === 0) {
      setFormError('script')
      return
    }
    // Detect overwrites the textarea, which already holds content (the
    // extraction input comes from it — the empty case above never reaches a
    // replace): ask before clobbering questions the user may have edited.
    openConfirm()
  }

  const runDetect = () => {
    closeConfirm()
    setDetectError(null)
    setNoAccess(false)
    setDetecting(true)
    startTransition(async () => {
      try {
        const result = await extractQuestionsAction(script)
        if (result.ok) {
          setScript(result.data.questions.join('\n'))
          return
        }
        setDetectError(
          result.reason === 'offline'
            ? 'offline'
            : result.reason === 'validation'
              ? 'validation'
              : 'error',
        )
      } catch {
        setDetectError('error')
      } finally {
        setDetecting(false)
      }
    })
  }

  const handleSubmit = () => {
    // Re-entrancy guard: a pending transition must not submit twice.
    if (creating || isPending) return
    const questions = script
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (questions.length === 0) {
      setFormError('script')
      return
    }
    if (selectedIds.length === 0) {
      setFormError('personas')
      return
    }
    setFormError(null)
    setSubmitError(null)
    setNoAccess(false)
    setCreating(true)
    startTransition(async () => {
      try {
        const result = await createRunAction(script, selectedIds, context)
        if (result.ok) {
          router.push(`/ai/interview/runs/${result.data.runId}`)
          return
        }
        if (result.reason === 'offline') setSubmitError('offline')
        else if (result.reason === 'no-access') setNoAccess(true)
        else setSubmitError('error')
      } catch {
        setSubmitError('error')
      } finally {
        setCreating(false)
      }
    })
  }

  const busy = creating || isPending

  return (
    <section className="container mx-auto space-y-4 p-4 pb-16">
      <div>
        <Link
          href="/ai/interview/runs"
          className="focus-visible:outline-accent inline-flex min-h-11 items-center gap-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <IconArrowLeft size="18" /> {t('backToRuns')}
        </Link>
      </div>

      <h1 className="text-2xl font-bold">{t('new')}</h1>

      {noAccess && (
        <p className="text-destructive text-sm">{t('noAccessError')}</p>
      )}
      {submitError && (
        <p role="alert" className="text-destructive text-sm">
          {submitError === 'offline' ? t('offline') : t('createError')}
        </p>
      )}
      {formError && (
        <p role="alert" className="text-destructive text-sm">
          {formError === 'script' ? t('scriptRequired') : t('personaRequired')}
        </p>
      )}
      {detectError && (
        <p role="alert" className="text-destructive text-sm">
          {detectError === 'offline' ? t('offline') : t('extractFailed')}
        </p>
      )}

      <div>
        <label
          htmlFor="run-script"
          className="text-ink-muted mb-1 block text-xs font-medium"
        >
          {t('script')}
        </label>
        <textarea
          id="run-script"
          rows={8}
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder={t('scriptPlaceholder')}
          className="border-hairline bg-paper-raised text-ink placeholder:text-ink-muted focus:border-accent focus:ring-accent/25 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          disabled={busy}
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="secondary"
            className="min-h-11"
            onClick={handleDetect}
            disabled={busy}
          >
            {detecting && (
              <IconLoader2 className="animate-spin" size="1.2rem" />
            )}
            {detecting ? t('detecting') : t('detect')}
          </Button>
        </div>
        <p className="text-ink-muted mt-1 text-xs">{t('scriptHint')}</p>
      </div>

      <div>
        <label
          htmlFor="run-context"
          className="text-ink-muted mb-1 block text-xs font-medium"
        >
          {t('context')}
        </label>
        <textarea
          id="run-context"
          rows={3}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={t('contextPlaceholder')}
          maxLength={2000}
          className="border-hairline bg-paper-raised text-ink placeholder:text-ink-muted focus:border-accent focus:ring-accent/25 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          disabled={busy}
        />
        <p className="text-ink-muted mt-1 text-xs">{t('contextHint')}</p>
      </div>

      <fieldset>
        <legend className="text-ink-muted mb-1 text-xs font-medium">
          {t('personas')}
        </legend>
        <p className="text-ink-muted mb-2 text-xs">{t('personasHint')}</p>
        {personas.length === 0 ? (
          <p className="text-ink-muted text-sm">{t('empty')}</p>
        ) : (
          <ul className="space-y-1">
            {personas.map((persona) => (
              <li key={persona.id}>
                <label
                  className={`flex min-h-11 items-center gap-2 rounded-md px-2 py-2 text-sm ${
                    persona.hasSystemPrompt
                      ? 'hover:bg-ink-tint cursor-pointer'
                      : 'opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="focus-visible:outline-accent mt-1 focus-visible:outline-2 focus-visible:outline-offset-2"
                    checked={selectedIds.includes(persona.id)}
                    onChange={() => togglePersona(persona.id)}
                    disabled={!persona.hasSystemPrompt || busy}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{persona.name}</span>
                    <span className="text-ink-muted">
                      {' '}
                      {persona.age ? `· ${persona.age} ` : ''}· {persona.region}
                    </span>
                    {!persona.hasSystemPrompt && (
                      <span className="text-ink-muted block text-xs">
                        {t('personaNoPrompt')}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <div>
        <Button className="min-h-11" onClick={handleSubmit} disabled={busy}>
          {busy && <IconLoader2 className="animate-spin" size="1.2rem" />}
          {busy ? t('creating') : t('create')}
        </Button>
      </div>

      <Dialog
        className="border-hairline bg-paper-raised text-ink shadow-sheet mx-4 my-auto w-auto max-w-sm border"
        open={confirmOpen}
        onClose={closeConfirm}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Dialog.Header>
          <Dialog.Title className="text-base font-semibold">
            {t('detect')}
          </Dialog.Title>
        </Dialog.Header>
        <Dialog.Content className="text-ink-muted text-sm">
          {t('detectOverwrite')}
        </Dialog.Content>
        <Dialog.Footer className="justify-end gap-2">
          <Button
            variant="secondary"
            className="min-h-11"
            onClick={closeConfirm}
          >
            {tChat('cancel')}
          </Button>
          <Button
            className="min-h-11"
            disabled={detecting || isPending}
            onClick={runDetect}
          >
            {t('detect')}
          </Button>
        </Dialog.Footer>
      </Dialog>
    </section>
  )
}
