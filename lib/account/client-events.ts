export const ACCOUNT_EVENT_KEY = 'etoN-account-data-event'

export type AccountDataEvent = {
  ownerId: string
  type: 'notes-trashed' | 'account-deleted' | 'trash-updated'
}

export function publishAccountDataEvent(event: AccountDataEvent) {
  try {
    localStorage.setItem(
      ACCOUNT_EVENT_KEY,
      JSON.stringify({...event, nonce: crypto.randomUUID()}),
    )
  } catch {
    // Server-side ownership/lifecycle checks still protect disconnected tabs.
  }
}

export function clearDeletedAccountBrowserData(email: string) {
  try {
    localStorage.removeItem(`etoN-appearance-account:${email}`)
    sessionStorage.removeItem('etoN-appearance-session-account')
  } catch {
    /* Storage may be unavailable. */
  }
}
