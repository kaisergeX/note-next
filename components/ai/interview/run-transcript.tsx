import {getTranslations} from 'next-intl/server'
import ChatBubble from '~/components/ai/interview/chat-bubble'
import {RUN_STATUS_BADGE_CLASS} from '~/components/ai/interview/run-status'
import type {RunItemStatus} from '~/db/schema/transcripts'

export type RunResultTurnView = {
  role: 'user' | 'assistant'
  content: string
  /** Server-formatted short-time label; empty when the timestamp is unparsable. */
  timeLabel: string
}

export type RunResultRow = {
  id: string
  personaName: string
  status: RunItemStatus
  /** Null when the item has no transcript yet (failed before one was created). */
  transcript: {
    id: string
    turns: RunResultTurnView[]
  } | null
}

type RunTranscriptsProps = {
  rows: RunResultRow[]
}

/**
 * Read-only per-persona Q&A under the run item list. The user turn is the
 * researcher's question, the assistant turn is the persona's answer — rendered
 * through the shared chat bubble so they read the same as the live chat.
 * Collapsible via native <details>, like persona form.
 */
export default async function RunTranscripts({rows}: RunTranscriptsProps) {
  const t = await getTranslations('ai.interview.run')

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">{t('results')}</h2>
      <div className="card divide-y divide-zinc-200 p-2 dark:divide-zinc-700">
        {rows.map((row) => (
          <details key={row.id} className="px-2 py-2">
            <summary className="flex cursor-pointer items-center gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {row.personaName}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs ${RUN_STATUS_BADGE_CLASS[row.status]}`}
              >
                {t(`status.${row.status}`)}
              </span>
            </summary>
            <div className="mt-3">
              {row.transcript ? (
                <div className="flex flex-col gap-3">
                  {row.transcript.turns.map((turn, index) => (
                    <div
                      key={index}
                      className={
                        turn.role === 'user'
                          ? 'flex flex-col items-end'
                          : 'flex flex-col items-start'
                      }
                    >
                      {turn.role !== 'user' && (
                        <span className="text-muted-foreground mb-0.5 text-xs wrap-anywhere">
                          {row.personaName}
                        </span>
                      )}
                      <ChatBubble variant={turn.role}>
                        {turn.content}
                      </ChatBubble>
                      {turn.timeLabel && (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {turn.timeLabel}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t('noTranscript')}
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
