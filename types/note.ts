import type {Note} from '~/db/schema/notes'

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
  mutateNoteData?: Note
  noteSession?: {
    key: string
    identity: string
    baseline: Partial<Note>
    operation?: 'save' | 'trash'
    error?: 'save' | 'trash'
  }
  editorCharCount: Record<string, {words: number; characters: number}>
}

export type NoteStore = {
  beginNoteSession: (key: string, note?: Note) => void
  setMutateNoteData: (mutateNoteData?: Partial<Note>) => void
  setEditorCharCount: (
    editorId: string,
    charCount: NoteStoreState['editorCharCount'][string],
  ) => void

  resetNoteStore: () => void
} & NoteStoreState
