'use client'

import {IconDotsVertical, IconEdit, IconTrash} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useRef, useState, useTransition} from 'react'
import {
  deleteInterviewSessionAction,
  renameInterviewSessionAction,
} from '~/app/[locale]/ai/interview/actions'
import type {ChatSessionSummary} from '~/components/ai/interview/persona-chat-shell'

type SessionRowProps = {
  personaId: string
  session: ChatSessionSummary
  isActive: boolean
  /** Optional: closes the mobile drawer when a session link is tapped. */
  onSessionNavigate?: () => void
}

const MENU_ITEM_CLASS =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800'

/**
 * One sidebar session row: navigates to the session, plus a kebab menu
 * (outside-click/Escape/aria, matching the roster card) with rename and a
 * delete confirm modal.
 */
export default function SessionRow({
  personaId,
  session,
  isActive,
  onSessionNavigate,
}: SessionRowProps) {
  const t = useTranslations('ai.interview.chat')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [actionError, setActionError] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the kebab menu on outside click and Escape while open. The Escape
  // listener runs in the capture phase and stops immediate propagation: the
  // mobile drawer registers its own document-level keydown (bubble phase) and
  // both listeners live on `document`, so plain stopPropagation between
  // same-target listeners would have no effect — the capture listener runs
  // first and stopImmediatePropagation keeps the drawer open behind the menu.
  useEffect(() => {
    if (!menuOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [menuOpen])

  // Close the confirm modal on Escape while open (same capture-phase guard so
  // the drawer behind the modal stays open).
  useEffect(() => {
    if (!confirmOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        setConfirmOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [confirmOpen])

  const closeMenuAnd = (action: () => void) => {
    setMenuOpen(false)
    action()
  }

  const startRename = () => {
    setEditValue(session.title ?? '')
    setIsEditing(true)
  }

  const cancelRename = () => setIsEditing(false)

  // Empty input clears the stored title; the row falls back to its preview.
  const saveRename = () => {
    setIsEditing(false)
    setActionError(false)
    startTransition(async () => {
      const result = await renameInterviewSessionAction(
        session.id,
        editValue.trim(),
      )
      if (result.ok) router.refresh()
      else setActionError(true)
    })
  }

  const handleDelete = () => {
    setConfirmOpen(false)
    setActionError(false)
    startTransition(async () => {
      const result = await deleteInterviewSessionAction(session.id)
      if (!result.ok) {
        setActionError(true)
        return
      }
      if (isActive) {
        // Removing the open session lands on the picker state; the chat area
        // must not keep rendering a deleted transcript.
        router.push(`/ai/interview/${personaId}/chat`)
      } else {
        router.refresh()
      }
    })
  }

  const title = session.title ?? (session.preview || t('emptyState'))

  return (
    <div className="relative">
      {isEditing ? (
        <form
          className="p-1"
          onSubmit={(e) => {
            e.preventDefault()
            saveRename()
          }}
        >
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                cancelRename()
              }
            }}
            onBlur={cancelRename}
            autoFocus
            aria-label={t('rename')}
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </form>
      ) : (
        <div
          className={`flex items-center gap-1 rounded-md ${
            isActive ? 'bg-zinc-100 dark:bg-zinc-800' : ''
          }`}
        >
          <Link
            href={`/ai/interview/${personaId}/chat?t=${session.id}`}
            className="min-w-0 flex-1 px-2 py-2"
            onClick={onSessionNavigate}
          >
            <p
              className={`truncate text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}
            >
              {title}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {session.dateLabel}
            </p>
          </Link>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="button-secondary px-1.5 py-1"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t('menu')}
              onClick={() => setMenuOpen((open) => !open)}
              disabled={isPending}
            >
              <IconDotsVertical size="18" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="bg-default absolute top-full right-0 z-20 mt-1 w-40 overflow-hidden rounded-md border border-zinc-200 py-1 shadow-lg dark:border-zinc-700"
              >
                <button
                  type="button"
                  role="menuitem"
                  className={MENU_ITEM_CLASS}
                  onClick={() => closeMenuAnd(startRename)}
                >
                  <IconEdit size="16" /> {t('rename')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={`${MENU_ITEM_CLASS} text-danger`}
                  onClick={() => closeMenuAnd(() => setConfirmOpen(true))}
                >
                  <IconTrash size="16" /> {t('delete')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {actionError && !confirmOpen && (
        <p className="text-danger px-2 text-xs">{t('actionFailed')}</p>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label={t('cancel')}
            className="absolute inset-0 bg-black/50"
            onClick={() => setConfirmOpen(false)}
          />
          <div className="card bg-default relative z-10 w-full max-w-sm space-y-3 p-4">
            <h3 className="text-base font-semibold">
              {t('deleteConfirmTitle')}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t('deleteConfirmBody')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="button-secondary text-sm"
                onClick={() => setConfirmOpen(false)}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="button text-danger text-sm"
                disabled={isPending}
                onClick={handleDelete}
              >
                <IconTrash size="16" /> {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
