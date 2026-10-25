export const DELETE_VERIFICATION_SECONDS = 5 * 60

export function hasFreshDeleteVerification(
  verifiedAt: unknown,
  now = Date.now(),
) {
  return (
    typeof verifiedAt === 'number' &&
    Number.isFinite(verifiedAt) &&
    verifiedAt <= now &&
    now - verifiedAt < DELETE_VERIFICATION_SECONDS * 1000
  )
}
