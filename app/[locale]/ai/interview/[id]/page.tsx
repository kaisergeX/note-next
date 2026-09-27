import type {Metadata} from 'next'
import {IconArrowLeft, IconEdit, IconMessages} from '@tabler/icons-react'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getFormatter, getTranslations} from 'next-intl/server'
import type {PersonaStatus} from '~/db/schema/personas'
import {getPersonaById} from '~/db/helper/personas'
import {isShapedUuid} from '~/lib/ai/id-shape'
import {requireAuth} from '~/server-utils'

const SLIDER_AXES = [
  {key: 'calm_anxious', start: 'sliderCalm', end: 'sliderAnxious'},
  {key: 'optimistic_cynical', start: 'sliderOptimistic', end: 'sliderCynical'},
  {key: 'frugal_spendthrift', start: 'sliderFrugal', end: 'sliderSpendthrift'},
] as const

const STATUS_BADGE_CLASS: Record<PersonaStatus, string> = {
  draft: 'border-amber-500 text-amber-600 dark:text-amber-400',
  active: 'border-green-600 text-green-600 dark:text-green-400',
  archived: 'border-zinc-400 text-zinc-500',
}

function ProfileField({label, value}: {label: string; value: string}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm wrap-anywhere">{value}</dd>
    </div>
  )
}

/** Read-only slider display: same layout as PersonaSlider, static bar instead of an input. */
function StaticSlider({
  poleStartLabel,
  poleEndLabel,
  value,
}: {
  poleStartLabel: string
  poleEndLabel: string
  value: number
}) {
  return (
    <div>
      <div className="flex-center-between mb-1 text-sm">
        <span className="font-medium">{poleStartLabel}</span>
        <span className="text-zinc-500 tabular-nums">{value}</span>
        <span className="font-medium">{poleEndLabel}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className="h-full rounded-full bg-zinc-900 dark:bg-zinc-300"
          style={{width: `${Math.min(100, Math.max(0, value))}%`}}
        />
      </div>
    </div>
  )
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/ai/interview/[id]'>): Promise<Metadata> {
  const {id} = await params
  if (!isShapedUuid(id)) notFound()
  const persona = await getPersonaById(id)
  const t = await getTranslations('ai.interview')

  return {title: persona ? persona.name : t('title')}
}

export default async function PersonaProfilePage({
  params,
}: PageProps<'/[locale]/ai/interview/[id]'>) {
  await requireAuth()
  const {id} = await params
  if (!isShapedUuid(id)) notFound()
  const persona = await getPersonaById(id)
  if (!persona) notFound()

  const t = await getTranslations('ai.interview')
  const tForm = await getTranslations('ai.interview.form')
  const tCommon = await getTranslations('common')
  const format = await getFormatter()

  // Canonical EN keys get localized labels; custom/legacy values fall back verbatim.
  const genderLabel =
    persona.gender === 'male' || persona.gender === 'female'
      ? tForm(`options.gender.${persona.gender}`)
      : (persona.gender ?? tForm('genderUnspecified'))
  const incomeLabel =
    persona.incomeBracket === 'low' ||
    persona.incomeBracket === 'medium' ||
    persona.incomeBracket === 'high'
      ? tForm(`options.income.${persona.incomeBracket}`)
      : (persona.incomeBracket ?? '—')
  const stanceLabel =
    persona.interviewStance === 'cooperative' ||
    persona.interviewStance === 'guarded' ||
    persona.interviewStance === 'talkative' ||
    persona.interviewStance === 'suspicious'
      ? tForm(`options.stance.${persona.interviewStance}`)
      : (persona.interviewStance ?? '—')

  const lastUpdated = format.dateTime(persona.updatedAt, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <section className="container mx-auto space-y-4 p-4 pb-16">
      <div>
        <Link
          href="/ai/interview"
          className="inline-flex items-center gap-1 text-sm"
        >
          <IconArrowLeft size="18" /> {tCommon('navigation.back')}
        </Link>
      </div>

      <div className="flex-center-between gap-2">
        <h1 className="text-2xl font-bold wrap-anywhere">{persona.name}</h1>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[persona.status]}`}
        >
          {t(`status.${persona.status}`)}
        </span>
      </div>

      <p className="text-muted-foreground text-sm">
        {t('profile.lastUpdated', {time: lastUpdated})}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {persona.systemPrompt && (
          <Link
            href={`/ai/interview/${persona.id}/chat`}
            className="button text-sm"
          >
            <IconMessages size="1.2rem" /> {t('chat.openChat')}
          </Link>
        )}
        <Link
          href={`/ai/interview/${persona.id}/edit`}
          className="button-secondary text-sm"
        >
          <IconEdit size="1.2rem" /> {t('roster.edit')}
        </Link>
      </div>

      <div className="card space-y-4 p-4">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <ProfileField label={tForm('gender')} value={genderLabel} />
          <ProfileField
            label={tForm('age')}
            value={persona.age?.toString() ?? '—'}
          />
          <ProfileField label={tForm('region')} value={persona.region} />
          <ProfileField label={tForm('income')} value={incomeLabel} />
          <ProfileField
            label={tForm('occupation')}
            value={persona.occupation ?? '—'}
          />
          <ProfileField label={tForm('stance')} value={stanceLabel} />
        </dl>

        <div>
          <h2 className="mb-2 text-sm font-medium">{tForm('tags')}</h2>
          {persona.backgroundTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {persona.backgroundTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">—</p>
          )}
        </div>
      </div>

      <div className="card space-y-4 p-4">
        <h2 className="text-sm font-medium">{tForm('sliders')}</h2>
        <div className="space-y-4">
          {SLIDER_AXES.map((axis) => (
            <StaticSlider
              key={axis.key}
              poleStartLabel={tForm(axis.start)}
              poleEndLabel={tForm(axis.end)}
              value={persona.personalitySliders[axis.key]}
            />
          ))}
        </div>
      </div>

      {persona.quirksFreetext && (
        <div className="card space-y-2 p-4">
          <h2 className="text-sm font-medium">{tForm('quirks')}</h2>
          <p className="text-sm wrap-anywhere whitespace-pre-wrap">
            {persona.quirksFreetext}
          </p>
        </div>
      )}

      <div className="card space-y-2 p-4">
        <h2 className="text-sm font-medium">{tForm('bio')}</h2>
        {persona.generatedBio ? (
          <p className="text-sm wrap-anywhere whitespace-pre-wrap">
            {persona.generatedBio}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm wrap-anywhere">
            {t('profile.emptyBio')}
          </p>
        )}
      </div>

      <div className="card space-y-2 p-4">
        <h2 className="text-sm font-medium">{tForm('systemPrompt')}</h2>
        {persona.systemPrompt ? (
          <pre className="text-muted-foreground overflow-x-auto text-xs wrap-anywhere whitespace-pre-wrap">
            {persona.systemPrompt}
          </pre>
        ) : (
          <p className="text-muted-foreground text-sm wrap-anywhere">
            {t('profile.emptySystemPrompt')}
          </p>
        )}
      </div>
    </section>
  )
}
