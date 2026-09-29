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
          ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-900 px-3 py-2 text-sm whitespace-pre-wrap text-white dark:bg-zinc-200 dark:text-black'
          : 'max-w-[85%] rounded-2xl rounded-bl-sm border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm whitespace-pre-wrap dark:border-zinc-700 dark:bg-zinc-900'
      }
    >
      {children}
    </div>
  )
}
