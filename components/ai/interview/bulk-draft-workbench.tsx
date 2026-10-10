'use client'

import {IconLoader2, IconPlayerStop, IconSparkles} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useRef, useState, useTransition} from 'react'
import {
  generatePersonaCandidateAction,
  type PersonaCandidate,
} from '~/app/[locale]/ai/interview/actions'
import PersonaDraftCard, {type PersonaDraftCardData} from './persona-draft-card'

export type BulkBannerReason =
  | 'validation'
  | 'offline'
  | 'notDraft'
  | 'hasTranscripts'
  | 'keepFailed'
  | 'error'
  | null

type BulkDraftWorkbenchProps = {
  drafts: PersonaDraftCardData[]
}

/** PersonaCandidate → card shape (systemPrompt unused by the card). */
function toCardData(candidate: PersonaCandidate): PersonaDraftCardData {
  const {systemPrompt: _, ...card} = candidate
  return card
}

const MIX_DESCRIPTION_MAX_CHARS = 2000
const BATCH_SIZES = [2, 3, 4, 5, 6, 7, 8]
const BATCH_DEFAULT_SIZE = 5

// Module-scope guard: React strict mode remounts create a second component
// instance with a fresh runningRef; this flag keeps one loop across
// instances (same pattern as the Phase 5 RunLoop).
let activeBulkLoop = false

