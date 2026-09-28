'use client'

import {IconPlayerStop, IconSend} from '@tabler/icons-react'
import {useChat} from '@ai-sdk/react'
import {APICallError, DefaultChatTransport, type UIMessage} from 'ai'
import {useTranslations} from 'next-intl'
import {useEffect, useMemo, useRef, useState} from 'react'

type PersonaChatProps = {
  personaId: string
  transcriptId: string
  personaName: string
  initialMessages: UIMessage[]
  /** Fires when an assistant reply finishes streaming (success or abort). */
  onAssistantFinished?: () => void
}

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
  const bottomRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/interview/chat',
        body: {personaId, transcriptId},
      }),
    [personaId, transcriptId],
  )

  const {messages, sendMessage, stop, status, error} = useChat({
    id: transcriptId,
    messages: initialMessages,
    transport,
    onFinish: () => onAssistantFinished?.(),
  })

  const isBusy = status === 'submitted' || status === 'streaming'
  const isOffline = error?.message === 'offline'
  const isNoAccess =
    APICallError.isInstance(error) &&
    (error.statusCode === 401 || error.statusCode === 403)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({block: 'end'})
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isBusy) return
    setInput('')
    void sendMessage({text})
  }

  return (
    <div className="relative flex min-h-0 grow flex-col overflow-y-auto px-4">
      {error && (
        <p role="alert" className="text-danger sticky top-0 z-10 text-sm">
          {isOffline
            ? t('offline')
            : isNoAccess
              ? t('noAccessError')
              : t('genericError')}
        </p>
      )}

      <div className="container mx-auto flex grow flex-col gap-3 py-4">
        {messages.length === 0 && (
          <p className="text-muted-foreground h-full content-center text-center text-sm">
            {t('emptyState')}
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === 'user'
                ? 'flex flex-col items-end'
                : 'flex flex-col items-start'
            }
          >
            {message.role !== 'user' && (
              <span className="text-muted-foreground mb-0.5 text-xs wrap-anywhere">
                {personaName}
              </span>
            )}
            <div
              className={
                message.role === 'user'
                  ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-900 px-3 py-2 text-sm whitespace-pre-wrap text-white dark:bg-zinc-200 dark:text-black'
                  : 'max-w-[85%] rounded-2xl rounded-bl-sm border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm whitespace-pre-wrap dark:border-zinc-700 dark:bg-zinc-900'
              }
            >
              {message.parts
                .filter((part) => part.type === 'text')
                .map((part, index) => (
                  <p key={index}>{part.text}</p>
                ))}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className="bg-default sticky bottom-0 z-10 container mx-auto flex items-end gap-2 py-4"
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
      >
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder={t('inputPlaceholder')}
          className="w-full flex-1 resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          disabled={isBusy}
        />
        {isBusy ? (
          <button
            type="button"
            className="button-secondary"
            onClick={() => stop()}
          >
            <IconPlayerStop size="18" /> {t('stop')}
          </button>
        ) : (
          <button type="submit" className="button" disabled={!input.trim()}>
            <IconSend size="18" /> {t('send')}
          </button>
        )}
      </form>
    </div>
  )
}
