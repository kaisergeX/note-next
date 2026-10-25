export const EMPTY_TRASH_PHRASES = {
  en: 'EMPTY TRASH',
  vi: 'XÓA THÙNG RÁC',
} as const

export type TrashIdentity = {id: string; deadlineToken: string}
export type TrashPreview = {count: number; snapshot: string}
export type TrashBulkResult =
  | {status: 'success'; count: number}
  | {
      status:
        | 'conflict'
        | 'account_changed'
        | 'invalid_input'
        | 'unavailable'
        | 'retryable_error'
    }
