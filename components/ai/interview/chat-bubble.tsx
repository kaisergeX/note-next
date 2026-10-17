import type {ReactNode} from 'react'

type ChatBubbleProps = {
  variant: 'user' | 'assistant'
  children: ReactNode
}

/**
 * Shared chat bubble: user right/dark, assistant left/light. Used by both the
 * live interview chat and the read-only run transcript so the two surfaces
 * render with identical styling.
 */
export default function ChatBubble({variant, children}: ChatBubbleProps) {
  return (
    <div
      className={
        variant === 'user'
          ? 'bg-ink text-paper max-w-[85%] rounded-xl rounded-br-sm px-3 py-2 text-sm whitespace-pre-wrap'
          : 'bg-paper-raised text-ink border-hairline max-w-[85%] rounded-xl rounded-bl-sm border px-3 py-2 text-sm whitespace-pre-wrap'
      }
    >
      {children}
    </div>
  )
}
