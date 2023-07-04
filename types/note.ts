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
