import {Dialog} from '@kaiverse/k/ui'
import {
  IconFingerprint,
  IconLock,
  IconNotebook,
  IconX,
} from '@tabler/icons-react'
import {useId, useLayoutEffect, useRef, useState} from 'react'
import NoteEditor, {useNoteEditor} from '~/components/note/note-editor'
import Button from '~/components/ui/button'
import {NOTE_TITLE_MAX_LENGTH} from '~/db/schema/notes'
import type {PreviewNote} from './preview-collection'

export function PreviewUnlock({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  const labelId = useId()
  const dialog = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const element = dialog.current
    return () => element?.close()
  }, [])

  function finish(action: () => void) {
    dialog.current?.close()
    action()
  }

  return (
    <Dialog
      ref={dialog}
      open
      preventClose
      aria-labelledby={labelId}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          finish(onCancel)
        }
      }}
      className="bg-paper-raised text-ink border-hairline shadow-sheet backdrop:bg-paper/50 m-auto max-h-full w-11/12 max-w-sm rounded-lg border p-5 backdrop:backdrop-blur sm:p-6"
    >
      <h2
        id={labelId}
        className="mb-4 flex items-center gap-2 text-base font-semibold"
      >
        <IconLock size={18} aria-hidden /> Unlock encrypted notes
      </h2>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => finish(onConfirm)}>
          <IconFingerprint size={18} aria-hidden /> Unlock with sample passkey
        </Button>
        <Button variant="ghost" onClick={() => finish(onCancel)}>
          Cancel
        </Button>
      </div>
    </Dialog>
  )
}

export default function PreviewEditor({
  note,
  onChange,
  onClose,
}: {
  note: PreviewNote
  onChange: (note: PreviewNote) => void
  onClose: () => void
}) {
  const labelId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const draft = useRef(note)
  const [changed, setChanged] = useState(Boolean(note.edited))
  const encrypted = note.kind === 'encrypted'
  const Icon = encrypted ? IconLock : IconNotebook
  const body = useNoteEditor({
    initialValue: note.content,
    onChange: (value) => edit('content', value),
    onFocus: () => {},
    ariaLabel: 'Note body',
    placeholder: 'Start writing…',
    editorClassName: 'min-h-64',
    editorVersion: 0,
  })
  const title = useNoteEditor({
    initialValue: note.title,
    onChange: (value) => edit('title', value),
    onFocus: () => {},
    onPressEnter: () => body?.commands.focus('start'),
    ariaLabel: 'Note title',
    placeholder: 'Untitled note',
    editorClassName: 'text-2xl font-semibold sm:text-3xl',
    limitCharacter: NOTE_TITLE_MAX_LENGTH,
    editorVersion: 0,
  })

  useLayoutEffect(() => {
    const element = dialog.current
    return () => element?.close()
  }, [])

  function edit(field: 'title' | 'content', value: string) {
    draft.current = {...draft.current, [field]: value, edited: true}
    onChange(draft.current)
    setChanged(true)
  }

  function close() {
    dialog.current?.close()
    onClose()
  }

  return (
    <Dialog
      ref={dialog}
      open
      preventClose
      aria-labelledby={labelId}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          close()
        }
      }}
      className="bg-paper-raised text-ink border-hairline shadow-sheet backdrop:bg-paper/50 m-auto h-dvh max-h-dvh w-dvw flex-col overflow-hidden rounded-none border-0 p-0 backdrop:backdrop-blur open:flex sm:h-auto sm:max-h-5/6 sm:w-3/4 sm:max-w-3xl sm:rounded-lg sm:border"
    >
      <header className="border-hairline flex flex-wrap items-center gap-x-3 border-b px-4 py-2 sm:px-6">
        <h2
          id={labelId}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <Icon size={17} aria-hidden /> {encrypted ? 'Encrypted note' : 'Note'}
        </h2>
        <p role="status" className="text-ink-muted flex-1 text-xs">
          {changed
            ? 'Changes kept in this preview'
            : note.location === 'account'
              ? 'Saved to your account'
              : note.content || note.title
                ? 'Saved on this browser'
                : 'Sample draft'}
        </p>
        <Button
          variant="ghost"
          iconOnly
          aria-label={encrypted ? 'Close encrypted note' : 'Close note'}
          onClick={close}
        >
          <IconX size={20} aria-hidden />
        </Button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-8">
        <NoteEditor
          id={`${labelId}-title`}
          editor={title}
          className="font-serif wrap-anywhere"
        />
        <NoteEditor
          id={`${labelId}-body`}
          editor={body}
          className="font-serif wrap-anywhere"
        />
      </div>
    </Dialog>
  )
}
