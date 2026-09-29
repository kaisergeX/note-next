'use client'

import type {UIMessage} from 'ai'
import {IconRefresh} from '@tabler/icons-react'
import {useFormatter, useTranslations} from 'next-intl'
import ChatBubble from '~/components/ai/interview/chat-bubble'

type ChatMessagesProps = {
  messages: UIMessage[]
  personaName: string
  isBusy: boolean
  /** Awaiting the first token of the next assistant reply. */
  showTyping: boolean
  emptyStateLabel: string
  /** Finish times for live assistant messages, keyed by message id. */
  liveTimeMap?: Map<string, string>
  canRegenerate: boolean
  onRegenerate: () => void
}

/**
 * Presentational message list for the interview chat. The parent owns the
 * scroll container and stick-to-bottom state; this renders the empty state,
 * the message rows and the typing bubble only.
 */
export default function ChatMessages({
  messages,
  personaName,
  isBusy,
  showTyping,
  emptyStateLabel,
  liveTimeMap,
  canRegenerate,
  onRegenerate,
}: ChatMessagesProps) {
  const t = useTranslations('ai.interview.chat')
  const format = useFormatter()

  const lastMessage = messages[messages.length - 1]
  const showRegenerate =
    canRegenerate && lastMessage?.role === 'assistant' && !isBusy

  return (
    <div
      aria-busy={isBusy}
      className="container mx-auto flex grow flex-col gap-3 py-4"
    >
      {messages.length === 0 && (
        <p className="text-muted-foreground h-full content-center text-center text-sm">
          {emptyStateLabel}
        </p>
      )}
      {messages.map((message, index) => {
        const metadata = message.metadata as {createdAt?: string} | undefined
        const rawCreatedAt =
          typeof metadata?.createdAt === 'string'
            ? metadata.createdAt
            : liveTimeMap?.get(message.id)
        // Unparsable timestamps render no timestamp element instead of crashing.
        const createdAt =
          rawCreatedAt && !Number.isNaN(new Date(rawCreatedAt).getTime())
            ? rawCreatedAt
            : undefined
        const isLast = index === messages.length - 1
        return (
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
            <ChatBubble
              variant={message.role === 'user' ? 'user' : 'assistant'}
            >
              {message.parts
                .filter((part) => part.type === 'text')
                .map((part, index) => (
                  <p key={index}>{part.text}</p>
                ))}
            </ChatBubble>
            {createdAt && (
              <time
                dateTime={createdAt}
                title={format.dateTime(new Date(createdAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                className="text-muted-foreground mt-0.5 text-[10px] tabular-nums"
              >
                {format.dateTime(new Date(createdAt), {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            )}
            {isLast &&
              showRegenerate &&
              message.role === 'assistant' &&
              !showTyping && (
                <button
                  type="button"
                  aria-label={t('regenerate')}
                  onClick={onRegenerate}
                  className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-xs transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <IconRefresh size={14} /> {t('regenerate')}
                </button>
              )}
          </div>
        )
      })}
      {showTyping && (
        <div className="flex flex-col items-start">
          <span className="text-muted-foreground mb-0.5 text-xs wrap-anywhere">
            {personaName}
          </span>
          <ChatBubble variant="assistant">
            {/* Visual-only dots; the label is for screen readers. */}
            <div
              role="status"
              aria-label={t('typing')}
              className="flex items-center gap-1.5 py-1"
            >
              <span className="typing-dot size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
              <span className="typing-dot size-1.5 rounded-full bg-zinc-400 [animation-delay:200ms] dark:bg-zinc-500" />
              <span className="typing-dot size-1.5 rounded-full bg-zinc-400 [animation-delay:400ms] dark:bg-zinc-500" />
            </div>
          </ChatBubble>
        </div>
      )}
    </div>
  )
}
