import {IconNotes, IconSparkles} from '@tabler/icons-react'

export type AppNavigationLabels = {
  navigation: string
  notes: string
  ai: string
}

export function getAppNavigation(labels: AppNavigationLabels) {
  return [
    {href: '/eton', label: labels.notes, Icon: IconNotes},
    {href: '/ai/interview', label: labels.ai, Icon: IconSparkles},
  ]
}

export function isNoteCollectionPath(path: string) {
  return (
    path === '/eton' ||
    path === '/collection/drafts' ||
    path === '/collection/browser-work' ||
    path === '/collection/trash'
  )
}

export function isNavigationActive(path: string, href: string) {
  return (
    (href === '/eton' && path.startsWith('/collection/')) ||
    path === href ||
    path.startsWith(`${href}/`)
  )
}
