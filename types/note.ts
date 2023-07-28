import type {Note, UpdateNote} from '~/db/schema/notes'

export type NoteFormValues = {
  customize?: {bgImage: string; color: string}
  tags?: string
  title?: string
  content?: string
}

export type NoteData = {
  id: string
  userId?: string
  pendingDelete?: string
  isLocked?: boolean
  isEncrypted?: boolean
  isArchived?: boolean
} & NoteFormValues

export type NoteStoreState = {
  noteData?: Note
  mutateNoteData?: UpdateNote
  editorCharCount: Record<string, {words: number; characters: number}>
}

export type NoteStore = {
  setNoteData: (noteData: Note) => void
  setMutateNoteData: (mutateNoteData?: Partial<UpdateNote>) => void
  setEditorCharCount: (
    editorId: string,
    charCount: NoteStoreState['editorCharCount'][string],
  ) => void

  resetNoteStore: () => void
} & NoteStoreState
