'use client'

import {IconArrowDown, IconRefresh} from '@tabler/icons-react'
import {useChat} from '@ai-sdk/react'
import {APICallError, DefaultChatTransport, type UIMessage} from 'ai'
import {useTranslations} from 'next-intl'
import {useEffect, useMemo, useRef, useState} from 'react'
import ChatInput from '~/components/ai/interview/chat-input'
import ChatMessages from '~/components/ai/interview/chat-messages'

type PersonaChatProps = {
  personaId: string
  transcriptId: string
  personaName: string
  initialMessages: UIMessage[]
  /** Fires when an assistant reply finishes streaming (success or abort). */
  onAssistantFinished?: () => void
}

/** Distance (px) from the bottom edge that still counts as "at the bottom". */
const AT_BOTTOM_THRESHOLD_PX = 80

/**
 * The backend writes two failure surfaces the UI must tell apart:
 * - In-stream error part with errorText 'offline' → AI SDK surfaces it as an
 *   `Error` whose message is exactly the errorText (processUIMessageStream
 *   does `onError(new Error(chunk.errorText))`) → the offline banner.
 * - Non-stream HTTP failures (401/403 no-access, 400/404) → an APICallError
 *   carrying the raw status code → the no-access banner for 401/403, generic
 *   otherwise. Keep the 'offline' sentinel in sync with the chat route.
 */
export default function PersonaChat({
  personaId,
  transcriptId,
  personaName,
  initialMessages,
  onAssistantFinished,
}: PersonaChatProps) {
  const t = useTranslations('ai.interview.chat')
  const [input, setInput] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/interview/chat',
        body: {personaId, transcriptId},
      }),
    [personaId, transcriptId],
  )

  // Finish times for live assistant messages, keyed by message id. History
  // messages carry createdAt in their metadata instead.
  const [liveTimes, setLiveTimes] = useState<Map<string, string>>(new Map())

  const {messages, sendMessage, regenerate, stop, status, error} = useChat({
    id: transcriptId,
    messages: initialMessages,
    transport,
    // onFinish also fires on abort/error/disconnect; only a successful
    // assistant reply gets a finish timestamp.
    onFinish: ({message, isAbort, isDisconnect, isError}) => {
      if (
        message.role === 'assistant' &&
        !isAbort &&
        !isDisconnect &&
        !isError
      ) {
        setLiveTimes((prev) => {
          const next = new Map(prev)
          next.set(message.id, new Date().toISOString())
          return next
        })
      }
      onAssistantFinished?.()
    },
  })

  const isBusy = status === 'submitted' || status === 'streaming'

  // Regenerate is offered under the newest assistant reply once streaming
  // has settled; while busy the row hides.
  const lastMessage = messages[messages.length - 1]
  const canRegenerate =
    status === 'ready' &&
    messages.length > 0 &&
    lastMessage?.role === 'assistant'
  const isOffline = error?.message === 'offline'
  const isNoAccess =
    APICallError.isInstance(error) &&
    (error.statusCode === 401 || error.statusCode === 403)

  // A retry only makes sense when a user turn exists to regenerate from.
  const canRetry = messages.some((message) => message.role === 'user')

  /**
   * Typing bubble covers the "nothing streamed yet" window: the whole
   * submitted phase, plus the streaming phase until the last assistant
   * message owns its first non-empty text delta.
   */
  const lastAssistantMessage = messages.findLast(
    (message) => message.role === 'assistant',
  )
  const showTyping =
    status === 'submitted' ||
    (status === 'streaming' &&
      (!lastAssistantMessage ||
        !lastAssistantMessage.parts.some(
          (part) => part.type === 'text' && part.text.trim().length > 0,
        )))

  // Stick-to-bottom: only auto-scroll when the user hasn't scrolled away, so
  // reading history mid-stream is not hijacked. Instant jump per update (no
  // per-token smooth jitter); the mount pass doubles as the history scroll.
  useEffect(() => {
    if (!isAtBottom) return
    const container = containerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [messages, status, isAtBottom])

  const handleScroll = () => {
    const container = containerRef.current
    if (!container) return
    setIsAtBottom(
      container.scrollHeight - container.scrollTop - container.clientHeight <
        AT_BOTTOM_THRESHOLD_PX,
    )
  }

  const handleJumpToBottom = () => {
    const container = containerRef.current
    if (!container) return
    container.scrollTo({top: container.scrollHeight, behavior: 'smooth'})
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text || isBusy) return
    setInput('')
    void sendMessage({
      text,
      metadata: {createdAt: new Date().toISOString()},
    })
  }

  const handleRetry = () => {
    void regenerate()
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="relative flex min-h-0 grow flex-col overflow-y-auto px-4"
    >
      {error && (
        <p
          role="alert"
          className="text-danger sticky top-0 z-10 flex items-start gap-2 text-sm"
        >
          <span className="wrap-anywhere">
            {isOffline
              ? t('offline')
              : isNoAccess
                ? t('noAccessError')
                : t('genericError')}
          </span>
          {canRetry && (
            <button
              type="button"
              onClick={handleRetry}
              className="text-danger inline-flex shrink-0 items-center gap-1 self-start rounded-md border border-red-400/70 px-2 py-1 text-xs transition-colors hover:bg-red-500/10 dark:border-red-400/50"
            >
              <IconRefresh size="14" /> {t('retry')}
            </button>
          )}
        </p>
      )}

      <ChatMessages
        messages={messages}
        personaName={personaName}
        isBusy={isBusy}
        showTyping={showTyping}
        emptyStateLabel={t('emptyState')}
        liveTimeMap={liveTimes}
        canRegenerate={canRegenerate}
        onRegenerate={handleRetry}
      />

      <div className="sticky bottom-0 z-10">
        {!isAtBottom && (
          <button
            type="button"
            aria-label={t('scrollToBottom')}
            onClick={handleJumpToBottom}
            className="bg-default absolute right-4 bottom-full mb-2 flex size-9 items-center justify-center rounded-full border border-zinc-300 shadow-sm dark:border-zinc-600"
          >
            <IconArrowDown size="18" />
          </button>
        )}
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          isBusy={isBusy}
          onStop={() => stop()}
          maxLengthHint={8000}
        />
      </div>
    </div>
  )
}
