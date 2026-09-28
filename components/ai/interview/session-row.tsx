'use client'

import {useDisclosure} from '@kaiverse/k/hooks'
import {Dialog} from '@kaiverse/k/ui'
import {
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useState, useTransition} from 'react'
import {
  deleteInterviewSessionAction,
  renameInterviewSessionAction,
} from '~/app/[locale]/ai/interview/actions'
import MenuCustom, {type MenuCustomItem} from '~/components/ui/menu'
import type {ChatSessionSummary} from '~/components/ai/interview/persona-chat-shell'
import {classNames} from '@kaiverse/k/utils'

type SessionRowProps = {
  personaId: string
  session: ChatSessionSummary
  isActive: boolean
  /** Optional: closes the mobile drawer when a session link is tapped. */
  onSessionNavigate?: () => void
}

/**
 * One sidebar session row: navigates to the session, plus a MenuCustom kebab
 * menu (rename, delete confirm modal).
 */

export default function SessionRow({
  personaId,
  session,
  isActive,
  onSessionNavigate,
}: SessionRowProps) {
  const t = useTranslations('ai.interview.chat')
  const tExport = useTranslations('ai.interview.export')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [confirmOpen, {open: openConfirm, close: closeConfirm}] =
    useDisclosure()
  const [actionError, setActionError] = useState(false)

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
    closeConfirm()
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

  const menuItems: MenuCustomItem[] = [
    {
      type: 'link',
      url: `/api/ai/interview/export/session/${session.id}?format=md`,
      className: 'p-3',
      label: (
        <>
          <IconDownload size="16" /> {tExport('report')}
        </>
      ),
    },
    {
      type: 'link',
      url: `/api/ai/interview/export/session/${session.id}?format=json`,
      className: 'p-3',
      label: (
        <>
          <IconDownload size="16" /> {tExport('backupJson')}
        </>
      ),
    },
    {
      component: (
        <button
          type="button"
          className="hover:bg-reverse data-active:bg-reverse data-disabled:disabled flex w-full items-center gap-2 p-3 text-left text-sm"
          disabled={isPending}
          onClick={startRename}
        >
          <IconEdit size="16" /> {t('rename')}
        </button>
      ),
    },
    {
      component: (
        <button
          type="button"
          className="text-danger hover:bg-reverse data-active:bg-reverse data-disabled:disabled flex w-full items-center gap-2 p-3 text-left text-sm"
          disabled={isPending}
          onClick={openConfirm}
        >
          <IconTrash size="16" /> {t('delete')}
        </button>
      ),
    },
  ]

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
          className={classNames(
            'flex items-center gap-1 rounded-md',
            isActive ? 'bg-zinc-100 dark:bg-zinc-800' : '',
          )}
        >
          <Link
            href={`/ai/interview/${personaId}/chat?t=${session.id}`}
            className="min-w-0 flex-1 p-2"
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
          <MenuCustom
            className="button-secondary button-icon rounded-full p-1 not-hover:border-transparent"
            anchor={null}
            // Inline render (no portal): body-level portals render below a
            // <dialog> top layer, so the mobile drawer would cover the menu.
            itemsClassName="absolute top-full right-0.5 z-20 w-40"
            items={menuItems}
          >
            <span className="sr-only">{t('menu')}</span>
            <IconDotsVertical size="18" />
          </MenuCustom>
        </div>
      )}

      {actionError && !confirmOpen && (
        <p className="text-danger px-2 text-xs">{t('actionFailed')}</p>
      )}

      <Dialog
        className="bg-default m-auto w-[calc(100dvw-2rem)] max-w-sm"
        open={confirmOpen}
        onClose={closeConfirm}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Dialog.Header>
          <Dialog.Title>{t('deleteConfirmTitle')}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Content>{t('deleteConfirmBody')}</Dialog.Content>
        <Dialog.Footer className="justify-end">
          <button
            type="button"
            className="button-secondary"
            onClick={closeConfirm}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            className="button-danger"
            disabled={isPending}
            onClick={handleDelete}
          >
            <IconTrash size="18" /> {t('delete')}
          </button>
        </Dialog.Footer>
      </Dialog>
    </div>
  )
}
