import {z} from 'zod'
import {noteIdSchema, trashDraftSchema} from '../validation'
import {validateEncryptedFlight} from './sync'

export const RECOVERY_DECODED_LIMIT = 8 * 1024 * 1024
export const RECOVERY_STORED_LIMIT = 12 * 1024 * 1024
export const recoveryRouteSchema = z
  .strictObject({
    ownerId: noteIdSchema,
    vaultId: z.uuid(),
    stableNoteId: noteIdSchema,
    recordId: z.uuid(),
    generation: z.number().int().nonnegative(),
    capturedEpoch: z.number().int().nonnegative(),
    mode: z.literal('encrypted'),
    noteId: noteIdSchema.nullable(),
    creationId: z.uuid(),
    sourceNoteId: noteIdSchema.nullable(),
    sourceEpoch: z.number().int().nonnegative().nullable(),
    flightDestination: noteIdSchema.nullable(),
    mutationId: z.uuid().nullable(),
    expectedRevision: z.uuid().nullable(),
  })
  .refine((r) => r.stableNoteId === (r.noteId ?? r.creationId))
  .refine((r) => (r.sourceNoteId === null) === (r.sourceEpoch === null))
  .refine(
    (r) =>
      r.flightDestination === null || r.flightDestination === r.stableNoteId,
  )
export type RecoveryRoute = z.infer<typeof recoveryRouteSchema>

// Versions are separate records, never a recursively embedded history.
export const recoveryPayloadSchema = z
  .strictObject({
    version: z.literal(1),
    route: recoveryRouteSchema,
    baseline: trashDraftSchema.nullable(),
    // Absent in checkpoints from the editor that aliased baseline and draft.
    baselineVerified: z.literal(true).optional(),
    draft: trashDraftSchema,
    conflict: trashDraftSchema.nullable(),
    conflictRevision: z.uuid().nullable().optional(),
    flight: z
      .strictObject({
        destination: noteIdSchema,
        mutationId: z.uuid(),
        expectedRevision: z.uuid().nullable(),
        // Exact serialized encrypted request, including its immutable envelope.
        request: z.string().max(1_500_000),
      })
      .nullable(),
    resolution: z.literal('mine').nullable(),
    authenticationRequired: z.literal(true).optional(),
    refusal: z
      .enum(['unavailable', 'disabled', 'invalid_input', 'reload_required'])
      .optional(),
  })
  .superRefine((record, ctx) => {
    const flight = record.flight
    if (
      flight &&
      (flight.destination !== record.route.flightDestination ||
        flight.mutationId !== record.route.mutationId ||
        flight.expectedRevision !== record.route.expectedRevision)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Recovery flight routing mismatch',
      })
    if (
      !flight &&
      (record.route.flightDestination !== null ||
        record.route.mutationId !== null)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Unexpected recovery flight routing',
      })
  })
export type RecoveryPayload = z.infer<typeof recoveryPayloadSchema>

export function hasPendingEncryptedEdits(record: RecoveryPayload) {
  return Boolean(
    record.flight ||
    !record.baseline ||
    record.draft.title !== record.baseline.title ||
    record.draft.content !== record.baseline.content ||
    record.draft.theme !== record.baseline.theme,
  )
}

export function sameRecoveryRoute(a: RecoveryRoute, b: RecoveryRoute) {
  return (
    Object.keys(recoveryRouteSchema.shape) as (keyof RecoveryRoute)[]
  ).every((key) => a[key] === b[key])
}

export function prepareRecoveryPayload(value: unknown, outer: RecoveryRoute) {
  const record = recoveryPayloadSchema.parse(value)
  if (!sameRecoveryRoute(record.route, recoveryRouteSchema.parse(outer)))
    throw new Error('Recovery routing mismatch')
  if (record.flight) {
    const write = validateEncryptedFlight(
      record.flight.request,
      record.flight.destination,
    )
    if (
      write.mutationId !== record.flight.mutationId ||
      write.expectedRevision !== record.flight.expectedRevision ||
      write.payload.vaultId !== record.route.vaultId
    )
      throw new Error('Recovery flight payload mismatch')
  }
  const serialized = new TextEncoder().encode(JSON.stringify(record))
  if (serialized.byteLength > RECOVERY_DECODED_LIMIT)
    throw new Error('Recovery record exceeds storage limit')
  return {record, serialized}
}

export function validateRecoveryPayload(value: unknown, outer: RecoveryRoute) {
  return prepareRecoveryPayload(value, outer).record
}

/** A single tab-wide loop: one active seal and one newest pending per note. */
export class RecoverySealQueue {
  private pending = new Map<string, () => Promise<void>>()
  private running: Promise<void> | null = null
  enqueue(noteId: string, seal: () => Promise<void>) {
    this.pending.set(noteId, seal)
    this.running ??= this.run().finally(() => {
      this.running = null
    })
    return this.running
  }
  private async run() {
    const failures: unknown[] = []
    while (this.pending.size) {
      const [id, seal] = this.pending.entries().next().value!
      this.pending.delete(id)
      try {
        await seal()
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length) throw failures[0]
  }
  async flush() {
    await this.running
  }
  get queuedNotes() {
    return this.pending.size
  }
}
