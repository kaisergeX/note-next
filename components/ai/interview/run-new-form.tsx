'use client'

import {IconArrowLeft, IconLoader2} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useState, useTransition} from 'react'
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
    if (!window.confirm(t('detectOverwrite'))) return
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

  const inputClass =
    'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
  const busy = creating || isPending

  return (
    <section className="container mx-auto space-y-4 p-4 pb-16">
      <div>
        <Link
          href="/ai/interview/runs"
          className="inline-flex items-center gap-1 text-sm"
        >
          <IconArrowLeft size="18" /> {t('backToRuns')}
        </Link>
      </div>

      <h1 className="text-2xl font-bold">{t('new')}</h1>

      {noAccess && <p className="text-danger text-sm">{t('noAccessError')}</p>}
      {submitError && (
        <p role="alert" className="text-danger text-sm">
          {submitError === 'offline' ? t('offline') : t('createError')}
        </p>
      )}
      {formError && (
        <p role="alert" className="text-danger text-sm">
          {formError === 'script' ? t('scriptRequired') : t('personaRequired')}
        </p>
      )}
      {detectError && (
        <p role="alert" className="text-danger text-sm">
          {detectError === 'offline' ? t('offline') : t('extractFailed')}
        </p>
      )}

      <div>
        <label htmlFor="run-script" className="mb-1 block text-sm font-medium">
          {t('script')}
        </label>
        <textarea
          id="run-script"
          rows={8}
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder={t('scriptPlaceholder')}
          className={inputClass}
          disabled={busy}
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            className="button-secondary text-sm"
            onClick={handleDetect}
            disabled={busy}
          >
            {detecting && (
              <IconLoader2 className="animate-spin" size="1.2rem" />
            )}
            {detecting ? t('detecting') : t('detect')}
          </button>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">{t('scriptHint')}</p>
      </div>

      <div>
        <label htmlFor="run-context" className="mb-1 block text-sm font-medium">
          {t('context')}
        </label>
        <textarea
          id="run-context"
          rows={3}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={t('contextPlaceholder')}
          maxLength={2000}
          className={inputClass}
          disabled={busy}
        />
        <p className="text-muted-foreground mt-1 text-xs">{t('contextHint')}</p>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">{t('personas')}</legend>
        <p className="text-muted-foreground mb-2 text-xs">
          {t('personasHint')}
        </p>
        {personas.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('empty')}</p>
        ) : (
          <ul className="space-y-1">
            {personas.map((persona) => (
              <li key={persona.id}>
                <label
                  className={`flex items-start gap-2 rounded-md px-2 py-2 text-sm ${
                    persona.hasSystemPrompt
                      ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      : 'opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedIds.includes(persona.id)}
                    onChange={() => togglePersona(persona.id)}
                    disabled={!persona.hasSystemPrompt || busy}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{persona.name}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      {persona.age ? `· ${persona.age} ` : ''}· {persona.region}
                    </span>
                    {!persona.hasSystemPrompt && (
                      <span className="text-muted-foreground block text-xs">
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
        <button
          type="button"
          className="button text-sm"
          onClick={handleSubmit}
          disabled={busy}
        >
          {busy && <IconLoader2 className="animate-spin" size="1.2rem" />}
          {busy ? t('creating') : t('create')}
        </button>
      </div>
    </section>
  )
}
