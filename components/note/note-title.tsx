import {NotesTable} from '~/db/schema/notes'
import NoteEditor from './note-editor'

export default function NoteTitleEditor({
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
