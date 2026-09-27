/**
 * Ids are generate_ulid() output (timestamp || random bits, ::uuid cast) —
 * NOT RFC variant-strict (variant nibble is arbitrary, e.g. `...-745a-...`).
 * So no z.uuid(); any 8-4-4-4-12 hex shape passes, matching the plain-string
 * treatment of these ids in the DB helpers and server actions.
 */
export const ULID_SHAPE_UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export function isShapedUuid(value: string): boolean {
  return ULID_SHAPE_UUID.test(value)
}