export default function BulkDraftWorkbench({
  drafts: propsDrafts,
}: BulkDraftWorkbenchProps) {
  const t = useTranslations('ai.interview.bulk')
  const tForm = useTranslations('ai.interview.form')
  const router = useRouter()
  const [mixDescription, setMixDescription] = useState('')
  const [batchSize, setBatchSize] = useState(BATCH_DEFAULT_SIZE)
  const [isPending, startTransition] = useTransition()
  const [banner, setBanner] = useState<BulkBannerReason>(null)
  // Progress while the client-driven loop runs; null = idle.
  const [loop, setLoop] = useState<{done: number; total: number} | null>(null)
  // Which button started the running loop; progress label renders on it.
  const [loopSource, setLoopSource] = useState<'primary' | 'more' | null>(null)
  // Server rows are primary: they always render (minus ids removed by
  // Keep/Discard). Arrived copies are a stopgap only, rendered while their
  // id is still absent from server rows (a just-inserted candidate may lag
  // one refresh); after the reconciliation refresh the server row replaces
  // the client copy, so no duplicates appear. Accepted trade-off: a
  // candidate deleted in another tab is absent from server rows, so its
  // arrived copy is never reconciled away and persists for the
  // component's lifetime.
  const [arrived, setArrived] = useState<PersonaDraftCardData[]>([])
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(new Set())

  // Ref guards: `runningRef` keeps one loop per tab, `cancelRef` is read
  // between calls (the in-flight call finishes normally).
  const runningRef = useRef(false)
  const cancelRef = useRef(false)

  /**
   * Sequential loop: one generatePersonaCandidateAction per iteration. Each
   * `ok` appends the returned candidate to client state so its card renders
   * immediately (no per-iteration server refresh). One `router.refresh()`
   * after the loop reconciles server truth (ordering, other tabs). Any
   * failure shows the banner, keeps already-arrived candidates and stops
   * the loop; Cancel stops scheduling further calls.
   */
  const generate = (source: 'primary' | 'more') => {
    if (runningRef.current || activeBulkLoop) return
    setBanner(null)
    if (mixDescription.trim().length === 0) {
      setBanner('validation')
      return
    }
    cancelRef.current = false
    // Set guards and progress synchronously: React defers transition
    // callbacks past this event handler, so flags set inside startTransition
    // would let two rapid clicks both pass the guard below and run
    // concurrent loops — and skeletons/progress would appear late.
    runningRef.current = true
    activeBulkLoop = true
    setLoop({done: 0, total: batchSize})
    setLoopSource(source)
    startTransition(async () => {
      try {
        for (let done = 0; done < batchSize; done++) {
          if (cancelRef.current) break
          let result
          try {
            result = await generatePersonaCandidateAction(mixDescription)
          } catch {
            setBanner('error')
            break
          }
          if (!result.ok) {
            if (result.reason === 'offline') setBanner('offline')
            else if (result.reason === 'validation') setBanner('validation')
            else setBanner('error')
            break
          }
          setArrived((prev) => [...prev, toCardData(result.data)])
          setLoop({done: done + 1, total: batchSize})
        }
        // Single reconciliation refresh after the whole loop — never per
        // iteration.
        router.refresh()
      } finally {
        runningRef.current = false
        activeBulkLoop = false
        setLoop(null)
        setLoopSource(null)
      }
    })
  }

  // Card actions mutate client state; DB truth is updated by the same
  // server actions inside the card, so no refresh is needed here.
  const removeFromDisplay = (id: string) => {
    setRemovedIds((prev) => new Set(prev).add(id))
  }
  const handleRerolled = (oldId: string, replacement: PersonaDraftCardData) => {
    setRemovedIds((prev) => new Set(prev).add(oldId))
    setArrived((prev) => [...prev, replacement])
  }

  // Server truth wins: drop the arrived copy for any candidate fresh server
  // rows also contain; arrived copies not yet on the server stay (they may
  // lag one refresh).
  const serverIds = new Set(propsDrafts.map((persona) => persona.id))
  const drafts = [
    ...propsDrafts.filter((persona) => !removedIds.has(persona.id)),
    ...arrived.filter(
      (candidate) =>
        !removedIds.has(candidate.id) && !serverIds.has(candidate.id),
    ),
  ]

  const cancelLoop = () => {
    cancelRef.current = true
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
                : t('errorGeneric')

  const skeletonCount = loop === null ? 0 : loop.total - loop.done
  // The button that started the running loop carries the progress label;
  // the other button stays idle with its normal label.
  const primaryActive = loop !== null && loopSource === 'primary'
  const moreActive = loop !== null && loopSource === 'more'

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
              className="w-full rounded-md border border-zinc-300 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
            onClick={() => generate('primary')}
          >
            {primaryActive ? (
              <IconLoader2 className="animate-spin" size="1.2rem" />
            ) : (
              <IconSparkles size="1.2rem" />
            )}
            {primaryActive && loop !== null ? (
              <span className="tabular-nums">
                {t('progress', {done: loop.done, total: loop.total})}
              </span>
            ) : isPending && loop === null ? (
              t('generating')
            ) : (
              t('generate')
            )}
          </button>
          {isPending && (
            <button
              type="button"
              className="button-secondary"
              onClick={cancelLoop}
            >
              <IconPlayerStop size="1.2rem" /> {t('cancel')}
            </button>
          )}
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
            onClick={() => generate('more')}
          >
            {moreActive ? (
              <IconLoader2 className="animate-spin" size="1.2rem" />
            ) : (
              <IconSparkles size="1.2rem" />
            )}
            {moreActive && loop !== null ? (
              <span className="tabular-nums">
                {t('progress', {done: loop.done, total: loop.total})}
              </span>
            ) : isPending && loop === null ? (
              t('generating')
            ) : (
              t('generateMore')
            )}
          </button>
        </div>
        {drafts.length === 0 && skeletonCount === 0 ? (
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
                onKept={removeFromDisplay}
                onRerolled={handleRerolled}
                onDiscarded={removeFromDisplay}
              />
            ))}
            {Array.from({length: skeletonCount}, (_, index) => (
              <div
                key={`skeleton-${index}`}
                aria-hidden
                className="card flex flex-col gap-2 p-4"
              >
                <div className="h-5 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="mt-2 flex flex-col gap-2">
                  <div className="h-1.5 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-1.5 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-1.5 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                </div>
                <div className="mt-auto flex gap-2 pt-2">
                  <div className="h-8 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-8 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
