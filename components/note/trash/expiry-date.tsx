'use client'
import {useSyncExternalStore} from 'react'
import {useFormatter, useTranslations} from 'next-intl'
const subscribe = () => () => {}
export default function ExpiryDate({deadline}: {deadline: string}) {
  const format = useFormatter()
  const t = useTranslations('note.trash')
  const timeZone = useSyncExternalStore(
    subscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => 'UTC',
  )
  const date = format.dateTime(new Date(deadline), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  })
  return <time dateTime={deadline}>{t('expires', {date})}</time>
}
