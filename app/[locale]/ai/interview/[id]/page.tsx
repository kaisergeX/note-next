import type {Metadata} from 'next'
import {
  IconArrowLeft,
  IconDownload,
  IconEdit,
  IconMessages,
} from '@tabler/icons-react'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getLocale, getFormatter, getTranslations} from 'next-intl/server'
import {Badge} from '~/components/ui/badge'
import LinkButton from '~/components/ui/link-button'
import {getPersonaById} from '~/db/helper/personas'
import MenuCustom, {type MenuCustomItem} from '~/components/ui/menu'
import {isShapedUuid} from '~/lib/ai/id-shape'
import {requireAuth} from '~/server-utils'

const SLIDER_AXES = [
  {key: 'calm_anxious', start: 'sliderCalm', end: 'sliderAnxious'},
  {key: 'optimistic_cynical', start: 'sliderOptimistic', end: 'sliderCynical'},
  {key: 'frugal_spendthrift', start: 'sliderFrugal', end: 'sliderSpendthrift'},
] as const

function ProfileField({label, value}: {label: string; value: string}) {
  return (
    <div>
      <dt className="text-ink-muted text-xs">{label}</dt>
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
        <span className="text-ink-muted tabular-nums">{value}</span>
        <span className="font-medium">{poleEndLabel}</span>
      </div>
      <div className="bg-ink-tint h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-ink h-full rounded-full"
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
  // Export API routes live outside the [locale] segment, so the UI locale is
  // forwarded for the Markdown report labels.
  const locale = await getLocale()

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

  // Plain anchors: the API responds with Content-Disposition, so normal
  // navigation downloads the file — no fetch/Blob handling needed.
  const exportMenuItems: MenuCustomItem[] = [
    {
      type: 'link',
      url: `/api/ai/interview/export/persona/${persona.id}?format=md&locale=${locale}`,
      label: (
        <>
          <IconDownload size="18" /> {t('export.report')}
        </>
      ),
    },
    {
      type: 'link',
      url: `/api/ai/interview/export/persona/${persona.id}?format=csv&locale=${locale}`,
      label: (
        <>
          <IconDownload size="18" /> {t('export.dataCsv')}
        </>
      ),
    },
    {
      type: 'link',
      url: `/api/ai/interview/export/persona/${persona.id}?format=json&locale=${locale}`,
      label: (
        <>
          <IconDownload size="18" /> {t('export.backupJson')}
        </>
      ),
    },
  ]

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
        <Badge status={persona.status}>{t(`status.${persona.status}`)}</Badge>
      </div>

      <p className="text-ink-muted text-sm">
        {t('profile.lastUpdated', {time: lastUpdated})}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {persona.systemPrompt && persona.status !== 'draft' && (
          <LinkButton
            href={`/ai/interview/${persona.id}/chat`}
            variant="primary"
            size="sm"
          >
            <IconMessages size="1.2rem" /> {t('chat.openChat')}
          </LinkButton>
        )}
        <LinkButton href={`/ai/interview/${persona.id}/edit`} size="sm">
          <IconEdit size="1.2rem" /> {t('roster.edit')}
        </LinkButton>
        <MenuCustom
          className="border-hairline bg-paper-raised text-ink hover:bg-raised-hover rounded-full border"
          itemsClassName="w-48"
          items={exportMenuItems}
        >
          <span className="sr-only">{t('export.menu')}</span>
          <IconDownload size="18" />
        </MenuCustom>
      </div>

      <div className="border-hairline bg-paper-raised text-ink space-y-4 rounded-lg border p-4">
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
                  className="border-hairline bg-paper text-ink rounded-full border px-2 py-0.5 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-ink-muted text-sm">—</p>
          )}
        </div>
      </div>

      <div className="border-hairline bg-paper-raised text-ink space-y-4 rounded-lg border p-4">
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
        <div className="border-hairline bg-paper-raised text-ink space-y-2 rounded-lg border p-4">
          <h2 className="text-sm font-medium">{tForm('quirks')}</h2>
          <p className="text-sm wrap-anywhere whitespace-pre-wrap">
            {persona.quirksFreetext}
          </p>
        </div>
      )}

      <div className="border-hairline bg-paper-raised text-ink space-y-2 rounded-lg border p-4">
        <h2 className="text-sm font-medium">{tForm('bio')}</h2>
        {persona.generatedBio ? (
          <p className="text-sm wrap-anywhere whitespace-pre-wrap">
            {persona.generatedBio}
          </p>
        ) : (
          <p className="text-ink-muted text-sm wrap-anywhere">
            {t('profile.emptyBio')}
          </p>
        )}
      </div>

      <div className="border-hairline bg-paper-raised text-ink space-y-2 rounded-lg border p-4">
        <h2 className="text-sm font-medium">{tForm('systemPrompt')}</h2>
        {persona.systemPrompt ? (
          <pre className="text-ink-muted overflow-x-auto text-xs wrap-anywhere whitespace-pre-wrap">
            {persona.systemPrompt}
          </pre>
        ) : (
          <p className="text-ink-muted text-sm wrap-anywhere">
            {t('profile.emptySystemPrompt')}
          </p>
        )}
      </div>
    </section>
  )
}
