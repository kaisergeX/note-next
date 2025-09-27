import {Dialog} from '@kaiverse/k/ui'
import {classNames} from '@kaiverse/k/utils'
import {IconArrowLeft, IconMaximize} from '@tabler/icons-react'
import {useMessages, useTranslations} from 'next-intl'
import Link from 'next/link'
import {NOTE_TITLE_MAX_LENGTH} from '~/db/schema/notes'
import {usePersistStore} from '~/store'
import {useRandomString} from '~/util/hooks'
import NoteCustomize, {type NoteCustomizeProps} from './note-customize'
import NoteEditor from './note-editor'

type NoteDialogProps = {
  type?: NoteCustomizeProps['type']
  loading?: boolean
  open?: boolean
  onClose: () => void
  onDeleteSuccess?: () => unknown
}

export default function NoteDialog({
  type = 'update',
  loading,
  open = false,
  onClose,
  onDeleteSuccess,
}: NoteDialogProps) {
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
      className={classNames(
        'm-[revert] min-h-80 max-sm:h-dvh max-sm:rounded-none sm:max-h-[calc(100dvh-2rem)]',
        'w-dvw sm:w-3/4 sm:max-w-(--breakpoint-md) md:w-1/2 2xl:max-w-(--breakpoint-lg)',
        noteTheme
          ? `dialog-${noteTheme} shadow-xl max-sm:shadow-none shadow-theme-${noteTheme}`
          : 'bg-zinc-50 dark:bg-zinc-900',
        'backdrop:bg-zinc-50/40 backdrop:backdrop-blur',
      )}
      open={open}
      onClose={onClose}
    >
      <div
        className={classNames(
          'flex-center-between sticky top-0 z-10 bg-inherit p-4',
          'animate-scroll-shadow shadow-zinc-600/10 transition-shadow [animation-range-end:8rem] dark:shadow-zinc-400/10',
        )}
      >
        <button
          className="h-fit"
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Close dialog"
        >
          <IconArrowLeft />
        </button>

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
        className="mb-2 p-4"
        editorClassName="text-lg font-semibold sm:text-xl"
        initialValue={mutateNoteData?.title}
        onChange={(value) => setMutateNoteData({title: value})}
        placeholder={t('editor.title')}
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
        commandTypes="bubble-floating"
        onChange={(value) => setMutateNoteData({content: value})}
        loading={loading}
      />

      <NoteCustomize
        className="shadow-[0_-8px_5px_-5px] shadow-zinc-600/10 dark:shadow-zinc-400/10"
        type={type}
        onDeleteSuccess={onDeleteSuccess}
        loading={loading}
        scrollTopCtrl
      />
    </Dialog>
  )
}
