import DialogCustom from '../dialog'
import {NotesTable, type Note, type UpdateNote} from '~/db/schema/notes'
import NoteEditor from './note-editor'
import {genRandom} from '~/util'

type NoteDialogProps = {
  isLoading?: boolean
  open?: boolean
  note?: Note
  mutateNote: UpdateNote
  onClose: () => void
}

export default function NoteDialog({
  isLoading,
  open = false,
  note,
  mutateNote,
  onClose,
}: NoteDialogProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  return (
    <DialogCustom
      open={open}
      title={
        // we need it actually disappear from DOM instead of just display: none
        !isMobile && (
          <NoteTitleEditor
            title={note?.title}
            onChange={(value) => {
              mutateNote.title = value
            }}
          />
        )
      }
      onClose={onClose}
      loading={isLoading}
    >
      <div>
        {isMobile && (
          <NoteTitleEditor
            title={note?.title}
            onChange={(value) => {
              mutateNote.title = value
            }}
          />
        )}

        <NoteEditor
          id="note-content"
          editorClassName="min-h-[40dvh]"
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
      </div>
    </DialogCustom>
  )
}

function NoteTitleEditor({
  className,
  title,
  onChange,
}: {
  className?: string
  title?: string | null
  onChange: (value: string) => void
}) {
  return (
    <NoteEditor
      id="note-title"
      className={className}
      editorClassName="text-lg font-semibold sm:text-xl"
      initialValue={title}
      onChange={onChange}
      placeholder={'Title'}
      limitCharacter={NotesTable.title.length}
      showCount
      disableEnter
    />
  )
}
