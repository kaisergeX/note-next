export const USER_CACHE_KEY_PART = 'user'

export function getUserCacheKey(email: string): string {
  return `${USER_CACHE_KEY_PART}-${email}`
}

export function getUserRoleCacheKey(email: string): string {
  return `${USER_CACHE_KEY_PART}-${email}-role`
}

export const NOTE_CACHE_KEY_PART = 'note'
// const NOTE_CACHE_REVALIDATE_TIME = safeAnyToNumber(
//   process.env.NOTE_CACHE_REVALIDATE_TIME,
//   10 * 60, // 10 mins
// ).result

export function getNoteCacheKey(ownerId: string, noteId: string): string {
  return `${NOTE_CACHE_KEY_PART}-${ownerId}-${noteId}`
}

export function getNoteListCacheKey(ownerId: string): string {
  return `${NOTE_CACHE_KEY_PART}-list-${ownerId}`
}

export function getNoteTrashCacheKey(ownerId: string): string {
  return `${NOTE_CACHE_KEY_PART}-trash-${ownerId}`
}

export function getNoteMutationCacheKeys(ownerId: string, noteId: string) {
  return [
    getNoteListCacheKey(ownerId),
    getNoteTrashCacheKey(ownerId),
    getNoteCacheKey(ownerId, noteId),
  ]
}
