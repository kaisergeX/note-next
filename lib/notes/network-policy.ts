// Covers localized HTML, RSC requests (same path + query), and old .html/.rsc keys.
export function isNoteNetworkPath(pathname: string) {
  return /^\/(?:api\/(?:note(?:[/.]|$)|cron\/note-cleanup(?:[/.]|$))|(?:(?:en|vi)\/)?(?:eton|trash|full\/eton)(?:[/.]|$))/.test(
    pathname,
  )
}

export function isAccountNetworkPath(pathname: string) {
  return /^\/(?:api\/(?:auth|user)(?:[/.]|$)|(?:(?:en|vi)\/)?(?:settings\/account|user\/info)(?:[/.]|$))/.test(
    pathname,
  )
}

// Build manifests can include unresolved App Router templates; those return 404
// and would reject the entire worker install. Keep concrete, public assets only.
export function isPrecacheablePath(pathname: string) {
  return (
    !isNoteNetworkPath(pathname) &&
    !isAccountNetworkPath(pathname) &&
    !/\[|\]|%5b|%5d/i.test(pathname)
  )
}
