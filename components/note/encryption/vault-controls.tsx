'use client'

import {useEffect, useRef, useState} from 'react'
import {useTranslations} from 'next-intl'
import Button from '~/components/ui/button'
import {Input} from '~/components/ui/input'
import {assertPasskey, enrollPasskey} from '~/lib/notes/encryption/passkey'
import {
  createVaultCandidate,
  verifyCandidate,
  vaultCandidateSchema,
  type VaultCandidate,
} from '~/lib/notes/encryption/candidate'
import {
  decodeRecoveryKey,
  generatePassphrase,
  generatePassphraseSalt,
  importRoot,
  unwrapRoot,
  wrapRoot,
} from '~/lib/notes/encryption/crypto'
import {
  activateVault,
  currentVaultEpoch,
  lockVault,
  useVaultUnlocked,
  type ConfirmedVault,
} from '~/lib/notes/encryption/runtime'
import {
  canonicalIdSchema,
  vaultWrapperSchema,
} from '~/lib/notes/encryption/protocol'
import {z} from 'zod'
const replacementSchema = z.strictObject({
  operationId: canonicalIdSchema,
  expectedRevision: canonicalIdSchema,
  primaryWrapper: vaultWrapperSchema,
  submitted: z.boolean(),
})

export function VaultControls({
  ownerId,
  vault,
  enrollmentEnabled,
  onRefresh,
}: {
  ownerId: string
  vault: ConfirmedVault | null
  enrollmentEnabled: boolean
  onRefresh: () => Promise<void>
}) {
  const t = useTranslations('note.vault')
  const [candidate, setCandidate] = useState<VaultCandidate | null>(null)
  const [phrase, setPhrase] = useState(''),
    [kit, setKit] = useState(''),
    [entry, setEntry] = useState('')
  const [recovery, setRecovery] = useState(false),
    [reveal, setReveal] = useState(false)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const [replacement, setReplacement] = useState<{
    operationId: string
    expectedRevision: string
    primaryWrapper: ConfirmedVault['primaryWrapper']
    submitted: boolean
  } | null>(null)
  const active = useVaultUnlocked(ownerId, vault?.id ?? '')
  const generation = useRef(0),
    inFlight = useRef(false)
  const storageKey = `eton-provisional-vault:${ownerId}`
  function save(next: VaultCandidate) {
    sessionStorage.setItem(storageKey, JSON.stringify(next))
    setCandidate(next)
  }
  useEffect(() => {
    let disposed = false
    const versionCounter = generation
    queueMicrotask(() => {
      if (disposed) return
      setCandidate(null)
      setReplacement(null)
      setEntry('')
      setPhrase('')
      setKit('')
      setReveal(false)
      try {
        const stored = sessionStorage.getItem(storageKey)
        if (stored) {
          const value = vaultCandidateSchema.parse(JSON.parse(stored))
          if (value.ownerId === ownerId) setCandidate(value)
        }
        const savedReplacement = sessionStorage.getItem(
          `${storageKey}:replacement`,
        )
        if (savedReplacement) {
          const value = replacementSchema.parse(JSON.parse(savedReplacement))
          if (value.primaryWrapper.ownerId === ownerId) setReplacement(value)
        }
      } catch {
        setError(t('storageError'))
      }
    })
    function clear() {
      if (!document.hidden) return
      clearSecrets()
    }
    function invalidate(event: Event) {
      if ((event as CustomEvent<string>).detail === ownerId) clearSecrets()
    }
    function clearSecrets() {
      generation.current++
      setPhrase('')
      setKit('')
      setEntry('')
      setReveal(false)
    }
    document.addEventListener('visibilitychange', clear)
    window.addEventListener('eton-vault-invalidated', invalidate)
    return () => {
      disposed = true
      versionCounter.current++
      document.removeEventListener('visibilitychange', clear)
      window.removeEventListener('eton-vault-invalidated', invalidate)
    }
  }, [ownerId, storageKey, t])
  async function run(work: (version: number) => Promise<void>) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await work(generation.current)
    } catch {
      setError(t('failed'))
    } finally {
      inFlight.current = false
      setBusy(false)
      setEntry('')
    }
  }
  function check(version: number) {
    if (generation.current !== version || document.hidden)
      throw new Error('Interrupted')
  }
  async function request(method: 'POST' | 'PATCH', body: unknown) {
    const response = await fetch('/api/note-vault', {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-note-encryption-protocol': '1',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const result = (await response.json()) as {
      status: string
      vault?: ConfirmedVault
    }
    return result
  }
  const start = (method: 'passphrase' | 'passkey' = 'passphrase') =>
    run(async (version) => {
      const created = await createVaultCandidate(ownerId, method)
      check(version)
      save(created.candidate)
      setPhrase(created.passphrase)
      setKit(created.recoveryKit)
    })
  const verify = (purpose: 'primary' | 'recovery') =>
    run(async (version) => {
      if (!candidate) return
      const secret =
        purpose === 'primary' && candidate.primaryWrapper.purpose === 'passkey'
          ? await assertPasskey(
              candidate.vaultId,
              candidate.primaryWrapper.passkeyBinding!,
            )
          : entry
      let checked: VaultCandidate
      try {
        checked = await verifyCandidate(candidate, purpose, secret)
      } finally {
        if (secret instanceof Uint8Array) secret.fill(0)
      }
      check(version)
      save(checked)
      setPhrase('')
      setKit('')
      setMessage(t('verified'))
    })
  const submit = () =>
    run(async (version) => {
      if (!candidate?.primaryChecked || !candidate.recoveryChecked) return
      const pending = {...candidate, submitted: true}
      save(pending)
      const result = await request('POST', {
        setupId: pending.setupId,
        vaultId: pending.vaultId,
        primaryWrapper: pending.primaryWrapper,
        recoveryWrapper: pending.recoveryWrapper,
      })
      check(version)
      if (result.status === 'success' || result.status === 'conflict') {
        sessionStorage.removeItem(storageKey)
        setCandidate(null)
        setPhrase('')
        setKit('')
        await onRefresh()
        setMessage(t(result.status === 'success' ? 'created' : 'lostSetup'))
      } else throw new Error('Unconfirmed setup')
    })
  const reconcile = () =>
    run(async (version) => {
      const response = await fetch('/api/note-vault', {cache: 'no-store'}),
        result = (await response.json()) as {
          status: string
          vault?: ConfirmedVault | null
        }
      check(version)
      if (result.status !== 'success') throw new Error('Unconfirmed')
      if (result.vault) {
        if (
          replacement &&
          replacement.submitted &&
          result.vault.lastOperationId !== replacement.operationId &&
          result.vault.revision === replacement.expectedRevision
        ) {
          setMessage(t('replacementPending'))
          return
        }
        sessionStorage.removeItem(storageKey)
        sessionStorage.removeItem(`${storageKey}:replacement`)
        setCandidate(null)
        setReplacement(null)
        await onRefresh()
        setMessage(t('reconciled'))
      } else setMessage(t('retrySameSetup'))
    })
  async function rawUnlock() {
    if (!vault) throw new Error('Missing vault')
    const secret = recovery
      ? await decodeRecoveryKey(entry)
      : vault.primaryWrapper.purpose === 'passkey'
        ? await assertPasskey(vault.id, vault.primaryWrapper.passkeyBinding!)
        : entry
    try {
      return await unwrapRoot(
        recovery ? vault.recoveryWrapper : vault.primaryWrapper,
        secret,
      )
    } finally {
      if (secret instanceof Uint8Array) secret.fill(0)
    }
  }
  const unlock = () =>
    run(async (version) => {
      if (!vault) return
      const epoch = currentVaultEpoch(),
        raw = await rawUnlock()
      try {
        const root = await importRoot(raw)
        check(version)
        activateVault(ownerId, vault.id, root, epoch)
      } finally {
        raw.fill(0)
      }
    })
  const prepareChange = (method: 'passphrase' | 'passkey' = 'passphrase') =>
    run(async (version) => {
      if (!vault || replacement) return
      const passkey =
        method === 'passkey' ? await enrollPasskey(vault.id) : null
      if (passkey) {
        try {
          check(version)
        } catch (error) {
          passkey.output.fill(0)
          throw error
        }
      }
      let raw: Uint8Array | null = null
      const fresh = generatePassphrase()
      try {
        raw = await rawUnlock()
        const primaryWrapper = await wrapRoot(
          raw,
          {
            ownerId,
            vaultId: vault.id,
            wrapperId: crypto.randomUUID(),
            purpose: method,
            profileId: passkey
              ? 'webauthn-prf-hkdf-sha256'
              : 'pbkdf2-sha256-600000',
            salt: passkey ? null : generatePassphraseSalt(),
            passkeyBinding: passkey?.binding ?? null,
          },
          passkey?.output ?? fresh,
        )
        check(version)
        const next = {
          operationId: crypto.randomUUID(),
          expectedRevision: vault.revision,
          primaryWrapper,
          submitted: false,
        }
        sessionStorage.setItem(
          `${storageKey}:replacement`,
          JSON.stringify(next),
        )
        setReplacement(next)
        setPhrase(passkey ? '' : fresh)
      } finally {
        raw?.fill(0)
        passkey?.output.fill(0)
      }
    })
  const change = () =>
    run(async (version) => {
      if (!replacement) return
      if (!replacement.submitted) {
        const secret =
          replacement.primaryWrapper.purpose === 'passkey'
            ? await assertPasskey(
                replacement.primaryWrapper.vaultId,
                replacement.primaryWrapper.passkeyBinding!,
              )
            : entry
        try {
          const raw = await unwrapRoot(replacement.primaryWrapper, secret)
          raw.fill(0)
        } finally {
          if (secret instanceof Uint8Array) secret.fill(0)
        }
      }
      check(version)
      // The exact sealed intent is retained before an uncertain request.
      sessionStorage.setItem(
        `${storageKey}:replacement`,
        JSON.stringify({...replacement, submitted: true}),
      )
      setReplacement({...replacement, submitted: true})
      const requestBody = {
        operationId: replacement.operationId,
        expectedRevision: replacement.expectedRevision,
        primaryWrapper: replacement.primaryWrapper,
      }
      const result = await request('PATCH', requestBody)
      check(version)
      if (result.status === 'success' || result.status === 'conflict') {
        sessionStorage.removeItem(`${storageKey}:replacement`)
        setReplacement(null)
        setPhrase('')
        await onRefresh()
        setMessage(t(result.status === 'success' ? 'changed' : 'reconciled'))
      } else throw new Error('Unconfirmed replacement')
    })
  return (
    <section
      className="border-hairline bg-paper-raised space-y-4 rounded-lg border p-4"
      aria-label={t('heading')}
    >
      <h2 className="font-semibold">{t('heading')}</h2>
      <p className="text-ink-muted text-sm">{t('disclosure')}</p>
      <p className="text-ink-muted text-sm">{t('passkeyPending')}</p>
      {vault ? (
        <>
          <p role="status">{t(active ? 'unlocked' : 'locked')}</p>
          {active ? (
            <Button variant="secondary" onClick={() => void lockVault(ownerId)}>
              {t('lock')}
            </Button>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setRecovery(!recovery)
                setEntry('')
              }}
            >
              {t(
                recovery
                  ? vault.primaryWrapper.purpose === 'passkey'
                    ? 'usePasskey'
                    : 'usePassphrase'
                  : 'useRecovery',
              )}
            </Button>
          </div>
          {(replacement
            ? replacement.primaryWrapper.purpose !== 'passkey'
            : recovery || vault.primaryWrapper.purpose !== 'passkey') && (
            <>
              <label className="block space-y-2">
                <span>
                  {t(
                    replacement
                      ? 'confirmNew'
                      : recovery
                        ? 'recoveryKey'
                        : 'passphrase',
                  )}
                </span>
                <Input
                  autoComplete="off"
                  type={reveal ? 'text' : 'password'}
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                />
              </label>
              <Button variant="ghost" onClick={() => setReveal(!reveal)}>
                {t(reveal ? 'hide' : 'reveal')}
              </Button>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              loading={busy}
              onClick={() => void unlock()}
              disabled={
                (!entry &&
                  (recovery || vault.primaryWrapper.purpose !== 'passkey')) ||
                Boolean(replacement)
              }
            >
              {t('unlock')}
            </Button>
            <Button
              variant="secondary"
              loading={busy}
              disabled={
                (!entry &&
                  (recovery || vault.primaryWrapper.purpose !== 'passkey')) ||
                Boolean(replacement)
              }
              onClick={() => void prepareChange()}
            >
              {t('change')}
            </Button>
            <Button
              variant="secondary"
              loading={busy}
              disabled={
                (!entry &&
                  (recovery || vault.primaryWrapper.purpose !== 'passkey')) ||
                Boolean(replacement)
              }
              onClick={() => void prepareChange('passkey')}
            >
              {t('changePasskey')}
            </Button>
          </div>
          {replacement ? (
            <>
              <p className="text-sm">
                {t(
                  replacement.primaryWrapper.purpose === 'passkey'
                    ? 'verifyNewPasskey'
                    : 'saveNew',
                )}
              </p>
              {phrase ? (
                <p className="font-mono break-words">{phrase}</p>
              ) : null}
              <Button
                loading={busy}
                disabled={
                  !entry &&
                  !replacement.submitted &&
                  replacement.primaryWrapper.purpose !== 'passkey'
                }
                onClick={() => void change()}
              >
                {t(replacement.submitted ? 'retryChange' : 'confirmChange')}
              </Button>
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => void reconcile()}
              >
                {t('reconcile')}
              </Button>
            </>
          ) : null}
        </>
      ) : candidate ? (
        <>
          <p className="text-sm">{t('saveKit')}</p>
          {phrase ? <p className="font-mono break-words">{phrase}</p> : null}
          {kit ? (
            <p className="font-mono break-all">
              {reveal ? kit : t('kitHidden')}
            </p>
          ) : null}
          <Button variant="secondary" onClick={() => setReveal(!reveal)}>
            {t(reveal ? 'hide' : 'reveal')}
          </Button>
          <label className="block space-y-2">
            <span>{t('confirmationEntry')}</span>
            <Input
              autoComplete="off"
              type={reveal ? 'text' : 'password'}
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={busy}
              disabled={
                !entry && candidate.primaryWrapper.purpose !== 'passkey'
              }
              onClick={() => void verify('primary')}
            >
              {t(
                candidate.primaryChecked ? 'primaryVerified' : 'verifyPrimary',
              )}
            </Button>
            <Button
              variant="secondary"
              loading={busy}
              disabled={!entry}
              onClick={() => void verify('recovery')}
            >
              {t(
                candidate.recoveryChecked
                  ? 'recoveryVerified'
                  : 'verifyRecovery',
              )}
            </Button>
          </div>
          <Button
            loading={busy}
            disabled={!candidate.primaryChecked || !candidate.recoveryChecked}
            onClick={() => void submit()}
          >
            {t(candidate.submitted ? 'retrySetup' : 'activate')}
          </Button>
          {candidate.submitted ? (
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => void reconcile()}
            >
              {t('reconcile')}
            </Button>
          ) : (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                sessionStorage.removeItem(storageKey)
                setCandidate(null)
                setPhrase('')
                setKit('')
                setEntry('')
              }}
            >
              {t('restart')}
            </Button>
          )}
        </>
      ) : enrollmentEnabled ? (
        <div className="flex flex-wrap gap-2">
          <Button loading={busy} onClick={() => void start('passkey')}>
            {t('setupPasskey')}
          </Button>
          <Button
            variant="secondary"
            loading={busy}
            onClick={() => void start('passphrase')}
          >
            {t('setup')}
          </Button>
        </div>
      ) : (
        <p>{t('disabled')}</p>
      )}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </section>
  )
}
export default VaultControls
