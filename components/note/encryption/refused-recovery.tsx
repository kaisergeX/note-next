'use client'

import {useEffect, useState} from 'react'
import {useTranslations} from 'next-intl'
import Button from '~/components/ui/button'
import ConfirmationDialog from '~/components/ui/confirmation-dialog'
import {openNote, openNoteTitle} from '~/lib/notes/encryption/crypto'
import {getVaultRoot} from '~/lib/notes/encryption/runtime'
import {
  fetchEncryptedNote,
  type EncryptedRemote,
} from '~/lib/notes/encryption/sync'
import {sanitizeNoteHtml} from '~/lib/notes/html'
import {noteText} from '~/lib/notes/text'
import {
  canonicalIdSchema,
  type SealedEnvelope,
} from '~/lib/notes/encryption/protocol'

export default function RefusedRecovery({
  ownerId,
  vaultId,
  creationEnabled,
  recover,
}: {
  ownerId: string
  vaultId: string
  creationEnabled: boolean
  recover: (target: EncryptedRemote | null) => Promise<void>
}) {
  const t = useTranslations('note.encryptedEditor')
  const [opened, setOpened] = useState(false)
  const [before, setBefore] = useState<string | null>(null)
  const [page, setPage] = useState<{
    rows: {id: string; label: string}[]
    next: string | null
  }>()
  const [preview, setPreview] = useState<
    {target: EncryptedRemote; html: string} | 'new' | null
  >(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!opened) return
    let active = true
    void (async () => {
      const root = getVaultRoot(ownerId, vaultId)
      if (!root) throw new Error('Vault locked')
      const response = await fetch(
        '/api/note-encryption' +
          (before ? '?before=' + encodeURIComponent(before) : ''),
        {cache: 'no-store'},
      )
      if (!response.ok) throw new Error('Destinations unavailable')
      const result = (await response.json()) as {
        notes: {
          id: string
          vaultId: string
          contentId: string
          title: SealedEnvelope
        }[]
        nextCursor: string | null
      }
      const rows = await Promise.all(
        result.notes.map(async (row) => {
          if (
            !canonicalIdSchema.safeParse(row.id).success ||
            row.vaultId !== vaultId
          )
            throw new Error('Invalid destination')
          let label = t('recoveryDamagedTitle')
          try {
            const title = await openNoteTitle(
              root,
              ownerId,
              {...row, noteId: row.id},
              {vaultId, noteId: row.id},
            )
            label = noteText(title) || t('recoveryUntitled')
          } catch {
            // A damaged title must not block healthy destinations or pagination.
          }
          return {id: row.id, label}
        }),
      )
      if (active) setPage({rows, next: result.nextCursor})
    })().catch(() => {
      if (active) setError(true)
    })
    return () => {
      active = false
    }
  }, [opened, before, ownerId, vaultId, retry, t])
  const review = async (id: string) => {
    setBusy(true)
    setError(false)
    try {
      const root = getVaultRoot(ownerId, vaultId)
      const target = await fetchEncryptedNote(id)
      if (
        !root ||
        !target ||
        target.authorId !== ownerId ||
        target.deletedAt ||
        target.pendingDeleteAt ||
        target.encryptedPayload.vaultId !== vaultId
      )
        throw new Error('Destination unavailable')
      const content = await openNote(root, ownerId, target.encryptedPayload, {
        vaultId,
        noteId: id,
      })
      if (getVaultRoot(ownerId, vaultId) !== root) return
      setPreview({
        target,
        html: sanitizeNoteHtml((content.title ?? '') + (content.content ?? '')),
      })
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="border-control-border flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="font-semibold">{t('recoverHeading')}</h2>
      <p className="text-ink-muted text-sm">{t('recoverExplanation')}</p>
      {!creationEnabled && (
        <p className="text-ink-muted text-sm">{t('recoverCreationClosed')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setPage(undefined)
            setError(false)
            setOpened(true)
            setRetry((v) => v + 1)
          }}
        >
          {t('recoverDestinations')}
        </Button>
        {creationEnabled && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setPreview('new')}
          >
            {t('recoverNew')}
          </Button>
        )}
      </div>
      {opened && !error && !page && <p role="status">{t('recoveryLoading')}</p>}
      {page && (
        <div className="flex flex-col items-start gap-2">
          {!page.rows.length && <p className="text-sm">{t('recoveryEmpty')}</p>}
          {page.rows.map((row) => (
            <Button
              key={row.id}
              variant="secondary"
              className="h-auto min-h-10 max-w-full py-2 text-left wrap-anywhere whitespace-normal"
              disabled={busy}
              onClick={() => void review(row.id)}
            >
              <span className="line-clamp-2">
                {t('reviewDestination', {title: row.label})}
              </span>
            </Button>
          ))}
          <div className="flex flex-wrap gap-2">
            {before && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setPage(undefined)
                  setError(false)
                  setBefore(null)
                }}
              >
                {t('recoveryFirst')}
              </Button>
            )}
            {page.next && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setPage(undefined)
                  setError(false)
                  setBefore(page.next)
                }}
              >
                {t('recoveryMore')}
              </Button>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {t('recoverFailed')}
        </p>
      )}
      <ConfirmationDialog
        open={Boolean(preview)}
        busy={busy}
        onRequestClose={() => setPreview(null)}
        labelledBy="recovery-confirm-title"
        describedBy="recovery-confirm-description"
      >
        <h2 id="recovery-confirm-title" className="mb-3 text-lg font-semibold">
          {t(preview === 'new' ? 'recoverNew' : 'recoverConfirm')}
        </h2>
        <p id="recovery-confirm-description" className="mb-4 text-sm">
          {t(
            preview === 'new'
              ? 'recoverNewExplanation'
              : 'recoverConfirmExplanation',
          )}
        </p>
        {preview && preview !== 'new' && (
          <div
            className="prose prose-appearance mb-4 max-w-none wrap-anywhere"
            dangerouslySetInnerHTML={{__html: preview.html}}
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            data-cancel
            variant="secondary"
            disabled={busy}
            onClick={() => setPreview(null)}
          >
            {t('recoverCancel')}
          </Button>
          <Button
            disabled={busy || !preview}
            onClick={() => {
              if (!preview || busy) return
              setBusy(true)
              setError(false)
              void recover(preview === 'new' ? null : preview.target)
                .then(() => setPreview(null))
                .catch(() => {
                  setPreview(null)
                  setError(true)
                })
                .finally(() => setBusy(false))
            }}
          >
            {t(preview === 'new' ? 'recoverCreateAndSync' : 'recoverStage')}
          </Button>
        </div>
      </ConfirmationDialog>
    </section>
  )
}
