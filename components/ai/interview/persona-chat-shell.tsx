'use client'

import {useDisclosure} from '@kaiverse/k/hooks'
import {Dialog} from '@kaiverse/k/ui'
import {IconArrowLeft, IconInfoCircle, IconMenu2} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'
import {generateSessionTitleAction} from '~/app/[locale]/ai/interview/actions'
import SessionRow from '~/components/ai/interview/session-row'
import StartInterviewButton from '~/components/ai/interview/start-interview-button'

export type ChatSessionSummary = {
  id: string
  title: string | null
  /** Server-formatted "medium date, short time" label (locale-aware). */
  dateLabel: string
  /** First user turn, truncated server-side. */
  preview: string
  /** Set on batch-run transcript rows (group mode) — read-only, run-owned. */
  isRun?: boolean
  /** The owning run id for run rows; used to link to the run detail page. */
  runId?: string | null
}

type PersonaChatShellProps = {
  personaId: string
  personaName: string
  sessions: ChatSessionSummary[]
  /** Batch-run sessions, listed read-only under the single sessions. */
  runSessions?: ChatSessionSummary[]
  activeId: string | null
  /** The chat area for the active session (a PersonaChat element), if any. */
  children?: ReactNode
}

/**
 * Two-pane chat layout: session sidebar (desktop-fixed, mobile drawer) plus
 * the active chat area. Also owns the auto-title trigger: on every assistant
 * finish it asks the server for a title; the action no-ops when one already
 * exists or the session has too few turns, so this stays cheap and silent.
 */
export default function PersonaChatShell({
  personaId,
  personaName,
  sessions,
  runSessions = [],
  activeId,
  children,
}: PersonaChatShellProps) {
  const t = useTranslations('ai.interview.chat')
  const router = useRouter()
  const [sidebarOpen, {open: openSidebar, close: closeSidebar}] =
    useDisclosure()

  const activeSession = sessions.find((session) => session.id === activeId)

  /**
   * Auto-title trigger, run on every assistant finish. The server action
   * no-ops (no LLM) when a title exists or the session has too few turns;
   * the sidebar also short-circuits here when the active session is already
   * named, so refreshes only happen when a title actually came back.
   * Offline/failed generation stays silent — never a chat error.
   */
  const handleAssistantFinished = () => {
    if (!activeId || activeSession?.title) return
    void (async () => {
      try {
        const result = await generateSessionTitleAction(activeId)
        if (result.ok && result.data.title) router.refresh()
      } catch {
        // The sidebar simply keeps the preview fallback.
      }
    })()
  }

  // The page hands us the PersonaChat element; the onFinish callback lives
  // inside it, so thread the auto-title hook through here.
  const chatArea =
    activeId && children
      ? isValidElement(children)
        ? cloneElement(
            children as ReactElement<{onAssistantFinished?: () => void}>,
            {onAssistantFinished: handleAssistantFinished},
          )
        : children
      : null

  const renderSidebarContent = (onClose?: () => void) => (
    <>
      <div className="items-start justify-between gap-2 p-4 max-sm:flex">
        <Link href="/ai/interview" className="inline-flex items-center gap-1">
          <IconArrowLeft className="inline-block" size="18" />{' '}
          {t('backToRoster')}
        </Link>
        <p className="mt-4">
          <Link
            className="inline-flex items-center gap-1 wrap-anywhere"
            href={`/ai/interview/${personaId}`}
            title={t('viewPersona')}
          >
            <span className="text-lg font-bold">{personaName}</span>{' '}
            <IconInfoCircle size="18" />
          </Link>
        </p>
        {onClose && (
          <Dialog.CloseButton
            className="button-secondary px-1.5 py-1 [&>svg]:size-4.5"
            aria-label={t('sidebarToggle')}
          />
        )}
      </div>

      <div className="px-4 pb-4">
        <StartInterviewButton personaId={personaId} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {runSessions.length > 0 && (
          <details className="mb-4">
            {/* Collapsed by default: run sessions are read-only results, the
                active work (single sessions) stays at the top of the list. */}
            <summary className="text-muted-foreground flex cursor-pointer items-center gap-1.5 px-2 pb-2 text-xs font-semibold tracking-wide uppercase">
              {t('runSessions')}
              <span className="tabular-nums">({runSessions.length})</span>
            </summary>
            <ul className="space-y-1">
              {runSessions.map((session) =>
                session.runId ? (
                  <li key={session.id}>
                    {/* Read-only: links to the run detail (which shows the
                        Q&A); no kebab menu — group transcripts are run-owned
                        and guarded against rename/delete. */}
                    <Link
                      href={`/ai/interview/runs/${session.runId}`}
                      className="block rounded-md px-2 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={onClose}
                    >
                      <p className="flex items-center gap-1.5">
                        <span className="min-w-0 truncate text-sm font-medium">
                          {session.preview || session.dateLabel}
                        </span>
                        <span className="text-muted-foreground shrink-0 rounded-full border border-zinc-400 px-1.5 py-0.5 text-[10px] dark:border-zinc-600">
                          {t('runBadge')}
                        </span>
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {session.dateLabel}
                      </p>
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          </details>
        )}

        <h2 className="text-muted-foreground px-2 pb-2 text-xs font-semibold tracking-wide uppercase">
          {t('sessions')}
        </h2>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground px-2 text-sm">
            {t('sessionsEmpty')}
          </p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((session) => (
              <li key={session.id}>
                <SessionRow
                  personaId={personaId}
                  session={session}
                  isActive={session.id === activeId}
                  onSessionNavigate={onClose}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )

  return (
    <div className="flex min-h-0 w-full grow gap-4">
      <aside className="hidden max-w-md min-w-0 shrink-0 flex-col border-r border-zinc-200 sm:basis-1/4 md:flex dark:border-zinc-700">
        {renderSidebarContent()}
      </aside>

      <div className="flex min-w-0 grow flex-col">
        <div className="flex items-center gap-2 border-b border-zinc-200 p-3 md:hidden dark:border-zinc-700">
          <button
            type="button"
            className="button-secondary px-2 py-1 md:hidden"
            aria-label={t('sidebarToggle')}
            aria-expanded={sidebarOpen}
            onClick={openSidebar}
          >
            <IconMenu2 size="18" />
          </button>
          <p className="truncate text-sm font-semibold">{personaName}</p>
        </div>

        {chatArea ?? (
          <div className="flex-center min-h-[50vh] flex-1 flex-col p-8 text-center">
            <p className="text-muted-foreground max-w-md text-sm">
              {t('emptyState')}
            </p>
            <div className="mt-4">
              <StartInterviewButton personaId={personaId} />
            </div>
          </div>
        )}
      </div>

      <Dialog
        className="bg-default max-w-[85vw] border-r border-zinc-200 shadow-lg md:w-sm dark:border-zinc-700"
        open={sidebarOpen}
        onClose={closeSidebar}
        variant="drawer"
        position="left"
      >
        <Dialog.Content className="flex flex-col p-0">
          {renderSidebarContent(closeSidebar)}
        </Dialog.Content>
      </Dialog>
    </div>
  )
}
