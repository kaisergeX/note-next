import DialogFlow from '~/components/ui/dialog-flow'
import {cn} from 'cn'
import {IconArrowLeft, IconMaximize} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {Link} from '~/i18n/navigation'
import {usePersistStore} from '~/store'
import Button, {buttonClass} from '~/components/ui/button'
import NoteCustomize, {type NoteCustomizeProps} from './note-customize'
import NoteWriting from './note-writing'
import {useSearchParams} from 'next/navigation'
import {withBrowserWorkReturn} from '~/lib/notes/navigation'

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
  const search = useSearchParams()
  const fromBrowserWork = search.get('from') === 'browser-work'
  const version = search.get('version')
  const mutateNoteData = usePersistStore((s) => s.mutateNoteData)
  const sessionIdentity = usePersistStore((s) => s.noteSession?.identity)
  const unavailable = usePersistStore(
    (s) => s.noteSession?.syncStatus === 'unavailable',
  )
  const noteTheme = mutateNoteData?.theme
  const t = useTranslations('note')

  return (
    <DialogFlow
      step="editor"
      layout="custom"
      className={cn(
        'min-h-80 flex-col rounded-lg open:flex max-sm:h-dvh max-sm:rounded-none sm:max-h-[calc(100dvh-2rem)]',
        'w-dvw sm:w-3/4 sm:max-w-(--breakpoint-md) md:w-2/3 2xl:max-w-(--breakpoint-xl)',
        noteTheme
          ? `dialog-${noteTheme} shadow-xl max-sm:shadow-none shadow-theme-${noteTheme}`
          : 'bg-paper-raised shadow-sheet',
        'backdrop:bg-paper/50 backdrop:backdrop-blur',
      )}
      open={open}
      busy={Boolean(loading)}
      onRequestClose={onClose}
      dismissOnBackdrop
      ariaLabel={t(type === 'create' ? 'editor.newNote' : 'editor.editNote')}
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
              href={withBrowserWorkReturn(
                `/full/eton/${mutateNoteData.id}${version ? `?version=${encodeURIComponent(version)}` : ''}`,
                fromBrowserWork,
              )}
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
    </DialogFlow>
  )
}
