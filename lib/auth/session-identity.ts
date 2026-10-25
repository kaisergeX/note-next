/** Legacy email-only tokens must sign in again; never attach them to a new ID. */
export function matchesSessionUser(
  userId: unknown,
  user: {id: string} | null | undefined,
) {
  return typeof userId === 'string' && !!user && userId === user.id
}
