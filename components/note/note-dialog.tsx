import {IconArrowLeft, IconMaximize} from '@tabler/icons-react'
import Link from 'next/link'
import {NOTE_TITLE_MAX_LENGTH} from '~/db/schema/notes'
import {usePersistStore} from '~/store'
import {genRandom} from '~/util'
import DialogCustom from '../ui/dialog'
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

  return (
    <DialogCustom
      className="max-sm:flex max-sm:flex-col"
      theme={noteTheme}
      header={
        mutateNoteData?.id ? (
          <Link
            href={`/full/eton/${mutateNoteData.id}`}
            className="max-sm:hidden"
            aria-label="Full page view"
            replace
          >
            <IconMaximize />
          </Link>
        ) : null
      }
      open={open}
      closeButton={
        <button
          className="mr-auto h-fit"
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Close dialog"
        >
          <IconArrowLeft />
        </button>
      }
      onClose={onClose}
    >
      <NoteEditor
        id="dialog-note-title"
        className="mb-2"
        editorClassName="text-lg font-semibold sm:text-xl"
        initialValue={mutateNoteData?.title}
        onChange={(value) => setMutateNoteData({title: value})}
        placeholder="Title"
        limitCharacter={NOTE_TITLE_MAX_LENGTH}
        showCount
        disableEnter
        autofocus="end"
        loading={loading}
      />

      <NoteEditor
        id="dialog-note-content"
        className="flex flex-1 flex-col [&>div:has(.ProseMirror)]:flex-1"
        editorClassName="h-full sm:min-h-[40dvh]"
        initialValue={mutateNoteData?.content}
        placeholder={genRandom([
          'Nothing here yet 😶‍🌫️',
          'New💡',
          "Let's add something inspirational ✨",
          'Tasks to do 📝',
        ])}
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
    </DialogCustom>
  )
}
