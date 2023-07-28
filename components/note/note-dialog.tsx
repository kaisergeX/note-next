import DialogCustom from '../ui/dialog'
import {type Note, NOTE_TITLE_MAX_LENGTH} from '~/db/schema/notes'
import NoteEditor from './note-editor'
import {genRandom} from '~/util'
import {IconArrowLeft} from '@tabler/icons-react'
import NoteCustomize, {type NoteCustomizeProps} from './note-customize'
import {usePersistStore} from '~/store'

type NoteDialogProps = {
  type?: NoteCustomizeProps['type']
  loading?: boolean
  open?: boolean
  note?: Note
  onClose: () => void
  onDeleteSuccess?: () => void
}

export default function NoteDialog({
  type = 'update',
  loading,
  open = false,
  note,
  onClose,
  onDeleteSuccess,
}: NoteDialogProps) {
  const {mutateNoteData, setMutateNoteData} = usePersistStore()
  const theme = mutateNoteData?.theme

  return (
    <DialogCustom
      className="sm-only:flex sm-only:flex-col"
      theme={theme}
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
        initialValue={mutateNoteData?.title}
        onChange={(value) => setMutateNoteData({title: value})}
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
        initialValue={mutateNoteData?.content}
        placeholder={genRandom([
          'Nothing here yet 😶‍🌫️',
          'New💡',
          "Let's add something inspirational ✨",
          'Tasks to do 📝',
        ])}
        commandTypes="bubble-floating"
        onChange={(value) => setMutateNoteData({content: value})}
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
