'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import {useLocale, useTranslations} from 'next-intl'
import {
  IconDeviceLaptop,
  IconLock,
  IconLockOpen,
  IconPlus,
} from '@tabler/icons-react'
import Button from '~/components/ui/button'
import LoadingIndicator from '~/components/ui/loading-indicator'
import NoteCard from '~/components/note/note-card'
import NoteMasonry from '~/components/note/note-masonry'
import {noteText} from '~/lib/notes/text'
import {openNoteTitle} from '~/lib/notes/encryption/crypto'
import {
  canonicalIdSchema,
  vaultWrapperSchema,
  type SealedEnvelope,
} from '~/lib/notes/encryption/protocol'
import {
  cacheConfirmedVault,
  getCachedVault,
  listEncryptedRecovery,
  type RecoveryHeader,
} from '~/lib/notes/encryption/storage'
import {
  currentVaultEpoch,
  discardBlockedEdits,
  getVaultRoot,
  lockVault,
  useLockState,
  useVaultUnlocked,
  type ConfirmedVault,
} from '~/lib/notes/encryption/runtime'
import type {NoteTheme} from '~/db/schema/notes'
import VaultControls from './vault-controls'
import EncryptedEditor from './encrypted-editor'

type Header = {
  id: string
  vaultId: string
  contentId: string
  title: SealedEnvelope
  theme?: NoteTheme | null
}
type Row = {id: string; label: string; theme?: NoteTheme | null}
type Selected = {
  noteId: string
  creating?: boolean
  readOnly?: boolean
  recordId?: string
  focusOnOpen?: boolean
}
const noLayout = () => {}

