import type {UIMessage} from 'ai'
import type {Metadata} from 'next'
import type {ReactNode} from 'react'
import {getFormatter, getTranslations} from 'next-intl/server'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import PersonaChat from '~/components/ai/interview/persona-chat'
import PersonaChatShell, {
  type ChatSessionSummary,
} from '~/components/ai/interview/persona-chat-shell'
import {getPersonaById} from '~/db/helper/personas'
import {
  getTranscriptById,
  listRunSessionsByPersona,
  listSingleTranscriptsByPersona,
} from '~/db/helper/transcripts'
import type {Transcript, TranscriptTurn} from '~/db/schema/transcripts'
import {isShapedUuid} from '~/lib/ai/id-shape'
import {requireAuth} from '~/server-utils'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/ai/interview/[id]/chat'>): Promise<Metadata> {
  const {id} = await params
  if (!isShapedUuid(id)) notFound()
  const persona = await getPersonaById(id)
  const t = await getTranslations('ai.interview.chat')

  return {
    title: persona ? `${persona.name} – ${t('title')}` : t('title'),
  }
}

const PREVIEW_MAX_LENGTH = 80

/** Stored turns → chat UI messages; the system turn is prompt bookkeeping, not dialogue. */
function turnsToUIMessages(turns: TranscriptTurn[]): UIMessage[] {
  return turns
    .filter((turn) => turn.role !== 'system')
    .map((turn, index) => ({
      id: `turn-${index}`,
      role: turn.role,
      parts: [{type: 'text', text: turn.content}],
    }))
}

/** First user turn, truncated for the sidebar fallback title. */
function sessionPreview(transcript: Transcript): string {
  const firstUserTurn =
    transcript.turns.find((turn) => turn.role === 'user')?.content ?? ''
  return firstUserTurn.length > PREVIEW_MAX_LENGTH
    ? `${firstUserTurn.slice(0, PREVIEW_MAX_LENGTH)}…`
    : firstUserTurn
}

function serializeSessions(
  transcripts: Transcript[],
  formatDateTime: (date: Date) => string,
): ChatSessionSummary[] {
  return transcripts.map((transcript) => ({
    id: transcript.id,
    title: transcript.title,
    dateLabel: formatDateTime(transcript.createdAt),
    preview: sessionPreview(transcript),
  }))
}

/**
 * Batch-run transcripts, marked read-only: the sidebar links to the run
 * detail page (which shows the Q&A), never to a chat — group transcripts
 * have no single-chat session.
 */
function serializeRunSessions(
  transcripts: Transcript[],
  formatDateTime: (date: Date) => string,
): ChatSessionSummary[] {
  return transcripts.map((transcript) => ({
    id: transcript.id,
    title: transcript.title,
    dateLabel: formatDateTime(transcript.createdAt),
    preview: sessionPreview(transcript),
    isRun: true,
    runId: transcript.runId,
  }))
}

export default async function PersonaChatPage({
  params,
  searchParams,
}: PageProps<'/[locale]/ai/interview/[id]/chat'>) {
  await requireAuth()
  const {id} = await params
  const {t: requestedTranscriptId} = await searchParams
  if (!isShapedUuid(id)) notFound()
  const persona = await getPersonaById(id)
  if (!persona) notFound()

  const t = await getTranslations('ai.interview.chat')
  const format = await getFormatter()

  // A persona without a system prompt has nothing to interview against; the
  // researcher must generate one on the edit page first.
  if (!persona.systemPrompt) {
    return (
      <section className="container mx-auto space-y-4 p-4">
        <div>
          <h2 className="text-xl font-bold wrap-anywhere">
            {persona.name}
            <span className="text-muted-foreground text-sm">
              {' '}
              · {t('title')}
            </span>
          </h2>
        </div>
        <p role="alert" className="text-danger text-sm">
          {t('blockedTitle')}
        </p>
        <p className="text-muted-foreground text-sm">{t('blockedHint')}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/ai/interview"
            className="inline-flex items-center gap-1 text-sm"
          >
            {t('backToRoster')}
          </Link>
          <Link
            href={`/ai/interview/${persona.id}`}
            className="button-secondary w-fit text-sm"
          >
            {t('viewPersona')}
          </Link>
        </div>
      </section>
    )
  }

  const sessions = serializeSessions(
    await listSingleTranscriptsByPersona(persona.id),
    // Medium date + short time, matching the old picker's label format.
    (date) => format.dateTime(date, {dateStyle: 'medium', timeStyle: 'short'}),
  )
  const runSessions = serializeRunSessions(
    await listRunSessionsByPersona(persona.id),
    (date) => format.dateTime(date, {dateStyle: 'medium', timeStyle: 'short'}),
  )

  // ?t=<transcriptId> → resume that session. A transcript that doesn't exist
  // or belongs to another persona is a bad URL, not an error UI.
  let activeId: string | null = null
  let chatArea: ReactNode = null
  if (typeof requestedTranscriptId === 'string' && requestedTranscriptId) {
    if (!isShapedUuid(requestedTranscriptId)) notFound()
    const transcript = await getTranscriptById(requestedTranscriptId)
    if (
      !transcript ||
      transcript.personaId !== persona.id ||
      transcript.mode !== 'single'
    )
      notFound()
    activeId = transcript.id
    chatArea = (
      <PersonaChat
        personaId={persona.id}
        transcriptId={transcript.id}
        personaName={persona.name}
        initialMessages={turnsToUIMessages(transcript.turns)}
      />
    )
  }

  // No ?t= → picker state: the shell's sidebar doubles as the session list,
  // the chat area shows the empty state. The old standalone picker page is
  // replaced by this shell layout.
  return (
    <PersonaChatShell
      personaId={persona.id}
      personaName={persona.name}
      sessions={sessions}
      runSessions={runSessions}
      activeId={activeId}
    >
      {chatArea}
    </PersonaChatShell>
  )
}
