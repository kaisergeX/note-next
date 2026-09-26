'use client'

import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {useEffect, useState, useTransition} from 'react'
import {
  createPersonaAction,
  draftPersonaBioAction,
  listPersonaTagsAction,
  updatePersonaAction,
} from '~/app/[locale]/ai/interview/actions'
import {AI_DEFAULT_LOCALE, AI_LOCALES} from '~/config/ai'
import type {PersonaStatus} from '~/db/schema/personas'
import PersonaBioPanel from './persona-bio-panel'
import PersonaSlider from './persona-slider'
import PersonaTags from './persona-tags'

export type PersonaFormInitial = {
  id: string
  name: string
  gender: string
  age: number
  region: string
  incomeBracket: string
  occupation: string
  backgroundTags: string[]
  personalitySliders: {
    calm_anxious: number
    optimistic_cynical: number
    frugal_spendthrift: number
  }
  interviewStance: string
  quirksFreetext: string
  generatedBio?: string | null
  systemPrompt?: string | null
  status: PersonaStatus
}

type PersonaFormProps = {
  mode: 'create' | 'edit'
  initial?: PersonaFormInitial
}

type FieldErrors = Record<string, string[]>

const SLIDER_AXES = [
  {key: 'calm_anxious', start: 'sliderCalm', end: 'sliderAnxious'},
  {key: 'optimistic_cynical', start: 'sliderOptimistic', end: 'sliderCynical'},
  {key: 'frugal_spendthrift', start: 'sliderFrugal', end: 'sliderSpendthrift'},
] as const

const GENDER_PRESETS = ['Nam', 'Nữ', 'Khác']
const INCOME_PRESETS = ['Thấp', 'Trung bình', 'Cao']
const STANCE_PRESETS = ['cooperative', 'guarded', 'talkative', 'suspicious']

