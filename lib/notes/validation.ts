import {z} from 'zod'
import {NOTE_TITLE_MAX_LENGTH, themePgEnum} from '~/db/schema/notes'

// generate_ulid() returns UUID-shaped IDs without RFC version bits.
export const noteIdSchema = z
  .string()
  .regex(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i)
const contentFields = {
  title: z
    .string()
    .max(NOTE_TITLE_MAX_LENGTH * 3)
    .nullable(),
  content: z.string().nullable(),
  theme: z.enum(themePgEnum.enumValues).nullable(),
}
// No archive/encryption editing controls exist yet; preserve those flags.
export const createNoteSchema = z.strictObject(contentFields).partial()
export const editNoteSchema = createNoteSchema.refine((value) =>
  Object.values(value).some((field) => field !== undefined),
)
export const trashDraftSchema = z.strictObject(contentFields)
export const deadlineSchema = z.iso.datetime({precision: 6})
export type NoteContentInput = z.infer<typeof createNoteSchema>

// Client projection only; the server validates independently.
export function pickNoteContent(note: NoteContentInput): NoteContentInput {
  return {title: note.title, content: note.content, theme: note.theme}
}
