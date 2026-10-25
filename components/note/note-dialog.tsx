import {Dialog} from '@kaiverse/k/ui'
import {cn} from 'cn'
import {IconArrowLeft, IconMaximize} from '@tabler/icons-react'
import {useMessages, useTranslations} from 'next-intl'
import {useLayoutEffect, useRef} from 'react'
import {Link} from '~/i18n/navigation'
import {NOTE_TITLE_MAX_LENGTH} from '~/db/schema/notes'
import {usePersistStore} from '~/store'
import {useRandomString} from '~/util/hooks'
import Button from '~/components/ui/button'
import NoteCustomize, {type NoteCustomizeProps} from './note-customize'
import NoteEditor from './note-editor'

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
  const {mutateNoteData, setMutateNoteData} = usePersistStore((s) => ({
    mutateNoteData: s.mutateNoteData,
    setMutateNoteData: s.setMutateNoteData,
  }))
  const noteTheme = mutateNoteData?.theme
  const t = useTranslations('note')
  const messages = useMessages()
  const emptyPlaceholders = useRandomString(
    messages.note.editor.emptyPlaceholder,
  )

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
      aria-labelledby={`dialog-note-title-${type}-${mutateNoteData?.id || 'new'}`}
    >
      <div
        className={cn(
          'flex-center-between sticky top-0 z-10 bg-inherit p-4',
          'animate-scroll-shadow shadow-ink/10 transition-shadow [animation-range-end:8rem]',
        )}
      >
        <Button
          variant="ghost"
          iconOnly
          onClick={onClose}
          disabled={loading}
          aria-label="Close dialog"
        >
          <IconArrowLeft />
        </Button>

        {mutateNoteData?.id ? (
          <Link
            href={`/full/eton/${mutateNoteData.id}`}
            className="max-sm:hidden"
            aria-label="Full page view"
            replace
          >
            <IconMaximize />
          </Link>
        ) : null}
      </div>

      <NoteEditor
        id={`dialog-note-title-${type}-${mutateNoteData?.id || 'new'}`}
        className="p-4"
        editorClassName="text-lg font-semibold sm:text-xl"
        initialValue={mutateNoteData?.title}
        onChange={(value) => setMutateNoteData({title: value})}
        placeholder={t('editor.title')}
        ariaLabel={t('editor.title')}
        limitCharacter={NOTE_TITLE_MAX_LENGTH}
        showCount
        disableDefaultEnter
        autofocus="end"
        loading={loading}
      />

      <NoteEditor
        id={`dialog-note-content-${type}-${mutateNoteData?.id || 'new'}`}
        className="flex flex-1 flex-col p-4 [&>div:has(.ProseMirror)]:flex-1"
        editorClassName="h-full sm:min-h-[40dvh]"
        initialValue={mutateNoteData?.content}
        placeholder={emptyPlaceholders}
        ariaLabel={t('editor.body')}
        commandTypes="bubble-floating"
        onChange={(value) => setMutateNoteData({content: value})}
        loading={loading}
      />

      {error && (
        <p role="alert" className="text-destructive px-4">
          {error}
        </p>
      )}

      <NoteCustomize
        className={`shadow-[0_-8px_5px_-5px] shadow-theme-${noteTheme || 'slate'}`}
        type={type}
        error={!!error}
        onMoveToTrash={onMoveToTrash}
        loading={loading}
        scrollTopCtrl
      />
    </Dialog>
  )
}
