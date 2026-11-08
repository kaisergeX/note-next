'use client'

import {IconDotsVertical, IconTrash} from '@tabler/icons-react'
import {cn} from 'cn'
import {useTranslations} from 'next-intl'
import {Link, useRouter} from '~/i18n/navigation'
import {isMobileNoteView} from '~/lib/notes/mobile'
import {useState, useTransition, type ReactNode} from 'react'
import {moveNoteToTrashAction} from '~/app/[locale]/(note)/eton/actions'
import Button, {buttonClass} from '~/components/ui/button'
import MenuCustom, {type MenuCustomItem} from '~/components/ui/menu'
import {performNoteMutation} from '~/lib/notes/client-mutation'
import {noteMutationSucceeded} from '~/lib/notes/lifecycle'
import {meaningfulContent} from '~/lib/notes/sync'
import type {Note} from '~/db/schema/notes'
import {NOTE_PREVIEW_LENGTH} from '~/lib/notes/pages'
import NoteCard, {
  NoteCardEmpty,
  NoteCardFooter,
  NoteCardSummary,
} from './note-card'

type NoteProps = {
  data: Pick<Note, 'id' | 'title' | 'content' | 'theme'> & {
    isEncrypted?: boolean
  }
  snippet?: string
  href?: string
  status?: ReactNode
  notice?: ReactNode
  actions?: (items: MenuCustomItem[]) => ReactNode
  pendingWork?: boolean
  localOnly?: boolean
  onOpen?: (anchor: HTMLAnchorElement) => void
}

export default function NoteTiny({
  data,
  href,
  status,
  notice,
  actions,
  pendingWork,
  localOnly,
  onOpen,
  snippet,
}: NoteProps) {
  const {id: noteId, title, content, theme} = data
  const [pendingTransition, startTransition] = useTransition()
  const [deleteError, setDeleteError] = useState(false)
  const [confirmTrash, setConfirmTrash] = useState(false)
  const t = useTranslations('note')

  const router = useRouter()

  const handleDeleteNote = () => {
    if (!noteId) {
      return
    }

    startTransition(async () => {
      setDeleteError(false)
      const result = await performNoteMutation(() =>
        moveNoteToTrashAction(noteId),
      )
      if (!noteMutationSucceeded(result)) {
        setDeleteError(true)
        return
      }
      window.dispatchEvent(new CustomEvent('note-saved', {detail: result.note}))
    })
  }

  const menuItems: MenuCustomItem[] = [
    {
      type: 'action',
      label: (
        <>
          <IconTrash size="1rem" /> {t('trash.move')}
        </>
      ),
      destructive: true,
      disabled: pendingTransition,
      onSelect: () =>
        pendingWork ? setConfirmTrash(true) : handleDeleteNote(),
    },
  ]

  return (
    <NoteCard theme={theme} className="flex h-full flex-col">
      <Link
        className="block flex-1 p-4"
        data-note-id={noteId}
        href={href ?? `/eton/${noteId}`}
        onClick={(e) => {
          if (pendingTransition) {
            e.preventDefault()
            return
          }
          if (
            !e.defaultPrevented &&
            !e.metaKey &&
            !e.ctrlKey &&
            !e.shiftKey &&
            !e.altKey
          )
            onOpen?.(e.currentTarget)
          if (
            !e.defaultPrevented &&
            !e.metaKey &&
            !e.ctrlKey &&
            !e.shiftKey &&
            !e.altKey &&
            isMobileNoteView() &&
            !href
          ) {
            e.preventDefault()
            router.push(`/full/eton/${noteId}`)
          }
        }}
      >
        {meaningfulContent(data) || Boolean(snippet) ? (
          <NoteCardSummary
            title={title}
            content={
              data.isEncrypted
                ? null
                : (content?.slice(0, NOTE_PREVIEW_LENGTH) ?? null)
            }
            bodyText={data.isEncrypted ? '' : snippet}
            theme={theme}
          />
        ) : (
          <NoteCardEmpty label={t('emptyNote')} />
        )}
      </Link>

      {notice && <p className="text-warning px-4 pb-2 text-sm">{notice}</p>}
      {deleteError && (
        <p role="alert" className="text-destructive px-4 pb-10">
          {t('trash.moveFailed')}
        </p>
      )}
      {confirmTrash && (
        <div className="bg-paper-raised text-ink border-hairline border-t p-3 text-sm">
          <p>{t('recovery.trashWithLocal')}</p>
          <Button
            variant="danger"
            size="sm"
            disabled={pendingTransition}
            onClick={handleDeleteNote}
          >
            {t('trash.move')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmTrash(false)}
          >
            {t('recovery.cancel')}
          </Button>
        </div>
      )}
      <NoteCardFooter
        actions={
          actions
            ? actions(localOnly ? [] : menuItems)
            : !localOnly && (
                <MenuCustom
                  ariaLabel={t('accessibility.moreActions')}
                  className={buttonClass({
                    variant: 'ghost',
                    size: 'sm',
                    iconOnly: true,
                  })}
                  anchor="top-end"
                  itemsClassName={cn(
                    'note-tiny-menu',
                    'rounded-lg bg-paper-raised border-hairline border',
                    `shadow-none shadow-theme-${theme || 'slate'}`,
                  )}
                  items={menuItems}
                >
                  <IconDotsVertical size="1rem" />
                </MenuCustom>
              )
        }
      >
        {status}
      </NoteCardFooter>
    </NoteCard>
  )
}
