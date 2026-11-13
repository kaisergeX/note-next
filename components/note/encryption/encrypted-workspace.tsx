'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import {useTranslations} from 'next-intl'
import Button, {buttonClass} from '~/components/ui/button'
import LoadingIndicator from '~/components/ui/loading-indicator'
import {Link} from '~/i18n/navigation'
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
import VaultControls from './vault-controls'
import EncryptedEditor from './encrypted-editor'

type Header = {
  id: string
  vaultId: string
  contentId: string
  title: SealedEnvelope
}
type Selected = {
  noteId: string
  creating?: boolean
  readOnly?: boolean
  recordId?: string
}

function EncryptedList({
  ownerId,
  vaultId,
  select,
  creationEnabled,
  unlocked,
}: {
  ownerId: string
  vaultId: string
  select: (value: Selected) => void
  creationEnabled: boolean
  unlocked: boolean
}) {
  const t = useTranslations('note.encryption')
  const [page, setPage] = useState<{
    rows: {id: string; label: string}[]
    next: string | null
  }>()
  const [local, setLocal] = useState<RecoveryHeader[]>([])
  const [offset, setOffset] = useState(0)
  const [before, setBefore] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
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
          return {id: row.id, label}
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
      {creationEnabled && unlocked && (
        <Button
          onClick={() => select({noteId: crypto.randomUUID(), creating: true})}
        >
          {t('create')}
        </Button>
      )}
      {error && (
        <div role="alert">
          <p>{t('listFailed')}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setError(false)
              setRetry((x) => x + 1)
            }}
          >
            {t('retry')}
          </Button>
        </div>
      )}
      {page && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">{t('synced')}</h2>
          {page.rows.length ? (
            <ul className="divide-hairline divide-y">
              {page.rows.map((row) => (
                <li key={row.id}>
                  <Button
                    variant="link"
                    className="min-h-10 max-w-full text-left whitespace-normal"
                    onClick={() => select({noteId: row.id})}
                  >
                    {row.label}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('none')}</p>
          )}
          {page.next && (
            <Button variant="secondary" onClick={() => setBefore(page.next)}>
              {t('next')}
            </Button>
          )}
          {before && (
            <Button variant="ghost" onClick={() => setBefore(null)}>
              {t('first')}
            </Button>
          )}
        </section>
      )}
      {(local.length > 0 || offset > 0) && (
        <section>
          <h2 className="text-lg font-semibold">{t('local')}</h2>
          <ul>
            {local.map((row) => (
              <li key={row.id}>
                <Button
                  variant="link"
                  onClick={() =>
                    select({noteId: row.stableNoteId, recordId: row.id})
                  }
                >
                  {t('localVersion', {
                    date: new Date(row.updatedAt).toLocaleString(),
                  })}
                </Button>
              </li>
            ))}
          </ul>
          {offset > 0 && (
            <Button variant="ghost" onClick={() => setOffset(offset - 50)}>
              {t('previous')}
            </Button>
          )}
          {local.length === 50 && (
            <Button variant="secondary" onClick={() => setOffset(offset + 50)}>
              {t('next')}
            </Button>
          )}
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
  const [vault, setVault] = useState<ConfirmedVault | null>()
  const [selected, select] = useState(initial)
  const [failed, setFailed] = useState(false)
  const [offline, setOffline] = useState(false)
  const [discard, setDiscard] = useState(false)
  const alive = useRef(false)
  const unlocked = useVaultUnlocked(ownerId, vault?.id ?? '')
  const state = useLockState(ownerId)
  const refresh = useCallback(async () => {
    let res: Response
    try {
      res = await fetch('/api/note-vault', {cache: 'no-store'})
    } catch (error) {
      const cached = await getCachedVault(ownerId)
      if (!cached) throw error
      if (alive.current) {
        setVault(cached)
        setOffline(true)
        setFailed(false)
      }
      return
    }
    if (!res.ok) throw new Error('Vault unavailable')
    const {status, vault: row} = await res.json()
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
        primaryWrapper: primary,
        recoveryWrapper: recovery,
      })
    }
    if (alive.current) {
      setVault(row)
      setOffline(false)
      setFailed(false)
    }
  }, [ownerId])
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
    if (onClose) onClose()
    else select(undefined)
  }
  return (
    <section className="bg-paper text-ink mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl">{t('heading')}</h1>
        {!selected && (
          <Link href="/eton" className={buttonClass({variant: 'ghost'})}>
            {t('collection')}
          </Link>
        )}
      </header>
      {state === 'locking' ? (
        <p role="status">{t('locking')}</p>
      ) : state === 'blocked' ? (
        <div role="alert" className="space-y-3">
          <p>{t('blocked')}</p>
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
      ) : failed ? (
        <div role="alert">
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
          />
          {vault &&
            (selected ? (
              unlocked ? (
                <EncryptedEditor
                  key={selected.recordId ?? selected.noteId}
                  ownerId={ownerId}
                  vaultId={vault.id}
                  {...selected}
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
                select={select}
                unlocked={unlocked}
                creationEnabled={creationEnabled}
              />
            ))}
          {selected && !unlocked && (
            <Button variant="secondary" onClick={close}>
              {t('back')}
            </Button>
          )}
        </>
      )}
    </section>
  )
}