function EncryptedList({
  ownerId,
  vaultId,
  unlocked,
  select,
  requestUnlock,
}: {
  ownerId: string
  vaultId: string
  unlocked: boolean
  select: (value: Selected, opener: HTMLButtonElement) => void
  requestUnlock: () => void
}) {
  const t = useTranslations('note.encryption')
  const locale = useLocale()
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  const [page, setPage] = useState<{
    rows: Row[]
    next: string | null
  }>()
  const [local, setLocal] = useState<RecoveryHeader[]>([])
  const [offset, setOffset] = useState(0)
  const [before, setBefore] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const list = useRef<HTMLUListElement>(null)
  useEffect(() => {
    let active = true
    void listEncryptedRecovery(ownerId, offset, 50)
      .then((records) => {
        if (active) setLocal(records)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [ownerId, offset, retry])
  useEffect(() => {
    let active = true
    async function load() {
      const res = await fetch(
        '/api/note-encryption' +
          (before ? '?before=' + encodeURIComponent(before) : ''),
        {cache: 'no-store'},
      )
      if (!res.ok) throw new Error('Read failed')
      const {notes, nextCursor} = (await res.json()) as {
        notes: Header[]
        nextCursor: string | null
      }
      const root = getVaultRoot(ownerId, vaultId)
      const rows = await Promise.all(
        notes.map(async (row) => {
          if (
            !canonicalIdSchema.safeParse(row.id).success ||
            row.vaultId !== vaultId
          )
            throw new Error('Invalid header')
          let label = t('lockedNote')
          if (root) {
            try {
              label =
                noteText(
                  await openNoteTitle(
                    root,
                    ownerId,
                    {...row, noteId: row.id},
                    {vaultId, noteId: row.id},
                  ),
                ) || t('untitled')
            } catch {
              label = t('damagedTitle')
            }
          }
          return {id: row.id, label, theme: row.theme ?? null}
        }),
      )
      if (active) setPage({rows, next: nextCursor})
    }
    void load().catch(() => {
      if (active) setError(true)
    })
    return () => {
      active = false
    }
  }, [ownerId, vaultId, before, retry, t])
  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
          <p>{t('listFailed')}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setError(false)
              setRetry((value) => value + 1)
            }}
          >
            {t('retry')}
          </Button>
        </div>
      )}
      {page ? (
        page.rows.length ? (
          <section aria-label={t('synced')} className="space-y-3">
            <h2 className="text-ink-muted text-sm font-medium">
              {t('synced')}
            </h2>
            <NoteMasonry
              ids={page.rows.map((row) => row.id)}
              listRef={list}
              onLayout={noLayout}
              renderCard={(id) => {
                const row = page.rows.find((item) => item.id === id)!
                const label = unlocked ? row.label : t('lockedNote')
                return (
                  <NoteCard theme={row.theme} className="relative min-h-24">
                    <div className="p-4">
                      <p className="flex items-start gap-2 font-serif text-lg font-semibold wrap-anywhere">
                        <IconLock
                          size={17}
                          className="text-ink-muted mt-1 shrink-0"
                          aria-hidden
                        />
                        {label}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      data-note-id={id}
                      className="absolute inset-0 h-full w-full rounded-lg hover:bg-transparent"
                      aria-label={unlocked ? label : t('openLocked')}
                      onClick={(event) =>
                        unlocked
                          ? select(
                              {
                                noteId: id,
                                focusOnOpen: event.detail === 0,
                              },
                              event.currentTarget,
                            )
                          : requestUnlock()
                      }
                    />
                  </NoteCard>
                )
              }}
            />
            <div className="flex flex-wrap gap-2">
              {page.next && (
                <Button
                  variant="secondary"
                  onClick={() => setBefore(page.next)}
                >
                  {t('next')}
                </Button>
              )}
              {before && (
                <Button variant="ghost" onClick={() => setBefore(null)}>
                  {t('first')}
                </Button>
              )}
            </div>
          </section>
        ) : (
          <p
            role="status"
            className="text-ink-muted py-10 text-center font-serif"
          >
            {t('none')}
          </p>
        )
      ) : (
        <LoadingIndicator label={t('loading')} />
      )}
      {(local.length > 0 || offset > 0) && (
        <section className="space-y-2">
          <h2 className="text-ink-muted flex items-center gap-2 text-sm font-medium">
            <IconDeviceLaptop size={16} aria-hidden />
            {t('local')}
          </h2>
          <ul className="divide-hairline divide-y">
            {local.map((row) => (
              <li key={row.id}>
                <Button
                  variant="link"
                  onClick={(event) =>
                    unlocked
                      ? select(
                          {
                            noteId: row.stableNoteId,
                            recordId: row.id,
                            focusOnOpen: event.detail === 0,
                          },
                          event.currentTarget,
                        )
                      : requestUnlock()
                  }
                >
                  {t('localVersion', {
                    date: dateFormat.format(row.updatedAt),
                  })}
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {offset > 0 && (
              <Button variant="ghost" onClick={() => setOffset(offset - 50)}>
                {t('previous')}
              </Button>
            )}
            {local.length === 50 && (
              <Button
                variant="secondary"
                onClick={() => setOffset(offset + 50)}
              >
                {t('next')}
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

export default function EncryptedWorkspace({
  ownerId,
  initial,
  enrollmentEnabled = false,
  creationEnabled = false,
  onClose,
}: {
  ownerId: string
  initial?: Selected
  enrollmentEnabled?: boolean
  creationEnabled?: boolean
  onClose?: () => void
}) {
  const t = useTranslations('note.encryption')
  const vaultText = useTranslations('note.vault')
  const [vault, setVault] = useState<ConfirmedVault | null>()
  const [selected, select] = useState(initial)
  const [failed, setFailed] = useState(false)
  const [offline, setOffline] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [unlockFocus, setUnlockFocus] = useState(0)
  const alive = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const unlocked = useVaultUnlocked(ownerId, vault?.id ?? '')
  const state = useLockState(ownerId)
  const refresh = useCallback(
    async (requireOnline = false) => {
      let res: Response
      try {
        res = await fetch('/api/note-vault', {cache: 'no-store'})
      } catch (error) {
        if (requireOnline) throw error
        const cached = await getCachedVault(ownerId)
        if (!cached) throw error
        if (alive.current) {
          setVault(cached)
          setOffline(true)
          setFailed(false)
        }
        return cached
      }
      if (!res.ok) throw new Error('Vault unavailable')
      const {
        status,
        vault: row,
      }: {status: string; vault: ConfirmedVault | null} = await res.json()
      if (status !== 'success') throw new Error('Vault unavailable')
      if (row !== null) {
        const primary = vaultWrapperSchema.parse(row.primaryWrapper),
          recovery = vaultWrapperSchema.parse(row.recoveryWrapper)
        if (
          row.ownerId !== ownerId ||
          primary.ownerId !== ownerId ||
          recovery.ownerId !== ownerId ||
          primary.vaultId !== row.id ||
          recovery.vaultId !== row.id ||
          primary.purpose === 'recovery' ||
          recovery.purpose !== 'recovery'
        )
          throw new Error('Invalid vault')
        await cacheConfirmedVault({
          id: row.id,
          ownerId,
          revision: row.revision,
          setupId: row.setupId,
          lastOperationId: row.lastOperationId,
          authorizationVersion: row.authorizationVersion ?? 0,
          authorization: row.authorization ?? null,
          primaryWrapper: primary,
          recoveryWrapper: recovery,
        })
      }
      if (alive.current) {
        setVault(row)
        setOffline(false)
        setFailed(false)
      }
      return row
    },
    [ownerId],
  )
  useEffect(() => {
    alive.current = true
    const read = () =>
      void refresh().catch(() => {
        if (alive.current) setFailed(true)
      })
    read()
    window.addEventListener('online', read)
    return () => {
      alive.current = false
      window.removeEventListener('online', read)
    }
  }, [refresh])
  const close = () => {
    if (onClose) {
      onClose()
      return
    }
    const focus = opener.current
    opener.current = null
    select(undefined)
    requestAnimationFrame(() => {
      const target = focus?.isConnected ? focus : heading.current
      target?.focus()
    })
  }
  const open = (value: Selected, trigger: HTMLButtonElement) => {
    opener.current = trigger
    select(value)
  }
  const create = () => {
    opener.current = null
    select({noteId: crypto.randomUUID(), creating: true, focusOnOpen: true})
  }
  const requestUnlock = () => setUnlockFocus((value) => value + 1)
  const opened = Boolean(selected)
  return (
    <section
      className={
        vault
          ? 'bg-paper text-ink mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6'
          : 'bg-paper text-ink mx-auto w-full max-w-5xl px-4 pt-6 pb-14 sm:px-6'
      }
    >
      {vault && (
        <>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1
                ref={heading}
                tabIndex={-1}
                className="font-serif text-2xl font-normal tracking-tight outline-none sm:text-3xl"
              >
                {t('heading')}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!opened && unlocked && creationEnabled && (
                <Button onClick={create}>
                  <IconPlus size={18} aria-hidden /> {t('create')}
                </Button>
              )}
              {opened && !unlocked && (
                <Button variant="ghost" onClick={close}>
                  {t('back')}
                </Button>
              )}
            </div>
          </header>
          <div className="border-hairline flex min-w-0 flex-wrap items-center justify-between gap-x-3 border-b pb-2">
            <p
              role="status"
              className="text-ink-muted flex items-center gap-2 text-sm"
            >
              {unlocked ? (
                <IconLockOpen size={16} aria-hidden />
              ) : (
                <IconLock size={16} aria-hidden />
              )}
              {state === 'locking'
                ? t('locking')
                : unlocked
                  ? t('collectionUnlocked')
                  : t('collectionLocked')}
            </p>
            {unlocked && (
              <Button
                variant="ghost"
                disabled={state === 'locking'}
                onClick={() => void lockVault(ownerId)}
              >
                {vaultText('lock')}
              </Button>
            )}
          </div>
        </>
      )}
      {state === 'blocked' ? (
        <div role="alert" className="space-y-3">
          <p>{t('blocked')}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void lockVault(ownerId, false)}>
              {t('retry')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (discard) {
                  discardBlockedEdits(ownerId)
                  setDiscard(false)
                } else setDiscard(true)
              }}
            >
              {t(discard ? 'confirmDiscard' : 'discard')}
            </Button>
          </div>
        </div>
      ) : failed ? (
        <div role="alert" className="flex flex-wrap items-center gap-2">
          <p>{t('loadFailed')}</p>
          <Button
            variant="secondary"
            onClick={() => void refresh().catch(() => setFailed(true))}
          >
            {t('retry')}
          </Button>
        </div>
      ) : vault === undefined ? (
        <LoadingIndicator label={t('loading')} />
      ) : (
        <>
          {offline && <p role="status">{t('offline')}</p>}
          <VaultControls
            ownerId={ownerId}
            vault={vault}
            enrollmentEnabled={enrollmentEnabled && !offline}
            onRefresh={refresh}
            onActivated={() =>
              requestAnimationFrame(() => heading.current?.focus())
            }
            focusRequest={unlockFocus}
          />
          {vault &&
            (selected ? (
              unlocked && vault ? (
                <EncryptedEditor
                  key={selected.recordId ?? selected.noteId}
                  ownerId={ownerId}
                  vaultId={vault.id}
                  {...selected}
                  creationEnabled={creationEnabled}
                  onRecover={select}
                  onClose={close}
                />
              ) : (
                <p>{t('unlockToOpen')}</p>
              )
            ) : (
              <EncryptedList
                key={String(unlocked) + currentVaultEpoch()}
                ownerId={ownerId}
                vaultId={vault.id}
                unlocked={unlocked}
                select={open}
                requestUnlock={requestUnlock}
              />
            ))}
        </>
      )}
    </section>
  )
}
