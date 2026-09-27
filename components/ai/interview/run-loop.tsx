'use client'

import {
  IconAlertTriangle,
  IconLoader2,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useRef, useState} from 'react'
import {
  retryFailedRunItemsAction,
  runNextStepAction,
} from '~/app/[locale]/ai/interview/actions'
import type {RunItemStatus, RunStatus} from '~/db/schema/transcripts'
import {RUN_STATUS_BADGE_CLASS} from '~/components/ai/interview/run-status'

export type RunProgressView = {
  total: number
  done: number
  failed: number
  pending: number
}

export type RunItemView = {
  id: string
  personaName: string
  status: RunItemStatus
  error: string | null
}

type RunLoopProps = {
  runId: string
  initialStatus: RunStatus
  initialProgress: RunProgressView
  initialItems: RunItemView[]
}

// Run item error kinds stored by runNextStepAction (LMStudioError.kind);
// the raw kind is safe to show, the full message could leak the LM Studio
// endpoint URL.
const KNOWN_ERROR_KINDS = new Set(['unreachable', 'auth', 'timeout', 'http'])

// Module-scope guard: React strict mode remounts create a second component
// instance with a fresh runningRef; this set keeps one loop per runId across
// instances.
const activeLoopRuns = new Set<string>()

export default function RunLoop({
  runId,
  initialStatus,
  initialProgress,
  initialItems,
}: RunLoopProps) {
  const t = useTranslations('ai.interview.run')
  const router = useRouter()
  const [runStatus, setRunStatus] = useState<RunStatus>(initialStatus)
  const [progress, setProgress] = useState<RunProgressView>(initialProgress)
  const [items, setItems] = useState<RunItemView[]>(initialItems)
  const [loopActive, setLoopActive] = useState(false)
  const [paused, setPaused] = useState(false)
  const [offline, setOffline] = useState(false)
  const [stepError, setStepError] = useState(false)
  const [retrying, setRetrying] = useState(false)

  // Ref guards: `runningRef` keeps one loop per tab (React strict mode mounts
  // twice; a second start must be a no-op), `stopRef` is read between steps,
  // `mountedRef` drops late setState after unmount.
  const runningRef = useRef(false)
  const stopRef = useRef(false)
  const mountedRef = useRef(true)
  // Ref mirror of the items state: the async loop reads the latest list for
  // id-matching without adding `items` to runLoop's deps (a long-running
  // closure over state would go stale mid-loop).
  const itemsRef = useRef(initialItems)

  // Every items mutation funnels here so the ref mirror stays in sync.
  const updateItems = (updater: (prev: RunItemView[]) => RunItemView[]) => {
    const next = updater(itemsRef.current)
    itemsRef.current = next
    setItems(next)
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  /**
   * Sequential stepper: one runNextStepAction at a time, local state updated
   * from each RunStepResult. The claimed item is the lowest-id claimable row;
   * the step result carries its runItemId, so state is matched by id (persona
   * names can collide).
   */
  const runLoop = useCallback(async () => {
    if (runningRef.current || activeLoopRuns.has(runId)) return
    runningRef.current = true
    activeLoopRuns.add(runId)
    stopRef.current = false
    setLoopActive(true)
    setPaused(false)
    setOffline(false)
    setStepError(false)
    try {
      for (;;) {
        if (stopRef.current) {
          if (mountedRef.current) setPaused(true)
          break
        }
        let result
        try {
          result = await runNextStepAction(runId)
        } catch {
          if (mountedRef.current) setStepError(true)
          break
        }
        if (!mountedRef.current) break
        if (!result.ok) {
          setStepError(true)
          break
        }
        setProgress(result.data.progress)
        if (result.data.done) {
          setRunStatus('done')
          router.refresh()
          break
        }
        const {item, reason} = result.data
        const matchIndex = itemsRef.current.findIndex(
          (candidate) =>
            (candidate.status === 'pending' ||
              candidate.status === 'in_progress') &&
            candidate.id === item.runItemId,
        )
        if (matchIndex === -1) {
          // The claimed item can't be reconciled with the local list (e.g.
          // another tab updated statuses). Don't guess which row it was:
          // re-render from the server and keep the loop running.
          router.refresh()
        } else {
          updateItems((prev) =>
            prev.map((candidate, index) =>
              index === matchIndex
                ? {...candidate, status: item.status, error: item.error}
                : candidate,
            ),
          )
        }
        if (reason === 'offline') {
          setOffline(true)
          break
        }
      }
    } finally {
      // Every stop path (done/offline/error/stop/unmount) funnels here.
      runningRef.current = false
      activeLoopRuns.delete(runId)
      if (mountedRef.current) setLoopActive(false)
    }
  }, [runId, router])

  const stopLoop = () => {
    stopRef.current = true
    setPaused(true)
  }

  const handleRetry = () => {
    if (loopActive || retrying) return
    setRetrying(true)
    void (async () => {
      try {
        const result = await retryFailedRunItemsAction(runId)
        if (!mountedRef.current) return
        if (!result.ok) {
          setStepError(true)
          return
        }
        updateItems((prev) =>
          prev.map((item) =>
            item.status === 'failed'
              ? {...item, status: 'pending', error: null}
              : item,
          ),
        )
        setProgress((prev) => ({
          ...prev,
          pending: prev.pending + prev.failed,
          failed: 0,
        }))
        setRunStatus('in_progress')
        setPaused(false)
        setOffline(false)
        setStepError(false)
        router.refresh()
        await runLoop()
      } finally {
        if (mountedRef.current) setRetrying(false)
      }
    })()
  }

  const hasFailedItems = items.some((item) => item.status === 'failed')
  const showStartResume = !loopActive && runStatus !== 'done'

  // Stored item errors from runNextStepAction are bare kinds for model
  // failures (never the raw message — it can leak the LM Studio endpoint);
  // localize known kinds, fall back to raw text for anything else
  // ('persona missing', 'model not configured', …).
  const renderItemError = (error: string) =>
    KNOWN_ERROR_KINDS.has(error)
      ? t('itemErrorKind', {kind: error})
      : t('itemError', {message: error})

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm tabular-nums">
          {t('progress', {done: progress.done, total: progress.total})}
        </span>
        <div className="grow" />
        {showStartResume && (
          <button
            type="button"
            className="button text-sm"
            onClick={() => void runLoop()}
          >
            <IconPlayerPlay size="1.2rem" />
            {runStatus === 'pending' ? t('start') : t('resume')}
          </button>
        )}
        {loopActive && (
          <button
            type="button"
            className="button-secondary text-sm"
            onClick={stopLoop}
          >
            <IconPlayerStop size="1.2rem" /> {t('stop')}
          </button>
        )}
        {hasFailedItems && (
          <button
            type="button"
            className="button-secondary text-sm"
            onClick={handleRetry}
            disabled={loopActive || retrying}
          >
            {retrying ? (
              <IconLoader2 className="animate-spin" size="1.2rem" />
            ) : (
              <IconRefresh size="1.2rem" />
            )}
            {retrying ? t('retrying') : t('retry')}
          </button>
        )}
      </div>

      {offline && (
        <p role="alert" className="text-danger text-sm">
          {t('offline')}
        </p>
      )}
      {stepError && !offline && (
        <p role="alert" className="text-danger text-sm">
          <IconAlertTriangle size="16" className="inline-block" /> {t('error')}
        </p>
      )}
      {paused && !offline && !stepError && (
        <p className="text-muted-foreground text-sm">{t('stopped')}</p>
      )}

      <div className="card divide-y divide-zinc-200 p-2 dark:divide-zinc-700">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 px-2 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.personaName}</p>
              {item.error && (
                <p className="text-danger mt-0.5 text-xs wrap-anywhere">
                  {renderItemError(item.error)}
                </p>
              )}
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs ${RUN_STATUS_BADGE_CLASS[item.status]}`}
            >
              {t(`status.${item.status}`)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