export default function PersonaForm({mode, initial}: PersonaFormProps) {
  const t = useTranslations('ai.interview.form')
  const tRoot = useTranslations('ai.interview')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [globalError, setGlobalError] = useState<string | undefined>()
  const [noAccess, setNoAccess] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftOffline, setDraftOffline] = useState(false)
  const [draftError, setDraftError] = useState(false)
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])

  const [name, setName] = useState(initial?.name ?? '')
  const [age, setAge] = useState(initial?.age?.toString() ?? '')
  const [gender, setGender] = useState(initial?.gender ?? '')
  const [region, setRegion] = useState(initial?.region ?? '')
  const [incomeBracket, setIncomeBracket] = useState(
    initial?.incomeBracket ?? '',
  )
  const [occupation, setOccupation] = useState(initial?.occupation ?? '')
  const [backgroundTags, setBackgroundTags] = useState<string[]>(
    initial?.backgroundTags ?? [],
  )
  const [sliders, setSliders] = useState({
    calm_anxious: initial?.personalitySliders.calm_anxious ?? 50,
    optimistic_cynical: initial?.personalitySliders.optimistic_cynical ?? 50,
    frugal_spendthrift: initial?.personalitySliders.frugal_spendthrift ?? 50,
  })
  const [interviewStance, setInterviewStance] = useState(
    initial?.interviewStance ?? '',
  )
  const [quirksFreetext, setQuirksFreetext] = useState(
    initial?.quirksFreetext ?? '',
  )
  const [bio, setBio] = useState(initial?.generatedBio ?? '')
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '')
  const [status, setStatus] = useState<PersonaStatus>(
    initial?.status ?? 'active',
  )

  const regions = AI_LOCALES[AI_DEFAULT_LOCALE].regions as readonly string[]

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

  const buildPayload = () => ({
    name,
    gender,
    age,
    locale: AI_DEFAULT_LOCALE,
    region,
    incomeBracket,
    occupation,
    backgroundTags,
    personalitySliders: sliders,
    interviewStance,
    quirksFreetext,
    generatedBio: bio || undefined,
    systemPrompt: systemPrompt || undefined,
    status: mode === 'create' ? ('active' as const) : status,
  })

  const handleDraft = () => {
    setDraftOffline(false)
    setDraftError(false)
    setDrafting(true)
    startTransition(async () => {
      const result = await draftPersonaBioAction(buildPayload())
      setDrafting(false)
      if (result.ok) {
        setBio(result.data.bio)
        setSystemPrompt(result.data.systemPrompt)
        return
      }
      if (result.reason === 'offline') setDraftOffline(true)
      else if (result.reason === 'validation') {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
      } else setDraftError(true)
      if (result.reason === 'no-access') setNoAccess(true)
    })
  }

  const handleSave = () => {
    const missing = !name.trim() || !age.trim() || !region || !occupation.trim()
    if (missing) {
      setGlobalError(undefined)
      const errs: FieldErrors = {}
      if (!name.trim()) errs.name = ['required']
      if (!age.trim()) errs.age = ['required']
      if (!region) errs.region = ['required']
      if (!occupation.trim()) errs.occupation = ['required']
      setFieldErrors(errs)
      return
    }
    startTransition(async () => {
      const payload = buildPayload()
      const result =
        mode === 'create'
          ? await createPersonaAction(payload)
          : await updatePersonaAction(initial!.id, payload)
      if (result.ok) {
        router.push('/ai/interview')
        return
      }
      if (result.reason === 'validation') {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
      } else if (result.reason === 'no-access') {
        setNoAccess(true)
      } else {
        setGlobalError(t('saveError'))
      }
    })
  }

  const renderFieldError = (path: string) => {
    const messages = fieldErrors[path]
    if (!messages?.length) return null
    return (
      <p className="text-danger mt-1 text-xs">
        {messages[0] === 'required' ? t('requiredField') : messages[0]}
      </p>
    )
  }

  const inputClass =
    'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'

  return (
    <form
      className="w-full max-w-2xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        handleSave()
      }}
    >
      <Link
        href="/ai/interview"
        className="text-sm underline-offset-2 hover:underline"
      >
        {tRoot('vi.backToRoster')}
      </Link>
      <h2 className="text-xl font-bold">
        {mode === 'create' ? t('newTitle') : t('editTitle')}
      </h2>

      {noAccess && <p className="text-danger text-sm">{t('noAccessError')}</p>}
      {globalError && (
        <p role="alert" className="text-danger text-sm">
          {globalError}
        </p>
      )}

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
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        {renderFieldError('name')}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className={inputClass}
          />
          {renderFieldError('age')}
        </div>
        <div>
          <label
            htmlFor="persona-gender"
            className="mb-1 block text-sm font-medium"
          >
            {t('gender')}
          </label>
          <input
            id="persona-gender"
            type="text"
            list="persona-gender-presets"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className={inputClass}
          />
          <datalist id="persona-gender-presets">
            {GENDER_PRESETS.map((preset) => (
              <option key={preset} value={preset} />
            ))}
          </datalist>
          {renderFieldError('gender')}
        </div>
      </div>

      <input type="hidden" name="locale" value={AI_DEFAULT_LOCALE} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="persona-region"
            className="mb-1 block text-sm font-medium"
          >
            {t('region')}
          </label>
          <select
            id="persona-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              —
            </option>
            {regions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('regionHint')}
          </p>
          {renderFieldError('region')}
        </div>
        <div>
          <label
            htmlFor="persona-income"
            className="mb-1 block text-sm font-medium"
          >
            {t('income')}
          </label>
          <input
            id="persona-income"
            type="text"
            list="persona-income-presets"
            value={incomeBracket}
            onChange={(e) => setIncomeBracket(e.target.value)}
            className={inputClass}
          />
          <datalist id="persona-income-presets">
            {INCOME_PRESETS.map((preset) => (
              <option key={preset} value={preset} />
            ))}
          </datalist>
          {renderFieldError('incomeBracket')}
        </div>
      </div>

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
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
          className={inputClass}
        />
        {renderFieldError('occupation')}
      </div>

      <PersonaTags
        value={backgroundTags}
        onChange={setBackgroundTags}
        suggestions={tagSuggestions}
        label={t('tags')}
        hint={t('tagsHint')}
        addPlaceholder={t('tagsAddPlaceholder')}
        disabled={isPending}
      />

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('sliders')}</legend>
        <div className="space-y-4">
          {SLIDER_AXES.map((axis) => (
            <PersonaSlider
              key={axis.key}
              axisKey={axis.key}
              value={sliders[axis.key]}
              onChange={(value) =>
                setSliders((prev) => ({...prev, [axis.key]: value}))
              }
              poleStartLabel={t(axis.start)}
              poleEndLabel={t(axis.end)}
              ariaLabel={`${t(axis.start)} – ${t(axis.end)}`}
              disabled={isPending}
            />
          ))}
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="persona-stance"
          className="mb-1 block text-sm font-medium"
        >
          {t('stance')}
        </label>
        <input
          id="persona-stance"
          type="text"
          list="persona-stance-presets"
          value={interviewStance}
          onChange={(e) => setInterviewStance(e.target.value)}
          className={inputClass}
        />
        <datalist id="persona-stance-presets">
          {STANCE_PRESETS.map((preset) => (
            <option key={preset} value={preset} />
          ))}
        </datalist>
        <p className="text-muted-foreground mt-1 text-xs">{t('stanceHint')}</p>
        {renderFieldError('interviewStance')}
      </div>

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
          value={quirksFreetext}
          onChange={(e) => setQuirksFreetext(e.target.value)}
          className={inputClass}
        />
        {renderFieldError('quirksFreetext')}
      </div>

      <PersonaBioPanel
        bio={bio}
        systemPrompt={systemPrompt}
        onBioChange={setBio}
        onSystemPromptChange={setSystemPrompt}
        onDraft={handleDraft}
        drafting={drafting}
        offline={draftOffline}
        error={draftError}
        labels={{
          bio: t('bio'),
          systemPrompt: t('systemPrompt'),
          advanced: t('advanced'),
          draftBio: t('draftBio'),
          regenerate: t('regenerate'),
          drafting: t('drafting'),
          offlineError: t('bioOfflineError'),
          error: t('bioError'),
        }}
      />

      {mode === 'edit' && (
        <div>
          <label
            htmlFor="persona-status"
            className="mb-1 block text-sm font-medium"
          >
            {t('status')}
          </label>
          <select
            id="persona-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as PersonaStatus)}
            className={inputClass}
          >
            <option value="draft">{tRoot('status.draft')}</option>
            <option value="active">{tRoot('status.active')}</option>
          </select>
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" className="button" disabled={isPending}>
          {isPending && !drafting ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  )
}
