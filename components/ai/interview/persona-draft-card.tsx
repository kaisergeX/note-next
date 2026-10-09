'use client'

import {
  IconEdit,
  IconLoader2,
  IconRefresh,
  IconTrash,
  IconUserCheck,
} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {Dialog} from '@kaiverse/k/ui'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useState, useTransition} from 'react'
import {
  discardPersonaDraftAction,
  rerollPersonaCandidateAction,
  setPersonaStatusAction,
} from '~/app/[locale]/ai/interview/actions'
import type {PersonalitySliders} from '~/db/schema/transcripts'
import PersonaSlider from './persona-slider'
import type {BulkBannerReason} from './bulk-draft-workbench'

export type PersonaDraftCardData = {
  id: string
  name: string
  region: string
  occupation: string | null
  backgroundTags: string[]
  personalitySliders: PersonalitySliders
  bio: string | null
}

type PersonaDraftCardProps = {
  persona: PersonaDraftCardData
  mixDescription: string
  /** True while the workbench generate action runs; card actions pause. */
  generateBusy: boolean
  onBanner: (reason: BulkBannerReason) => void
}

export default function PersonaDraftCard({
  persona,
  mixDescription,
  generateBusy,
  onBanner,
}: PersonaDraftCardProps) {
  const t = useTranslations('ai.interview.bulk')
  const tForm = useTranslations('ai.interview.form')
  const tChat = useTranslations('ai.interview.chat')
  const tStatus = useTranslations('ai.interview.status')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rerollOpen, setRerollOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const rerollDisabled =
    isPending || generateBusy || mixDescription.trim().length === 0

  const handleKeep = () => {
    onBanner(null)
    startTransition(async () => {
      const result = await setPersonaStatusAction(persona.id, 'active')
      if (result.ok) router.refresh()
      else onBanner('keepFailed')
    })
  }

  const handleReroll = () => {
    setRerollOpen(false)
    onBanner(null)
    startTransition(async () => {
      const result = await rerollPersonaCandidateAction(
        persona.id,
        mixDescription,
      )
      if (result.ok) router.refresh()
      else if (
        result.reason === 'notDraft' ||
        result.reason === 'hasTranscripts' ||
        result.reason === 'offline'
      ) {
        onBanner(result.reason)
      } else if (result.reason === 'validation') {
        onBanner('validation')
      } else {
        onBanner('error')
      }
    })
  }

  const handleDiscard = () => {
    setDiscardOpen(false)
    onBanner(null)
    startTransition(async () => {
      const result = await discardPersonaDraftAction(persona.id)
      if (result.ok) router.refresh()
      else if (
        result.reason === 'notDraft' ||
        result.reason === 'hasTranscripts'
      ) {
        onBanner(result.reason)
      } else {
        onBanner('error')
      }
    })
  }

  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex-center-between gap-2">
        <Link
          href={`/ai/interview/${persona.id}/edit`}
          className="font-semibold wrap-anywhere hover:underline"
        >
          {persona.name}
        </Link>
        <span className="rounded-full border border-amber-500 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
          {tStatus('draft')}
        </span>
      </div>

      <p className="text-muted-foreground text-sm">
        {[persona.region, persona.occupation]
          .filter((part) => part !== undefined && part !== '')
          .join(' · ')}
      </p>

      {persona.backgroundTags.length > 0 && (
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
      )}

      <div className="grid gap-2">
        <PersonaSlider
          axisKey="calm_anxious"
          value={persona.personalitySliders.calm_anxious ?? 50}
          onChange={() => {}}
          poleStartLabel={tForm('sliderCalm')}
          poleEndLabel={tForm('sliderAnxious')}
          ariaLabel={tForm('sliderCalm')}
          disabled
        />
        <PersonaSlider
          axisKey="optimistic_cynical"
          value={persona.personalitySliders.optimistic_cynical ?? 50}
          onChange={() => {}}
          poleStartLabel={tForm('sliderOptimistic')}
          poleEndLabel={tForm('sliderCynical')}
          ariaLabel={tForm('sliderOptimistic')}
          disabled
        />
        <PersonaSlider
          axisKey="frugal_spendthrift"
          value={persona.personalitySliders.frugal_spendthrift ?? 50}
          onChange={() => {}}
          poleStartLabel={tForm('sliderFrugal')}
          poleEndLabel={tForm('sliderSpendthrift')}
          ariaLabel={tForm('sliderFrugal')}
          disabled
        />
      </div>

      {persona.bio && (
        <p className="text-muted-foreground line-clamp-3 text-sm">
          {persona.bio}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <button
          type="button"
          className="button text-sm"
          disabled={isPending || generateBusy}
          onClick={handleKeep}
        >
          {isPending ? (
            <IconLoader2 className="animate-spin" size="1.2rem" />
          ) : (
            <IconUserCheck size="18" />
          )}
          {t('keep')}
        </button>
        <Link
          href={`/ai/interview/${persona.id}/edit`}
          className="button-secondary text-sm"
        >
          <IconEdit size="18" /> {t('edit')}
        </Link>
        <button
          type="button"
          className="button-secondary text-sm"
          disabled={rerollDisabled}
          title={rerollDisabled ? t('rerollNeedsMix') : undefined}
          onClick={() => setRerollOpen(true)}
        >
          <IconRefresh size="18" /> {t('reroll')}
        </button>
        <button
          type="button"
          className="button-secondary text-sm"
          disabled={isPending || generateBusy}
          onClick={() => setDiscardOpen(true)}
        >
          <IconTrash size="18" /> {t('discard')}
        </button>
      </div>

      <Dialog
        className="bg-default max-w-lg"
        open={rerollOpen}
        onClose={() => setRerollOpen(false)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Dialog.Header>
          <Dialog.Title>{t('rerollConfirmTitle')}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Content>{t('rerollConfirmBody')}</Dialog.Content>
        <Dialog.Footer className="justify-end">
          <button
            type="button"
            className="button-secondary"
            onClick={() => setRerollOpen(false)}
          >
            {tChat('cancel')}
          </button>
          <button
            type="button"
            className="button-danger"
            disabled={rerollDisabled}
            onClick={handleReroll}
          >
            {isPending ? (
              <IconLoader2 className="animate-spin" size="16" />
            ) : (
              <IconRefresh size="16" />
            )}{' '}
            {t('reroll')}
          </button>
        </Dialog.Footer>
      </Dialog>

      <Dialog
        className="bg-default max-w-lg"
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Dialog.Header>
          <Dialog.Title>{t('discardConfirmTitle')}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Content>{t('discardConfirmBody')}</Dialog.Content>
        <Dialog.Footer className="justify-end">
          <button
            type="button"
            className="button-secondary"
            onClick={() => setDiscardOpen(false)}
          >
            {tChat('cancel')}
          </button>
          <button
            type="button"
            className="button-danger"
            disabled={isPending || generateBusy}
            onClick={handleDiscard}
          >
            <IconTrash size="16" /> {t('discard')}
          </button>
        </Dialog.Footer>
      </Dialog>
    </div>
  )
}
