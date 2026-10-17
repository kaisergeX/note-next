'use client'

import {useDisclosure} from '@kaiverse/k/hooks'
import {Dialog} from '@kaiverse/k/ui'
import {
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react'
import {useLocale, useTranslations} from 'next-intl'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useState, useTransition} from 'react'
import {
  deleteInterviewSessionAction,
  renameInterviewSessionAction,
} from '~/app/[locale]/ai/interview/actions'
import type {ChatSessionSummary} from '~/components/ai/interview/persona-chat-shell'
import MenuCustom, {type MenuCustomItem} from '~/components/ui/menu'
import {cn} from 'cn'
import Button, {buttonClass, MenuItemButton} from '~/components/ui/button'
import {Input} from '~/components/ui/input'

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
  // Export API routes live outside the [locale] segment, so the UI locale is
  // forwarded for the Markdown report labels.
  const locale = useLocale()
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
      url: `/api/ai/interview/export/session/${session.id}?format=md&locale=${locale}`,
      className: 'p-3!',
      label: (
        <>
          <IconDownload size="16" /> {tExport('report')}
        </>
      ),
    },
    {
      type: 'link',
      url: `/api/ai/interview/export/session/${session.id}?format=json&locale=${locale}`,
      className: 'p-3!',
      label: (
        <>
          <IconDownload size="16" /> {tExport('backupJson')}
        </>
      ),
    },
    {
      component: (
        <MenuItemButton
          type="button"
          className="flex w-full items-center gap-2 text-sm"
          disabled={isPending}
          onClick={startRename}
        >
          <IconEdit size="16" /> {t('rename')}
        </MenuItemButton>
      ),
    },
    {
      component: (
        <MenuItemButton
          type="button"
          destructive
          className="flex w-full items-center gap-2 text-sm"
          disabled={isPending}
          onClick={openConfirm}
        >
          <IconTrash size="16" /> {t('delete')}
        </MenuItemButton>
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
          <Input
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
            className="px-2 py-1.5"
          />
        </form>
      ) : (
        <div
          className={cn(
            'flex items-center gap-1 rounded-md',
            isActive ? 'bg-ink-tint' : '',
          )}
        >
          <Link
            href={`/ai/interview/${personaId}/chat?t=${session.id}`}
            className="focus-visible:outline-accent min-w-0 flex-1 p-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={onSessionNavigate}
          >
            <p
              className={`truncate text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}
            >
              {title}
            </p>
            <p className="text-ink-muted truncate text-xs">
              {session.dateLabel}
            </p>
          </Link>
          <MenuCustom
            className={`${buttonClass({variant: 'ghost', size: 'sm', iconOnly: true, pressMotion: false})} `}
            // Top-layer anchored popover: body-level portals used to render
            // below a <dialog> top layer, but popover="auto" opens in the top
            // layer itself, so no manual inline positioning is needed.
            itemsClassName="w-48"
            items={menuItems}
          >
            <span className="sr-only">{t('menu')}</span>
            <IconDotsVertical size="16" />
          </MenuCustom>
        </div>
      )}

      {actionError && !confirmOpen && (
        <p className="text-destructive px-2 text-xs">{t('actionFailed')}</p>
      )}

      <Dialog
        className="bg-paper-raised text-ink border-hairline shadow-sheet m-auto w-[calc(100dvw-2rem)] max-w-sm rounded-lg border"
        open={confirmOpen}
        onClose={closeConfirm}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Dialog.Header>
          <Dialog.Title>{t('deleteConfirmTitle')}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Content>{t('deleteConfirmBody')}</Dialog.Content>
        <Dialog.Footer className="justify-end">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={closeConfirm}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="danger"
            className="min-h-11"
            disabled={isPending}
            onClick={handleDelete}
          >
            <IconTrash size="18" /> {t('delete')}
          </Button>
        </Dialog.Footer>
      </Dialog>
    </div>
  )
}
