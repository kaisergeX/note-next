'use client'

import {useRef, useState} from 'react'
import {useTranslations} from 'next-intl'
import {useRouter} from '~/i18n/navigation'
import Button from '~/components/ui/button'
import NoteCard, {NoteCardSummary} from '~/components/note/note-card'
import type {TrashItem} from '~/lib/notes/text'
import TrashActions from './trash-actions'
import ExpiryDate from './expiry-date'
import {useTrashRefresh} from './use-trash-refresh'
import TrashBulkActions from './trash-bulk-actions'
import styles from './trash-layout.module.css'
import TrashPreviewDialog from './trash-preview-dialog'

export default function TrashList({
  items,
  serverNow,
  ownerId,
}: {
  items: TrashItem[]
  serverNow: number
  ownerId: string
}) {
  const t = useTranslations('note.trash')
  const router = useRouter()
  const [removed, setRemoved] = useState<string[]>([])
  const [selected, setSelected] = useState<{item: TrashItem; request: number}>()
  const [previewOpen, setPreviewOpen] = useState(false)
  const previewRequest = useRef(0)
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
      <TrashBulkActions
        ownerId={ownerId}
        count={visible.length}
        online={online}
        onComplete={() => router.refresh()}
      />
      {!online && (
        <p role="status" className="text-ink-muted text-sm">
          {t('offline')}
        </p>
      )}
      {visible.length ? (
        <ul className={`${styles.grid} grid gap-4`}>
          {visible.map((item) => (
            <li key={`${item.id}:${item.deadlineToken}`} className="min-w-0">
              <NoteCard theme={item.theme} className="flex h-full flex-col">
                <Button
                  variant="ghost"
                  pressMotion={false}
                  className="block h-auto w-full flex-1 p-4 text-left font-normal whitespace-normal"
                  aria-label={t('previewNamed', {
                    title: item.title || t('untitled'),
                  })}
                  onClick={() => {
                    setSelected({item, request: ++previewRequest.current})
                    setPreviewOpen(true)
                  }}
                >
                  <NoteCardSummary
                    title={item.title || t('untitled')}
                    content={item.excerpt}
                    theme={item.theme}
                    plainText
                    compact
                  />
                </Button>
                <footer className="flex items-center justify-between gap-2 px-3 pt-1 pb-2">
                  <p className="text-ink-muted min-w-0 text-xs">
                    <ExpiryDate deadline={item.deadlineToken} />
                  </p>
                  <TrashActions
                    item={item}
                    compact
                    disabled={!online}
                    onComplete={() => {
                      setRemoved((previous) => [
                        ...previous,
                        `${item.id}:${item.deadlineToken}`,
                      ])
                      router.refresh()
                    }}
                  />
                </footer>
              </NoteCard>
            </li>
          ))}
        </ul>
      ) : (
        <section className="bg-dotgrid border-hairline rounded-xl border px-4 py-16 text-center">
          <h2 className="font-serif text-xl">{t('emptyTitle')}</h2>
          <p className="text-ink-muted mt-2 text-sm">{t('emptyBody')}</p>
        </section>
      )}
      {selected && (
        <TrashPreviewDialog
          key={selected.request}
          item={selected.item}
          ownerId={ownerId}
          open={previewOpen}
          online={online}
          available={visible.some(
            (item) =>
              item.id === selected.item.id &&
              item.deadlineToken === selected.item.deadlineToken,
          )}
          onClose={() => setPreviewOpen(false)}
          onComplete={() => {
            setPreviewOpen(false)
            setRemoved((previous) => [
              ...previous,
              `${selected.item.id}:${selected.item.deadlineToken}`,
            ])
            router.refresh()
          }}
        />
      )}
    </>
  )
}
