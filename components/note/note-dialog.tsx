import DialogCustom from '../dialog'
import {
  type Note,
  type UpdateNote,
  NOTE_TITLE_MAX_LENGTH,
} from '~/db/schema/notes'
import NoteEditor from './note-editor'
import {genRandom} from '~/util'
import {IconArrowLeft} from '@tabler/icons-react'
import NoteCustomize, {type NoteCustomizeProps} from './note-customize'

type NoteDialogProps = {
  type?: NoteCustomizeProps['type']
  loading?: boolean
  open?: boolean
  note?: Note
  mutateNote: UpdateNote
  onClose: () => void
  onDeleteSuccess?: () => void
}

export default function NoteDialog({
  type = 'update',
  loading,
  open = false,
  note,
  mutateNote,
  onClose,
  onDeleteSuccess,
}: NoteDialogProps) {
  return (
    <DialogCustom
      className="sm-only:flex sm-only:flex-col"
      titleClassName="flex-row-reverse"
      open={open}
      closeButton={
        <button className="mr-auto h-fit" type="button" onClick={onClose}>
          <IconArrowLeft />
        </button>
      }
      onClose={onClose}
      loading={loading}
    >
      <NoteEditor
        id="dialog-note-title"
        className="mb-2"
        editorClassName="text-lg font-semibold sm:text-xl"
        initialValue={note?.title}
        onChange={(value) => {
          mutateNote.title = value
        }}
        placeholder="Title"
        limitCharacter={NOTE_TITLE_MAX_LENGTH}
        showCount
        disableEnter
        autofocus="end"
      />

      <NoteEditor
        id="dialog-note-content"
        className="flex flex-1 flex-col [&>div:has(.ProseMirror)]:flex-1"
        editorClassName="h-full sm:min-h-[40dvh]"
        initialValue={note?.content}
        placeholder={genRandom([
          'Nothing here yet 😶‍🌫️',
          'New💡',
          "Let's add something inspirational ✨",
          'Tasks to do 📝',
        ])}
        commandTypes="bubble-floating"
        onChange={(value) => {
          mutateNote.content = value
        }}
      />

      <NoteCustomize
        note={note}
        className="shadow-[0_-8px_5px_-5px] shadow-zinc-600/10 dark:shadow-zinc-400/10"
        type={type}
        onDeleteSuccess={onDeleteSuccess}
      />
    </DialogCustom>
  )
}
