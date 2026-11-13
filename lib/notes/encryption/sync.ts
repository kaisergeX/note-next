import {z} from 'zod'
import {encryptedNotePayloadSchema, type EncryptedNotePayload} from './protocol'
import {noteIdSchema, trashDraftSchema} from '../validation'

export const encryptedWriteSchema = z
  .strictObject({
    mode: z.literal('encrypted'),
    operation: z.enum(['create', 'save']),
    mutationId: z.uuid(),
    expectedRevision: z.uuid().nullable(),
    payload: encryptedNotePayloadSchema,
    theme: trashDraftSchema.shape.theme,
  })
  .refine(
    (write) =>
      (write.operation === 'create') === (write.expectedRevision === null),
  )
export type EncryptedWrite = z.infer<typeof encryptedWriteSchema>
export const encryptedRemoteSchema = z.object({
  id: noteIdSchema,
  authorId: noteIdSchema,
  revision: z.uuid(),
  isEncrypted: z.literal(true),
  encryptedPayload: encryptedNotePayloadSchema,
  theme: trashDraftSchema.shape.theme,
  deletedAt: z.string().nullable().optional(),
})
export type EncryptedRemote = z.infer<typeof encryptedRemoteSchema>
export type EncryptedSyncResult =
  | {status: 'success' | 'conflict'; note: EncryptedRemote}
  | {
      status:
        | 'unavailable'
        | 'retryable_error'
        | 'reload_required'
        | 'invalid_input'
        | 'disabled'
    }

export function prepareEncryptedWrite(
  payload: EncryptedNotePayload,
  revision: string | null,
  theme: EncryptedWrite['theme'],
  mutationId = crypto.randomUUID(),
) {
  return JSON.stringify(
    encryptedWriteSchema.parse({
      mode: 'encrypted',
      operation: revision === null ? 'create' : 'save',
      mutationId,
      expectedRevision: revision,
      payload,
      theme,
    }),
  )
}
export function validateEncryptedFlight(request: string, noteId: string) {
  const write = encryptedWriteSchema.parse(JSON.parse(request))
  if (write.payload.noteId !== noteId)
    throw new Error('Encrypted flight destination mismatch')
  return write
}
export async function sendEncryptedFlight(
  noteId: string,
  request: string,
  fetcher: typeof fetch = fetch,
): Promise<EncryptedSyncResult> {
  validateEncryptedFlight(request, noteId)
  try {
    const response = await fetcher(
      `/api/note-encryption/${encodeURIComponent(noteId)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-note-encryption-protocol': '1',
        },
        body: request,
        cache: 'no-store',
        credentials: 'same-origin',
      },
    )
    const result = await response.json()
    if (result.status === 'success' || result.status === 'conflict')
      return {
        status: result.status,
        note: encryptedRemoteSchema.parse(result.note),
      }
    if (
      ['unavailable', 'reload_required', 'invalid_input', 'disabled'].includes(
        result.status,
      )
    )
      return {status: result.status}
    return {status: 'retryable_error'}
  } catch {
    return {status: 'retryable_error'}
  }
}
export async function fetchEncryptedNote(
  noteId: string,
): Promise<EncryptedRemote | null> {
  const response = await fetch(
    `/api/note-encryption/${encodeURIComponent(noteId)}`,
    {cache: 'no-store', credentials: 'same-origin'},
  )
  const result = await response.json()
  return result.status === 'success'
    ? encryptedRemoteSchema.parse(result.note)
    : null
}
