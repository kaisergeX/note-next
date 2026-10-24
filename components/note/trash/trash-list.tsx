'use client'

import {useState} from 'react'
import {useTranslations} from 'next-intl'
import {Link, useRouter} from '~/i18n/navigation'
import type {TrashItem} from '~/lib/notes/text'
import TrashActions from './trash-actions'
import ExpiryDate from './expiry-date'
import {useTrashRefresh} from './use-trash-refresh'

export default function TrashList({
  items,
  serverNow,
}: {
  items: TrashItem[]
  serverNow: number
}) {
  const t = useTranslations('note.trash')
  const router = useRouter()
  const [removed, setRemoved] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const {now, online} = useTrashRefresh(
    serverNow,
    items.map((item) => item.deadlineToken),
  )
  const visible = items.filter(
    (item) =>
      Date.parse(item.deadlineToken) > now &&
      !removed.includes(`${item.id}:${item.deadlineToken}`),
  )
  return (
    <>
      <p role="status" className="text-ink-muted text-sm">
        {!online ? t('offline') : status}
      </p>
      {visible.length ? (
        <ul className="divide-hairline border-hairline divide-y border-y">
          {visible.map((item) => (
            <li
              key={`${item.id}:${item.deadlineToken}`}
              className="flex flex-col justify-between gap-4 py-5 sm:flex-row"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Link
                  href={`/trash/${item.id}`}
                  className="text-ink focus-visible:outline-accent inline-flex min-h-10 items-center font-serif text-xl wrap-anywhere hover:underline focus-visible:outline-2"
                >
                  {item.title || t('untitled')}
                </Link>
                {item.excerpt && (
                  <p className="text-ink-muted line-clamp-2 text-sm wrap-anywhere">
                    {item.excerpt}
                  </p>
                )}
                <p className="text-ink-muted text-xs">
                  <ExpiryDate deadline={item.deadlineToken} />
                </p>
              </div>
              <TrashActions
                item={item}
                disabled={!online}
                onComplete={() => {
                  setRemoved((previous) => [
                    ...previous,
                    `${item.id}:${item.deadlineToken}`,
                  ])
                  setStatus(t('completed'))
                  router.refresh()
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <section className="bg-dotgrid border-hairline rounded-xl border px-4 py-16 text-center">
          <h2 className="font-serif text-xl">{t('emptyTitle')}</h2>
          <p className="text-ink-muted mt-2 text-sm">{t('emptyBody')}</p>
        </section>
      )}
    </>
  )
}
