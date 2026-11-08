import {localeRouting} from '~/i18n/routing'

/** A known parent screen for direct visits to missing pages. */
export function parentPagePath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const locale = localeRouting.locales.find((value) => value === segments[0])
  if (locale) segments.shift()
  const path = `/${segments.join('/')}`
  let parent = '/'

  if (
    /^\/(?:full\/)?eton(?:\/|$)/.test(path) ||
    path.startsWith('/collection/')
  ) {
    parent = '/eton'
  } else if (path.startsWith('/ai/interview/runs/')) {
    parent = '/ai/interview/runs'
  } else if (path.startsWith('/ai/interview/')) {
    const [, , , id, child] = path.split('/')
    parent =
      child && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)
        ? `/ai/interview/${id}`
        : '/ai/interview'
  } else if (path.startsWith('/settings/')) {
    parent = '/settings'
  }

  return `${locale ? `/${locale}` : ''}${parent}`
}
