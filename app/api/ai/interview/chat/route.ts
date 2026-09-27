import {createUIMessageStream, createUIMessageStreamResponse} from 'ai'
import type {UIMessageChunk} from 'ai'
import {NextResponse} from 'next/server'
import {z} from 'zod'
import {getTranscriptById, appendTranscriptTurn} from '~/db/helper/transcripts'
import {getCachedUser} from '~/db/helper/users'
import {getPersonaById} from '~/db/helper/personas'
import {requireFeatureAccess, FeatureAccessError} from '~/lib/ai/feature-access'
import {ULID_SHAPE_UUID} from '~/lib/ai/id-shape'
import {
  completeStream,
  LMStudioError,
  type LMStudioMessage,
} from '~/lib/ai/lm-studio'
import {buildInterviewSystemMessage} from '~/lib/ai/persona-style'
import {defineAuthRoute} from '~/server-utils'

export const maxDuration = 60

const MAX_USER_MESSAGE_LENGTH = 8000

/**
 * The client sends its full UIMessage[] history, but the DATABASE turns are
 * the source of truth — from `messages` only the LAST user message's text is
 * extracted (server actions / other clients may have appended turns the
 * client does not know about). Text parts are joined with '\n'.
 */
const chatBodySchema = z.object({
  personaId: z.string().regex(ULID_SHAPE_UUID),
  transcriptId: z.string().regex(ULID_SHAPE_UUID),
  messages: z.array(
    z.object({
      role: z.string(),
      parts: z.array(
        z.looseObject({type: z.string(), text: z.string().optional()}),
      ),
    }),
  ),
})

function extractLastUserText(
  messages: z.infer<typeof chatBodySchema>['messages'],
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!
    if (message.role !== 'user') continue
    const text = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('\n')
      .trim()
    return text
  }
  return undefined
}

function buildLMStudioMessages(
  systemPrompt: string,
  turns: {role: string; content: string}[],
): LMStudioMessage[] {
  const messages: LMStudioMessage[] = [
    // The speech contract is appended at call time (see
    // buildInterviewSystemMessage) so every session — including ones started
    // before that change — gets the speech rules regardless of what the
    // drafting model wrote into the snapshot; the snapshot column stays as
    // authored.
    {role: 'system', content: buildInterviewSystemMessage(systemPrompt)},
  ]
  for (const turn of turns) {
    // Defensive: 'system' turns must never reach the completion as a mid-
    // conversation role — the system prompt comes solely from the snapshot.
    if (turn.role === 'system') continue
    if (turn.role === 'user' || turn.role === 'assistant') {
      messages.push({role: turn.role, content: turn.content})
    }
  }
  return messages
}

export const POST = defineAuthRoute(async ({request, session}) => {
  // Gate order (ground rule): auth → feature access → body → persona.
  const userInfo = await getCachedUser(session.user.email)
  if (!userInfo) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }
  try {
    await requireFeatureAccess(userInfo.id, 'persona-interview')
  } catch (err) {
    if (err instanceof FeatureAccessError) {
      return NextResponse.json({reason: 'no-access'}, {status: 403})
    }
    throw err
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({error: 'Invalid JSON body'}, {status: 400})
  }
  const parsed = chatBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({error: 'Invalid request body'}, {status: 400})
  }
  const {personaId, transcriptId, messages} = parsed.data

  const content = extractLastUserText(messages)
  if (!content || content.length === 0) {
    return NextResponse.json({error: 'No user message'}, {status: 400})
  }
  if (content.length > MAX_USER_MESSAGE_LENGTH) {
    return NextResponse.json({error: 'Message too long'}, {status: 400})
  }

  const persona = await getPersonaById(personaId)
  if (!persona) {
    return NextResponse.json({error: 'Persona not found'}, {status: 404})
  }
  if (!persona.systemPrompt || persona.systemPrompt.trim().length === 0) {
    return NextResponse.json({error: 'no-system-prompt'}, {status: 400})
  }

  const transcript = await getTranscriptById(transcriptId)
  if (!transcript || transcript.personaId !== personaId) {
    return NextResponse.json({error: 'Transcript not found'}, {status: 404})
  }
  if (transcript.mode !== 'single') {
    return NextResponse.json({error: 'Wrong transcript mode'}, {status: 400})
  }

  // Append-decision dedupe: the turns read above are the pre-append DB
  // state. If the last turn is an identical unanswered user turn, the
  // previous request appended it but never got an answer (offline / 500)
  // and this request is a client resend — skip the append so the resend is
  // idempotent. A user turn FOLLOWED by an assistant turn is a real
  // repeated question and must be appended normally.
  const lastTurn = transcript.turns[transcript.turns.length - 1]
  const isUnansweredDuplicate =
    lastTurn?.role === 'user' && lastTurn.content === content
  if (!isUnansweredDuplicate) {
    await appendTranscriptTurn(transcriptId, {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    })
  }

  // Fresh select AFTER the append decision — DB turns are the conversation
  // source of truth, not the client-sent history. When the append was
  // skipped, these turns already contain the duplicated question.
  const fresh = await getTranscriptById(transcriptId)
  if (!fresh) {
    return NextResponse.json({error: 'Transcript not found'}, {status: 404})
  }
  const llmMessages = buildLMStudioMessages(
    // Snapshot from session start — never persona.systemPrompt, which the
    // owner may have regenerated since the session began.
    fresh.systemPrompt,
    fresh.turns,
  )
  // transcript.model is the model id snapshotted at session start; pass it
  // through so the request runs on the session's model even if the config
  // default changed since (ARCHITECTURE.md "one config" still governs the
  // default — this is a per-call replay override).
  const assistantId = crypto.randomUUID()
  const assistantTimestamp = new Date().toISOString()

  const stream = createUIMessageStream({
    execute: async ({writer}) => {
      let started = false
      let textClosed = false
      let fullText = ''
      try {
        for await (const delta of await completeStream(llmMessages, {
          signal: request.signal,
          model: fresh.model,
        })) {
          if (!started) {
            writer.write({type: 'text-start', id: assistantId})
            started = true
          }
          fullText += delta
          writer.write({type: 'text-delta', id: assistantId, delta})
        }
        if (started) {
          writer.write({type: 'text-end', id: assistantId})
          textClosed = true
        }
        // Full clean completion only — append the assistant turn atomically.
        if (fullText.length > 0) {
          await appendTranscriptTurn(transcriptId, {
            role: 'assistant',
            content: fullText,
            timestamp: assistantTimestamp,
          })
        }
      } catch (err) {
        // Caller aborted (tab closed / navigate away): end silently, do NOT
        // persist a partial assistant turn. The lm-studio wrapper rethrows
        // the original abort error unwrapped on caller cancellation.
        if (request.signal.aborted) return

        let errorText: string
        if (
          err instanceof LMStudioError &&
          (err.kind === 'unreachable' ||
            err.kind === 'timeout' ||
            err.kind === 'auth')
        ) {
          // "Assistant offline" — client shows a localized banner.
          errorText = 'offline'
        } else {
          errorText = 'error'
        }

        if (started && !textClosed) {
          writer.write({type: 'text-end', id: assistantId})
        }
        // In-flight error part shape per the ai@7 stream protocol:
        // {"type":"error","errorText":"..."} — the stream then closes
        // normally, so no assistant turn is persisted for a partial answer.
        const errorPart: UIMessageChunk = {type: 'error', errorText}
        writer.write(errorPart)
      }
    },
  })

  return createUIMessageStreamResponse({stream})
})
