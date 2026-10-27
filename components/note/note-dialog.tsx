import {Dialog} from '@kaiverse/k/ui'
import {cn} from 'cn'
import {IconArrowLeft, IconMaximize} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {useLayoutEffect, useRef} from 'react'
import {Link} from '~/i18n/navigation'
import {usePersistStore} from '~/store'
import Button, {buttonClass} from '~/components/ui/button'
import NoteCustomize, {type NoteCustomizeProps} from './note-customize'
import NoteWriting from './note-writing'

type NoteDialogProps = {
  type?: NoteCustomizeProps['type']
  loading?: boolean
  error?: string
  open?: boolean
  onClose: () => void
  onMoveToTrash?: () => unknown
}

export default function NoteDialog({
  type = 'update',
  loading,
  error,
  open = false,
  onClose,
  onMoveToTrash,
}: NoteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    // Cached routes disconnect effects without removing their DOM. Close before
    // the browser drops the top layer so the dialog can become modal again.
    return () => dialog?.close()
  }, [])
  const mutateNoteData = usePersistStore((s) => s.mutateNoteData)
  const sessionIdentity = usePersistStore((s) => s.noteSession?.identity)
  const unavailable = usePersistStore(
    (s) => s.noteSession?.syncStatus === 'unavailable',
  )
  const noteTheme = mutateNoteData?.theme
  const t = useTranslations('note')

  return (
    <Dialog
      ref={dialogRef}
      className={cn(
        'min-h-80 flex-col rounded-lg open:flex max-sm:h-dvh max-sm:rounded-none sm:max-h-[calc(100dvh-2rem)]',
        'w-dvw sm:w-3/4 sm:max-w-(--breakpoint-md) md:w-2/3 2xl:max-w-(--breakpoint-xl)',
        noteTheme
          ? `dialog-${noteTheme} shadow-xl max-sm:shadow-none shadow-theme-${noteTheme}`
          : 'bg-paper-raised shadow-sheet',
        'backdrop:bg-paper/50 backdrop:backdrop-blur',
      )}
      open={open}
      preventClose
      onKeyDownCapture={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('dialog') !== event.currentTarget
        )
          return
        if (
          event.key === 'Escape' &&
          !event.currentTarget.querySelector(':popover-open')
        ) {
          event.preventDefault()
          if (!loading) onClose()
        }
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose()
      }}
      aria-label={t(type === 'create' ? 'editor.newNote' : 'editor.editNote')}
    >
      <NoteWriting
        key={sessionIdentity}
        id={`dialog-note-${sessionIdentity}`}
        pending={loading}
        leadingActions={
          <Button
            variant="ghost"
            iconOnly
            onClick={onClose}
            disabled={loading}
            aria-label={t('editor.close')}
          >
            <IconArrowLeft />
          </Button>
        }
        viewAction={
          mutateNoteData?.id && !unavailable ? (
            <Link
              href={`/full/eton/${mutateNoteData.id}`}
              className={cn(
                buttonClass({variant: 'ghost', iconOnly: true}),
                'max-sm:hidden',
              )}
              aria-label={t('editor.fullPage')}
              aria-disabled={loading}
              onClick={(event) => {
                if (loading) event.preventDefault()
              }}
              replace
            >
              <IconMaximize />
            </Link>
          ) : null
        }
      />

      {error && (
        <p role="alert" className="text-destructive px-4">
          {error}
        </p>
      )}

      <NoteCustomize
        className="shadow-sheet"
        type={type}
        error={!!error}
        onMoveToTrash={onMoveToTrash}
        loading={loading}
        scrollTopCtrl
      />
    </Dialog>
  )
}
