'use client'

import {
  IconArrowLeft,
  IconLoader2,
  IconMessages,
  IconSparkles2,
  IconSubtitlesAi,
} from '@tabler/icons-react'
import {useForm} from '@tanstack/react-form'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState, useTransition} from 'react'
import {
  createPersonaAction,
  generatePersonaAction,
  listPersonaTagsAction,
  updatePersonaAction,
} from '~/app/[locale]/ai/interview/actions'
import {AI_DEFAULT_LOCALE} from '~/config/ai'
import type {PersonaStatus} from '~/db/schema/personas'
import {type FieldError} from '~/lib/ai/action-result'
import type {PersonaDraft} from '~/lib/ai/persona-drafting'
import PersonaBioPanel from './persona-bio-panel'
import PersonaCombobox, {type PersonaComboboxOption} from './persona-combobox'
import PersonaSlider from './persona-slider'
import PersonaTags from './persona-tags'

export type PersonaFormInitial = {
  id: string
  name: string
  // Nullable in the DB since the Phase-3 UX follow-up, so these may be
  // absent on existing rows; the form applies its own defaults.
  gender?: string
  age?: number
  region: string
  incomeBracket?: string
  occupation?: string
  backgroundTags: string[]
  personalitySliders: {
    calm_anxious: number
    optimistic_cynical: number
    frugal_spendthrift: number
  }
  interviewStance?: string
  quirksFreetext?: string
  generatedBio?: string | null
  systemPrompt?: string | null
  status: PersonaStatus
}

type PersonaFormProps = {
  mode: 'create' | 'edit'
  initial?: PersonaFormInitial
}

const SLIDER_AXES = [
  {key: 'calm_anxious', start: 'sliderCalm', end: 'sliderAnxious'},
  {key: 'optimistic_cynical', start: 'sliderOptimistic', end: 'sliderCynical'},
  {key: 'frugal_spendthrift', start: 'sliderFrugal', end: 'sliderSpendthrift'},
] as const

const INCOME_VALUES = ['low', 'medium', 'high'] as const
const STANCE_VALUES = [
  'cooperative',
  'guarded',
  'talkative',
  'suspicious',
] as const

// LIGHT client validation only — the server actions are the real gate.
const requiredValidator = {
  onChange: ({value}: {value: string}) =>
    value.trim() ? undefined : {key: 'required'},
}

