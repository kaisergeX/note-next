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
  editorCharCount: Record<string, {words: number; characters: number}>
}

export type NoteStore = {
  setEditorCharCount: (
    editorId: string,
    charCount: NoteStoreState['editorCharCount'][string],
  ) => void
  resetNoteStore: () => void
} & NoteStoreState
