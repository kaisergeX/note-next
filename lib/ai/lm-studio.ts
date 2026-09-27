import 'server-only'

import {createOpenAICompatible} from '@ai-sdk/openai-compatible'
import {
  APICallError,
  generateText,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  streamText,
} from 'ai'
import type {z} from 'zod'
import {
  AI_REQUEST_TIMEOUT_MS,
  AI_SAMPLER,
  LM_STUDIO_API_KEY,
  LM_STUDIO_ENDPOINT,
  LM_STUDIO_MODEL,
} from '~/config/ai'

export type LMStudioRole = 'system' | 'user' | 'assistant'
export type LMStudioMessage = {role: LMStudioRole; content: string}

/**
 * Typed failures so the UI can later distinguish "assistant offline"
 * (unreachable / timeout) from a bug (auth / http). Health-check logic
 * itself is deferred — this error surface is the hook point.
 */
export type LMStudioErrorKind = 'unreachable' | 'auth' | 'timeout' | 'http'
export class LMStudioError extends Error {
  constructor(
    public readonly kind: LMStudioErrorKind,
    message: string,
    public readonly status?: number, // HTTP status when kind is 'auth' | 'http'
    options?: {cause?: unknown},
  ) {
    super(message, options)
    this.name = 'LMStudioError'
  }
}

type CompleteOptions = {
  timeoutMs?: number
  signal?: AbortSignal
  model?: string
  /**
   * Per-call sampler override. The default stays the pinned AI_SAMPLER
   * temperature; the override exists for utility tasks (verbatim extraction)
   * where near-greedy decoding prevents tokenizer artifacts under long copies.
   */
  temperature?: number
}

const PROVIDER_NAME = 'lmstudio'
const lmStudio = createOpenAICompatible({
  name: PROVIDER_NAME,
  baseURL: LM_STUDIO_ENDPOINT, // already includes /v1
  apiKey: LM_STUDIO_API_KEY || undefined, // no Authorization header when key empty
  // LM Studio supports response_format json_schema on /v1/chat/completions
  supportsStructuredOutputs: true,
})

/**
 * Composes a per-call abort signal (own timeout + caller signal) and the
 * shared generation settings. Never spread AI_SAMPLER: top_p/top_k are null
 * there and the API needs their "disabled" forms (top_p: 1, top_k: 0).
 * maxRetries: 0 — the wrapper owns retry policy (none); SDK retries would
 * distort error mapping and hammer the single-slot LM Studio queue.
 */
function buildGenerationOptions(
  messages: LMStudioMessage[],
  opts?: CompleteOptions,
) {
  const signal = buildSignal(opts)
  // ai@7 rejects system-role messages inside `messages` (standardize-prompt
  // guard: "!allowSystemInMessages && messages.some(...role === 'system')").
  // The sanctioned path is the `instructions` option, which the SDK converts
  // back into a leading system message for the provider. Extract all system
  // contents (order preserved, joined with a blank line); user/assistant
  // messages pass through untouched. With no system message the built options
  // are identical to the plain passthrough.
  const systemParts: string[] = []
  const chatMessages: LMStudioMessage[] = []
  for (const message of messages) {
    if (message.role === 'system') systemParts.push(message.content)
    else chatMessages.push(message)
  }
  return {
    options: {
      model: lmStudio(opts?.model ?? LM_STUDIO_MODEL),
      ...(systemParts.length > 0
        ? {instructions: systemParts.join('\n\n')}
        : {}),
      messages: chatMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      temperature: opts?.temperature ?? AI_SAMPLER.temperature,
      topP: 1,
      // Custom fields are passed straight into the request body root by the
      // openai-compatible provider. top_k: 0 must ride along here: the standardized
      // topK is unsupported for chat models (setting it only triggers an SDK
      // warning and is dropped), and omitting it entirely would let llama.cpp's
      // default top_k 40 apply.
      providerOptions: {
        [PROVIDER_NAME]: {
          min_p: AI_SAMPLER.min_p,
          enable_thinking: false,
          top_k: 0,
        },
      },
      maxRetries: 0,
      abortSignal: signal,
    },
    signal,
  }
}

function buildSignal(opts?: CompleteOptions): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(
    opts?.timeoutMs ?? AI_REQUEST_TIMEOUT_MS,
  )
  if (!opts?.signal) return timeoutSignal
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([timeoutSignal, opts.signal])
  }
  // Manual composition fallback: caller signal must stay wired even when
  // AbortSignal.any is unavailable, or caller cancellation would be lost.
  // An already-aborted caller signal never fires 'abort', so exit early.
  const callerSignal = opts.signal
  if (callerSignal.aborted) {
    const controller = new AbortController()
    controller.abort(callerSignal.reason)
    return controller.signal
  }
  const controller = new AbortController()
  const onCallerAbort = () => controller.abort(callerSignal.reason)
  const onTimeoutAbort = () => {
    callerSignal.removeEventListener('abort', onCallerAbort)
    controller.abort(timeoutSignal.reason)
  }
  callerSignal.addEventListener('abort', onCallerAbort, {once: true})
  timeoutSignal.addEventListener('abort', onTimeoutAbort, {once: true})
  return controller.signal
}

function isAbortName(value: unknown): boolean {
  if (!(value instanceof Object)) return false
  const name = (value as {name?: unknown}).name
  return name === 'AbortError' || name === 'TimeoutError'
}

