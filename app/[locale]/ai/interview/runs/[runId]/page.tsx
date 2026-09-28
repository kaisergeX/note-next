import {IconArrowLeft, IconDownload} from '@tabler/icons-react'
import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getLocale, getFormatter, getTranslations} from 'next-intl/server'
import MenuCustom, {type MenuCustomItem} from '~/components/ui/menu'
import RunLoop, {type RunItemView} from '~/components/ai/interview/run-loop'
import RunTranscripts, {
  type RunResultRow,
  type RunResultTurnView,
} from '~/components/ai/interview/run-transcript'
import {RUN_STATUS_BADGE_CLASS} from '~/components/ai/interview/run-status'
import {getRunById, getRunProgress, listRunItems} from '~/db/helper/runs'
import {listRunTranscripts} from '~/db/helper/transcripts'
import type {TranscriptTurn} from '~/db/schema/transcripts'
import {isShapedUuid} from '~/lib/ai/id-shape'
import {requireAuth} from '~/server-utils'

// No maxDuration here — per-call LLM time is capped by AI_REQUEST_TIMEOUT_MS.

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/ai/interview/runs/[runId]'>): Promise<Metadata> {
  const {runId} = await params
  if (!isShapedUuid(runId)) notFound()
  const t = await getTranslations('ai.interview.run')

  return {title: t('detailTitle')}
}

export default async function RunDetailPage({
  params,
}: PageProps<'/[locale]/ai/interview/runs/[runId]'>) {
  await requireAuth()
  const {runId} = await params
  if (!isShapedUuid(runId)) notFound()
  const run = await getRunById(runId)
  if (!run) notFound()

  const [items, progress] = await Promise.all([
    listRunItems(runId),
    getRunProgress(runId),
  ])
  const t = await getTranslations('ai.interview.run')
  const tExport = await getTranslations('ai.interview.export')
  const format = await getFormatter()
  // Export API routes live outside the [locale] segment, so the UI locale is
  // forwarded for the Markdown report labels.
  const locale = await getLocale()

  // Plain anchors: the API responds with Content-Disposition, so normal
  // navigation downloads the file — no fetch/Blob handling needed.
  const exportMenuItems: MenuCustomItem[] = [
    {
      type: 'link',
      url: `/api/ai/interview/export/run/${run.id}?format=md&locale=${locale}`,
      label: (
        <>
          <IconDownload size="18" /> {tExport('report')}
        </>
      ),
    },
    {
      type: 'link',
      url: `/api/ai/interview/export/run/${run.id}?format=csv&locale=${locale}`,
      label: (
        <>
          <IconDownload size="18" /> {tExport('dataCsv')}
        </>
      ),
    },
    {
      type: 'link',
      url: `/api/ai/interview/export/run/${run.id}?format=csv-wide&locale=${locale}`,
      label: (
        <>
          <IconDownload size="18" /> {tExport('comparisonCsv')}
        </>
      ),
    },
    {
      type: 'link',
      url: `/api/ai/interview/export/run/${run.id}?format=json&locale=${locale}`,
      label: (
        <>
          <IconDownload size="18" /> {tExport('backupJson')}
        </>
      ),
    },
  ]

  const created = format.dateTime(run.createdAt, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const serializedItems: RunItemView[] = items.map((item) => ({
    id: item.id,
    personaName: item.personaName,
    status: item.status,
    error: item.error,
  }))

  /**
   * Stored turns → display turns; the system turn is prompt bookkeeping, not
   * dialogue. Timestamps are formatted server-side (short time) to keep SSR and
   * client markup identical.
   */
  function formatTranscriptTurns(
    turns: TranscriptTurn[],
    formatTime: (date: Date) => string,
  ): RunResultTurnView[] {
    return turns
      .filter((turn) => turn.role !== 'system')
      .map((turn) => {
        const date = new Date(turn.timestamp)
        return {
          role: turn.role === 'user' ? 'user' : 'assistant',
          content: turn.content,
          timeLabel: Number.isNaN(date.getTime()) ? '' : formatTime(date),
        }
      })
  }

  // Read-only Q&A per persona, matched to items by personaId (transcripts are
  // created lazily on the first claimed step, so failed/pending items may have
  // none yet).
  const runTranscriptRows = await listRunTranscripts(run.id)
  const transcriptByPersona = new Map(
    runTranscriptRows.map((row) => [row.personaId, row]),
  )
  const formatTime = (date: Date) => format.dateTime(date, {timeStyle: 'short'})
  const resultRows: RunResultRow[] = items
    .filter((item) => item.status === 'done' || item.status === 'failed')
    .map((item) => {
      const transcript = transcriptByPersona.get(item.personaId)
      return {
        id: item.id,
        personaName: item.personaName,
        status: item.status,
        transcript: transcript
          ? {
              id: transcript.id,
              turns: formatTranscriptTurns(transcript.turns, formatTime),
            }
          : null,
      }
    })

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

      <div className="flex-center-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="text-2xl font-bold">{t('detailTitle')}</h1>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs ${RUN_STATUS_BADGE_CLASS[run.status]}`}
          >
            {t(`status.${run.status}`)}
          </span>
        </div>
        <MenuCustom
          className="button-secondary button-icon shrink-0 rounded-full p-1"
          itemsClassName="w-48 [--anchor-gap:0.5rem]"
          items={exportMenuItems}
        >
          <span className="sr-only">{tExport('menu')}</span>
          <IconDownload size="18" />
        </MenuCustom>
      </div>

      <p className="text-muted-foreground text-sm wrap-anywhere">
        {t('progress', {done: progress.done, total: progress.total})} ·{' '}
        {t('created', {time: created})} ·{' '}
        {t('questions', {count: run.questionScript.length})}
      </p>

      <RunLoop
        runId={run.id}
        initialStatus={run.status}
        initialProgress={progress}
        initialItems={serializedItems}
      />

      {resultRows.length > 0 && <RunTranscripts rows={resultRows} />}
    </section>
  )
}
