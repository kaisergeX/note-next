import {IconArrowLeft} from '@tabler/icons-react'
import type {UIMessage} from 'ai'
import type {Metadata} from 'next'
import {getFormatter, getTranslations} from 'next-intl/server'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import PersonaChat from '~/components/ai/interview/persona-chat'
import StartInterviewButton from '~/components/ai/interview/start-interview-button'
import {getPersonaById} from '~/db/helper/personas'
import {
  getTranscriptById,
  listSingleTranscriptsByPersona,
} from '~/db/helper/transcripts'
import type {TranscriptTurn} from '~/db/schema/transcripts'
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

  // A persona without a system prompt has nothing to interview against; the
  // researcher must generate one on the edit page first.
  if (!persona.systemPrompt) {
    return (
      <section className="w-full max-w-6xl space-y-4 p-4">
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

  const transcripts = await listSingleTranscriptsByPersona(persona.id)

  // No ?t= → session picker for this persona.
  if (typeof requestedTranscriptId !== 'string' || !requestedTranscriptId) {
    const format = await getFormatter()

    return (
      <section className="w-full max-w-6xl space-y-4 p-4">
        <div className="flex-center-between gap-2">
          <Link href="/ai/interview" className="inline-flex items-center gap-1">
            <IconArrowLeft className="inline-block" size="18" />{' '}
            {t('backToRoster')}
          </Link>
          <h2 className="text-xl font-bold wrap-anywhere">{t('title')}</h2>

          <Link
            href={`/ai/interview/${persona.id}`}
            className="inline-flex items-center gap-1 text-sm"
          >
            {t('viewPersona')}
          </Link>
        </div>
        <p className="wrap-anywhere">
          <span className="text-xl font-semibold">{persona.name}</span>
        </p>

        <div>
          <StartInterviewButton personaId={persona.id} />
        </div>

        <h3 className="font-semibold">{t('sessions')}</h3>
        {transcripts.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('sessionsEmpty')}</p>
        ) : (
          <ul className="space-y-2 pb-16">
            {transcripts.map((transcript) => {
              const preview = transcript.turns.find(
                (turn) => turn.role === 'user',
              )?.content

              return (
                <li key={transcript.id}>
                  <Link
                    href={`/ai/interview/${persona.id}/chat?t=${transcript.id}`}
                    className="card block p-4"
                  >
                    <p className="text-sm font-medium">
                      {format.dateTime(transcript.createdAt, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      {preview ?? t('emptyState')}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    )
  }

  // ?t=<transcriptId> → resume that session. A transcript that doesn't exist
  // or belongs to another persona is a bad URL, not an error UI.
  if (!isShapedUuid(requestedTranscriptId)) notFound()
  const transcript = await getTranscriptById(requestedTranscriptId)
  if (!transcript || transcript.personaId !== persona.id) notFound()

  return (
    <section className="w-full max-w-6xl space-y-4 p-4">
      <div className="flex-center-between gap-2">
        <Link href="/ai/interview" className="inline-flex items-center gap-1">
          <IconArrowLeft className="inline-block" size="18" />{' '}
          {t('backToRoster')}
        </Link>
        <h2 className="grow text-xl font-bold wrap-anywhere">
          {persona.name}
          <span className="text-muted-foreground text-sm"> · {t('title')}</span>
        </h2>

        <Link
          href={`/ai/interview/${persona.id}`}
          className="inline-flex items-center gap-1 text-sm"
        >
          {t('viewPersona')}
        </Link>
      </div>
      <PersonaChat
        personaId={persona.id}
        transcriptId={transcript.id}
        personaName={persona.name}
        initialMessages={turnsToUIMessages(transcript.turns)}
      />
    </section>
  )
}