/** DOMException or plain {name} — one level of cause inspection. */
function isAbortLike(err: unknown): boolean {
  return (
    isAbortName(err) || isAbortName((err as {cause?: unknown} | null)?.cause)
  )
}

const NETWORK_ERROR_PATTERN =
  /fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET|socket hang up|network/i

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true
  if (err instanceof Error && NETWORK_ERROR_PATTERN.test(err.message)) {
    return true
  }
  const cause = (err as {cause?: unknown} | null)?.cause
  return cause instanceof Error && NETWORK_ERROR_PATTERN.test(cause.message)
}

function getStatus(err: unknown): number | undefined {
  if (APICallError.isInstance(err)) {
    const status = (err as {statusCode?: unknown}).statusCode
    if (typeof status === 'number') return status
  }
  const status = (err as {statusCode?: unknown} | null)?.statusCode
  return typeof status === 'number' ? status : undefined
}

/**
 * Deterministic error mapping. `signal` is the per-call composed signal,
 * threaded in so no shared mutable state is needed.
 */
function mapError(
  err: unknown,
  opts?: CompleteOptions,
  signal?: AbortSignal,
): never {
  // 1. Caller cancellation — rethrow the ORIGINAL error unwrapped.
  if (opts?.signal?.aborted) throw err

  // 2. Our own timeout fired (composed aborted, caller's didn't), or an
  //    SDK-wrapped abort slipped through.
  if (signal?.aborted || isAbortLike(err)) {
    throw new LMStudioError(
      'timeout',
      'LM Studio request timed out or was aborted',
      undefined,
      {cause: err},
    )
  }

  // 3. Structured-output failure: the model answered but the payload didn't
  //    validate against the JSON schema (completeJson). Covers both the
  //    generateText output path (NoOutputGeneratedError — no structured
  //    output available on the result) and NoObjectGeneratedError.
  if (
    NoObjectGeneratedError.isInstance(err) ||
    NoOutputGeneratedError.isInstance(err)
  ) {
    throw new LMStudioError('http', 'invalid structured output', undefined, {
      cause: err,
    })
  }

  // 4. HTTP status: 401/403 auth, anything else http.
  const status = getStatus(err)
  if (status !== undefined) {
    if (status === 401 || status === 403) {
      throw new LMStudioError(
        'auth',
        `LM Studio rejected credentials (HTTP ${status})`,
        status,
        {cause: err},
      )
    }
    throw new LMStudioError(
      'http',
      `LM Studio responded with HTTP ${status}`,
      status,
      {cause: err},
    )
  }

  // 5. Connection-level failure.
  if (isNetworkError(err)) {
    throw new LMStudioError(
      'unreachable',
      'LM Studio is unreachable',
      undefined,
      {
        cause: err,
      },
    )
  }

  // 6. Fallback.
  throw new LMStudioError('http', 'unexpected LM Studio failure', undefined, {
    cause: err,
  })
}

export async function complete(
  messages: LMStudioMessage[],
  opts?: CompleteOptions,
): Promise<string> {
  const {options, signal} = buildGenerationOptions(messages, opts)
  try {
    const {text} = await generateText(options)
    if (text.length === 0) {
      throw new LMStudioError('http', 'empty completion')
    }
    return text
  } catch (err) {
    if (err instanceof LMStudioError) throw err
    throw mapError(err, opts, signal)
  }
}

/** Structured (JSON-schema) completion. Uses the same sampler/ground-rule settings as complete(). */
export async function completeJson<S extends z.ZodType>(
  messages: LMStudioMessage[],
  schema: S,
  opts?: CompleteOptions,
): Promise<z.infer<S>> {
  const {options, signal} = buildGenerationOptions(messages, opts)
  try {
    const {output} = await generateText({
      ...options,
      output: Output.object({schema}),
      // allowSystemInMessages removed: buildGenerationOptions never leaves a
      // system-role message in `messages`, so the standardize-prompt guard
      // (`!allowSystemInMessages && messages.some(...role === 'system')`) can
      // never fire and the flag is dead weight.
    })
    return output as z.infer<S>
  } catch (err) {
    if (err instanceof LMStudioError) throw err
    throw mapError(err, opts, signal)
  }
}

/**
 * Non-streaming counterpoint above; this one streams. streamText starts the
 * request EAGERLY at call time (buffered internally), so the HTTP request is
 * already in flight when this function returns. Errors surface during
 * iteration: ai@7 enqueues error parts into the stream and closes it, so we
 * iterate fullStream, throw on error parts, and map them — the caller sees
 * an LMStudioError on its first `next()` rather than a silently empty stream.
 */
export async function completeStream(
  messages: LMStudioMessage[],
  opts?: CompleteOptions,
): Promise<AsyncIterable<string>> {
  const {options, signal} = buildGenerationOptions(messages, opts)
  const result = streamText(options)

  async function* contentStream(): AsyncGenerator<string> {
    try {
      for await (const part of result.fullStream) {
        if (part.type === 'error') throw part.error
        if (part.type === 'abort') {
          const abortError =
            (part as {error?: unknown}).error ?? new Error('stream aborted')
          throw abortError
        }
        if (part.type === 'text-delta' && part.text.length > 0) yield part.text
      }
    } catch (err) {
      throw mapError(err, opts, signal)
    }
  }

  return contentStream()
}
