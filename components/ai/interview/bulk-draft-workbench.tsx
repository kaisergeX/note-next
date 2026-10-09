'use client'

import {IconLoader2, IconSparkles} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useState, useTransition} from 'react'
import {generatePersonaCandidatesAction} from '~/app/[locale]/ai/interview/actions'
import PersonaDraftCard, {type PersonaDraftCardData} from './persona-draft-card'

export type BulkBannerReason =
  | 'validation'
  | 'offline'
  | 'notDraft'
  | 'hasTranscripts'
  | 'keepFailed'
  | 'noCandidates'
  | 'error'
  | null

type BulkDraftWorkbenchProps = {
  drafts: PersonaDraftCardData[]
}

const MIX_DESCRIPTION_MAX_CHARS = 2000
const BATCH_SIZES = [2, 3, 4, 5, 6, 7, 8]
const BATCH_DEFAULT_SIZE = 5

export default function BulkDraftWorkbench({drafts}: BulkDraftWorkbenchProps) {
  const t = useTranslations('ai.interview.bulk')
  const tForm = useTranslations('ai.interview.form')
  const router = useRouter()
  const [mixDescription, setMixDescription] = useState('')
  const [batchSize, setBatchSize] = useState(BATCH_DEFAULT_SIZE)
  const [isPending, startTransition] = useTransition()
  const [banner, setBanner] = useState<BulkBannerReason>(null)

  const generate = () => {
    setBanner(null)
    if (mixDescription.trim().length === 0) {
      setBanner('validation')
      return
    }
    startTransition(async () => {
      const result = await generatePersonaCandidatesAction({
        mixDescription,
        batchSize,
      })
      if (result.ok) router.refresh()
      else if (result.reason === 'offline') setBanner('offline')
      else if (result.reason === 'validation') setBanner('validation')
      else if (result.reason === 'noCandidates') setBanner('noCandidates')
      else setBanner('error')
    })
  }

  const bannerText =
    banner === null
      ? null
      : banner === 'offline'
        ? tForm('bioOfflineError')
        : banner === 'validation'
          ? t('errorValidation')
          : banner === 'notDraft'
            ? t('errorNotDraft')
            : banner === 'hasTranscripts'
              ? t('errorHasTranscripts')
              : banner === 'keepFailed'
                ? t('keepFailed')
                : banner === 'noCandidates'
                  ? t('errorNoCandidates')
                  : t('errorGeneric')

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-col gap-4 p-4">
        <p className="text-muted-foreground text-sm">{t('introHint')}</p>

        <div>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <label
              htmlFor="bulk-mix-description"
              className="block text-sm font-medium"
            >
              {t('mixDescription')}
            </label>
            <span className="text-muted-foreground text-xs tabular-nums">
              {t('charCount', {
                count: mixDescription.length,
                max: MIX_DESCRIPTION_MAX_CHARS,
              })}
            </span>
          </div>
          <textarea
            id="bulk-mix-description"
            rows={4}
            maxLength={MIX_DESCRIPTION_MAX_CHARS}
            value={mixDescription}
            disabled={isPending}
            placeholder={t('mixDescriptionPlaceholder')}
            onChange={(e) => setMixDescription(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="bulk-batch-size"
              className="mb-1 block text-sm font-medium"
            >
              {t('batchSize')}
            </label>
            <select
              id="bulk-batch-size"
              value={batchSize}
              disabled={isPending}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {BATCH_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="button"
            disabled={isPending}
            onClick={generate}
          >
            {isPending ? (
              <IconLoader2 className="animate-spin" size="1.2rem" />
            ) : (
              <IconSparkles size="1.2rem" />
            )}
            {isPending ? t('generating') : t('generate')}
          </button>
        </div>

        {bannerText && (
          <p role="alert" className="text-danger text-sm">
            {bannerText}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex-center-between gap-2">
          <h2 className="text-lg font-semibold">{t('draftsHeading')}</h2>
          <button
            type="button"
            className="button-secondary text-sm"
            disabled={isPending}
            onClick={generate}
          >
            {isPending ? (
              <IconLoader2 className="animate-spin" size="1.2rem" />
            ) : (
              <IconSparkles size="1.2rem" />
            )}
            {isPending ? t('generating') : t('generateMore')}
          </button>
        </div>
        {drafts.length === 0 ? (
          <div className="flex-center flex-col gap-1 py-12">
            <h3 className="opacity-80">{t('empty')}</h3>
            <p className="text-muted-foreground text-sm">{t('emptyHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-4 pb-16">
            {drafts.map((persona) => (
              <PersonaDraftCard
                key={persona.id}
                persona={persona}
                mixDescription={mixDescription}
                generateBusy={isPending}
                onBanner={setBanner}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