export default function PersonaForm({mode, initial}: PersonaFormProps) {
  const t = useTranslations('ai.interview.form')
  const tErrors = useTranslations('ai.interview.form.errors') as (
    key: string,
    values?: Record<string, string | number>,
  ) => string
  const tRoot = useTranslations('ai.interview')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [noAccess, setNoAccess] = useState(false)
  const [globalError, setGlobalError] = useState<string | undefined>()
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  // Seed is generation-time input only, not a saved field.
  const [seed, setSeed] = useState('')
  const [seedErrors, setSeedErrors] = useState<FieldError[] | undefined>()
  const [generating, setGenerating] = useState(false)
  const [generateOffline, setGenerateOffline] = useState(false)
  const [generateError, setGenerateError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(mode === 'edit')

  const form = useForm({
    defaultValues: {
      name: initial?.name ?? '',
      age: initial?.age?.toString() ?? '',
      gender: initial?.gender ?? '',
      region: initial?.region ?? '',
      incomeBracket: initial?.incomeBracket ?? '',
      occupation: initial?.occupation ?? '',
      backgroundTags: [...(initial?.backgroundTags ?? [])],
      sliders: {
        calm_anxious: initial?.personalitySliders.calm_anxious ?? 50,
        optimistic_cynical:
          initial?.personalitySliders.optimistic_cynical ?? 50,
        frugal_spendthrift:
          initial?.personalitySliders.frugal_spendthrift ?? 50,
      },
      interviewStance: initial?.interviewStance ?? '',
      quirksFreetext: initial?.quirksFreetext ?? '',
      bio: initial?.generatedBio ?? '',
      systemPrompt: initial?.systemPrompt ?? '',
    },
  })

  useEffect(() => {
    let cancelled = false
    async function loadTags() {
      const result = await listPersonaTagsAction()
      if (!cancelled && result.ok) setTagSuggestions(result.data)
    }
    void loadTags()
    return () => {
      cancelled = true
    }
  }, [])

  const genderOptions = [
    {value: '', label: t('genderUnspecified')},
    {value: 'male', label: t('options.gender.male')},
    {value: 'female', label: t('options.gender.female')},
  ]
  const incomeOptions: PersonaComboboxOption[] = INCOME_VALUES.map((value) => ({
    value,
    label: t(`options.income.${value}`),
  }))
  const stanceOptions: PersonaComboboxOption[] = STANCE_VALUES.map((value) => ({
    value,
    label: t(`options.stance.${value}`),
  }))
  const labelFromOptions =
    (options: PersonaComboboxOption[]) => (value: string) =>
      options.find((option) => option.value === value)?.label ?? value

  const inputClass =
    'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'

  const renderErrors = (errors: readonly unknown[]) => {
    const first = errors[0] as FieldError | undefined
    if (!first) return null
    return (
      <p className="text-danger mt-1 text-xs">
        {tErrors(first.key, first.params ?? undefined)}
      </p>
    )
  }

  /**
   * Documented one-shot server-error mapping: form.setErrorMap({onSubmit:
   * {fields}}) distributes each dotted-path key onto the matching registered
   * field's errorMap, and clears stale onSubmit errors on all other fields
   * in the same pass.
   */
  const setServerFieldErrors = (fieldErrors?: Record<string, FieldError[]>) => {
    form.setErrorMap({
      onSubmit: {fields: fieldErrors ?? {}},
    } as Parameters<typeof form.setErrorMap>[0])
  }

  const buildPayload = () => {
    const values = form.state.values
    return {
      name: values.name,
      gender: values.gender || undefined,
      age: values.age || undefined,
      locale: AI_DEFAULT_LOCALE,
      region: values.region,
      incomeBracket: values.incomeBracket || undefined,
      occupation: values.occupation || undefined,
      backgroundTags: values.backgroundTags,
      personalitySliders: values.sliders,
      interviewStance: values.interviewStance || undefined,
      quirksFreetext: values.quirksFreetext || undefined,
      seedDescription: seed.trim() || undefined,
      generatedBio: values.bio || undefined,
      systemPrompt: values.systemPrompt || undefined,
      status: mode === 'create' ? ('active' as const) : initial!.status,
    }
  }

  // Generation write-back: bio/systemPrompt always; structured fields only
  // when the draft provides them (they are authoritative when present).
  const applyDraft = (draft: PersonaDraft) => {
    form.setFieldValue('bio', draft.bio)
    form.setFieldValue('systemPrompt', draft.systemPrompt)
    if (draft.name) form.setFieldValue('name', draft.name)
    if (draft.age !== undefined) form.setFieldValue('age', String(draft.age))
    if (draft.gender) form.setFieldValue('gender', draft.gender)
    if (draft.region) form.setFieldValue('region', draft.region)
    if (draft.incomeBracket) {
      form.setFieldValue('incomeBracket', draft.incomeBracket)
    }
    if (draft.occupation) form.setFieldValue('occupation', draft.occupation)
    if (draft.interviewStance) {
      form.setFieldValue('interviewStance', draft.interviewStance)
    }
    if (draft.quirksFreetext) {
      form.setFieldValue('quirksFreetext', draft.quirksFreetext)
    }
    if (draft.backgroundTags?.length) {
      form.setFieldValue('backgroundTags', draft.backgroundTags)
    }
    if (draft.personalitySliders) {
      form.setFieldValue('sliders', draft.personalitySliders)
    }
  }

  const handleGenerate = () => {
    setGenerateOffline(false)
    setGenerateError(false)
    setSeedErrors(undefined)
    setServerFieldErrors()
    setGenerating(true)
    startTransition(async () => {
      const result = await generatePersonaAction(buildPayload())
      setGenerating(false)
      if (result.ok) {
        applyDraft(result.data)
        setDetailsOpen(true)
        return
      }
      if (result.reason === 'offline') setGenerateOffline(true)
      else if (result.reason === 'validation') {
        if (result.fieldErrors?.seedDescription) {
          setSeedErrors(result.fieldErrors.seedDescription)
        }
        setServerFieldErrors(result.fieldErrors)
      } else setGenerateError(true)
      if (result.reason === 'no-access') setNoAccess(true)
    })
  }

  const handleSave = () => {
    // Re-entrancy guard: Enter inside a text input also fires the form's
    // onSubmit → handleSave; a second run during a pending transition would
    // create/update the persona twice.
    if (saving || isPending) return
    const values = form.state.values
    const clientErrors: Record<string, FieldError[]> = {}
    if (!values.name.trim()) clientErrors.name = [{key: 'required'}]
    if (!values.region.trim()) clientErrors.region = [{key: 'required'}]
    setGlobalError(undefined)
    if (Object.keys(clientErrors).length > 0) {
      setServerFieldErrors(clientErrors)
      return
    }
    setServerFieldErrors()
    setSaving(true)
    startTransition(async () => {
      try {
        const payload = buildPayload()
        const result =
          mode === 'create'
            ? await createPersonaAction(payload)
            : await updatePersonaAction(initial!.id, payload)
        if (result.ok) {
          form.reset()
          router.push('/ai/interview')
          return
        }
        if (result.reason === 'validation') {
          setServerFieldErrors(result.fieldErrors)
        } else if (result.reason === 'no-access') {
          setNoAccess(true)
        } else {
          setGlobalError(t('saveError'))
        }
      } catch {
        // A thrown action (e.g. unexpected DB error) is not an ActionResult;
        // surface it and unstick the save button.
        setGlobalError(t('saveError'))
      } finally {
        setSaving(false)
      }
    })
  }

  return (
    <>
      <form
        className="container mx-auto space-y-4 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
      >
        <div className="flex-center-between gap-2">
          <Link href="/ai/interview" className="inline-flex items-center gap-1">
            <IconArrowLeft className="inline-block" size="18" />{' '}
            {tRoot('chat.backToRoster')}
          </Link>
          {mode === 'edit' &&
            initial!.systemPrompt &&
            initial!.status !== 'draft' && (
              <Link
                href={`/ai/interview/${initial!.id}/chat`}
                className="inline-flex items-center gap-1"
              >
                <IconMessages className="inline-block" size="18" />{' '}
                {tRoot('chat.openChat')}
              </Link>
            )}
        </div>
        <h2 className="text-xl font-bold">
          {mode === 'create' ? t('newTitle') : t('editTitle')}
        </h2>

        {noAccess && (
          <p className="text-danger text-sm">{t('noAccessError')}</p>
        )}
        {globalError && (
          <p role="alert" className="text-danger text-sm">
            {globalError}
          </p>
        )}

        {mode === 'create' && (
          <section className="space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
            <label htmlFor="persona-seed" className="block text-sm font-medium">
              {t('seed')}
            </label>
            <textarea
              id="persona-seed"
              rows={5}
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className={inputClass}
              maxLength={10000}
              disabled={generating || saving}
            />
            <p className="text-muted-foreground text-xs">{t('seedHint')}</p>
            {seedErrors && seedErrors.length > 0 && (
              <p role="alert" className="text-danger text-xs">
                {tErrors(seedErrors[0].key, seedErrors[0].params ?? undefined)}
              </p>
            )}
            <button
              type="button"
              className="button-secondary mt-2"
              onClick={handleGenerate}
              disabled={generating || saving}
            >
              {generating ? (
                <IconLoader2 className="animate-spin" size="1.2rem" />
              ) : (
                <IconSparkles2 size="1.2rem" />
              )}
              {generating ? t('generating') : t('generate')}
            </button>
            {(generateOffline || generateError) && (
              <p role="alert" className="text-danger text-sm">
                {generateOffline ? t('bioOfflineError') : t('bioError')}
              </p>
            )}
          </section>
        )}

        <details
          open={detailsOpen}
          onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer text-sm font-medium">
            {t('fineTune')}
          </summary>

          <div className="mt-4 space-y-4">
            <form.Field name="name" validators={requiredValidator}>
              {(field) => (
                <div>
                  <label
                    htmlFor="persona-name"
                    className="mb-1 block text-sm font-medium"
                  >
                    {t('name')}
                  </label>
                  <input
                    id="persona-name"
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className={inputClass}
                  />
                  {renderErrors(field.state.meta.errors)}
                </div>
              )}
            </form.Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="age">
                {(field) => (
                  <div>
                    <label
                      htmlFor="persona-age"
                      className="mb-1 block text-sm font-medium"
                    >
                      {t('age')}
                    </label>
                    <input
                      id="persona-age"
                      type="number"
                      min={1}
                      max={120}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className={inputClass}
                    />
                    {renderErrors(field.state.meta.errors)}
                  </div>
                )}
              </form.Field>
              <form.Field name="gender">
                {(field) => (
                  <div>
                    <PersonaCombobox
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={genderOptions}
                      labelFor={labelFromOptions(genderOptions)}
                      label={t('gender')}
                    />
                    {renderErrors(field.state.meta.errors)}
                  </div>
                )}
              </form.Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="region" validators={requiredValidator}>
                {(field) => (
                  <div>
                    <label
                      htmlFor="persona-region"
                      className="mb-1 block text-sm font-medium"
                    >
                      {t('region')}
                    </label>
                    <input
                      id="persona-region"
                      type="text"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className={inputClass}
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t('regionHint')}
                    </p>
                    {renderErrors(field.state.meta.errors)}
                  </div>
                )}
              </form.Field>
              <form.Field name="incomeBracket">
                {(field) => (
                  <div>
                    <PersonaCombobox
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={incomeOptions}
                      labelFor={labelFromOptions(incomeOptions)}
                      label={t('income')}
                    />
                    {renderErrors(field.state.meta.errors)}
                  </div>
                )}
              </form.Field>
            </div>

            <form.Field name="occupation">
              {(field) => (
                <div>
                  <label
                    htmlFor="persona-occupation"
                    className="mb-1 block text-sm font-medium"
                  >
                    {t('occupation')}
                  </label>
                  <input
                    id="persona-occupation"
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className={inputClass}
                  />
                  {renderErrors(field.state.meta.errors)}
                </div>
              )}
            </form.Field>

            <form.Field name="backgroundTags">
              {(field) => (
                <PersonaTags
                  value={field.state.value}
                  onChange={field.handleChange}
                  suggestions={tagSuggestions}
                  label={t('tags')}
                  hint={t('tagsHint')}
                  addPlaceholder={t('tagsAddPlaceholder')}
                  disabled={isPending}
                />
              )}
            </form.Field>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">
                {t('sliders')}
              </legend>
              <div className="grid gap-4 sm:grid-cols-3 sm:gap-8">
                {SLIDER_AXES.map((axis) => (
                  <form.Field key={axis.key} name={`sliders.${axis.key}`}>
                    {(field) => (
                      <PersonaSlider
                        axisKey={axis.key}
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                        poleStartLabel={t(axis.start)}
                        poleEndLabel={t(axis.end)}
                        ariaLabel={`${t(axis.start)} – ${t(axis.end)}`}
                        disabled={isPending}
                      />
                    )}
                  </form.Field>
                ))}
              </div>
            </fieldset>

            <form.Field name="interviewStance">
              {(field) => (
                <div>
                  <PersonaCombobox
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={stanceOptions}
                    labelFor={labelFromOptions(stanceOptions)}
                    label={t('stance')}
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t('stanceHint')}
                  </p>
                  {renderErrors(field.state.meta.errors)}
                </div>
              )}
            </form.Field>

            <form.Field name="quirksFreetext">
              {(field) => (
                <div>
                  <label
                    htmlFor="persona-quirks"
                    className="mb-1 block text-sm font-medium"
                  >
                    {t('quirks')}
                  </label>
                  <textarea
                    id="persona-quirks"
                    rows={3}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className={inputClass}
                  />
                  {renderErrors(field.state.meta.errors)}
                </div>
              )}
            </form.Field>

            <form.Field name="bio">
              {(bioField) => (
                <form.Field name="systemPrompt">
                  {(promptField) => (
                    <PersonaBioPanel
                      bio={bioField.state.value}
                      onBioChange={bioField.handleChange}
                      systemPrompt={promptField.state.value}
                      onSystemPromptChange={promptField.handleChange}
                      onRegenerate={handleGenerate}
                      regenerating={generating}
                      offline={generateOffline}
                      error={generateError}
                      labels={{
                        bio: t('bio'),
                        systemPrompt: t('systemPrompt'),
                        advanced: t('advanced'),
                        regenerate: t('regenerate'),
                        drafting: t('drafting'),
                        offlineError: t('bioOfflineError'),
                        error: t('bioError'),
                      }}
                    />
                  )}
                </form.Field>
              )}
            </form.Field>
          </div>
        </details>
      </form>
      <div className="flex-center-between bg-default sticky inset-x-0 bottom-0 z-10 w-full gap-4 transition-all max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="container mx-auto border-t border-gray-200 p-4">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <button
                type="button"
                className="button"
                onClick={handleSave}
                disabled={generating || saving || isSubmitting}
              >
                <IconSubtitlesAi />{' '}
                {saving || isSubmitting ? t('starting') : t('start')}
              </button>
            )}
          </form.Subscribe>
        </div>
      </div>
    </>
  )
}
