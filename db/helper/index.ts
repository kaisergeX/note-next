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

export function getNoteCacheKey(noteId: string): string {
  return `${NOTE_CACHE_KEY_PART}-${noteId}`
}

export function getNoteListCacheKey(email: string): string {
  return `${NOTE_CACHE_KEY_PART}-list-${email}`
}
