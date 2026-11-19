'use client'

import {useEffect, useRef, useState} from 'react'
import {useTranslations} from 'next-intl'
import Button from '~/components/ui/button'
import {Input} from '~/components/ui/input'
import {assertPasskey} from '~/lib/notes/encryption/passkey'
import {
  createVaultCandidate,
  createReplacementCandidate,
  confirmReplacement,
  type ReplacementCandidate,
  verifyCandidate,
  vaultCandidateSchema,
  type VaultCandidate,
} from '~/lib/notes/encryption/candidate'
import {
  decodeRecoveryKey,
  importRoot,
  unwrapRoot,
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
import {
  authorizationSchema,
  replacementIntentDigest,
  type SignedReplacement,
} from '~/lib/notes/encryption/authorization'
import {
  saveReplacementIntent,
  getReplacementIntent,
  clearReplacementIntent,
} from '~/lib/notes/encryption/storage'
// An earlier client may have submitted a replacement before writes closed.
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
  compact = false,
}: {
  ownerId: string
  vault: ConfirmedVault | null
  enrollmentEnabled: boolean
  compact?: boolean
  onRefresh: (requireOnline?: boolean) => Promise<ConfirmedVault | null>
}) {
  const t = useTranslations('note.vault')
  const [candidate, setCandidate] = useState<VaultCandidate | null>(null)
  const [phrase, setPhrase] = useState(''),
    [kit, setKit] = useState(''),
    [entry, setEntry] = useState('')
  const [recovery, setRecovery] = useState(false),
    [reveal, setReveal] = useState(false),
    [setupReveal, setSetupReveal] = useState(false)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const [replacement, setReplacement] = useState<z.infer<
    typeof replacementSchema
  > | null>(null)
  const [replacementDraft, setReplacementDraft] =
    useState<ReplacementCandidate | null>(null)
  const [signedReplacement, setSignedReplacement] =
    useState<SignedReplacement | null>(null)
  const active = useVaultUnlocked(ownerId, vault?.id ?? '')
  const generation = useRef(0),
    inFlight = useRef(false)
  const replacementFocus = useRef<
    'confirm' | 'passphrase' | 'passkey' | 'unlock' | null
  >(null)
  const credentialEntry = useRef<HTMLInputElement>(null)
  const confirmationEntry = useRef<HTMLInputElement>(null)
  const confirmButton = useRef<HTMLButtonElement>(null)
  const replacePassphraseButton = useRef<HTMLButtonElement>(null)
  const replacePasskeyButton = useRef<HTMLButtonElement>(null)
  const unlockButton = useRef<HTMLButtonElement>(null)
  const methodButton = useRef<HTMLButtonElement>(null)
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
      setReplacementDraft(null)
      setSignedReplacement(null)
      setEntry('')
      setPhrase('')
      setKit('')
      setReveal(false)
      setSetupReveal(false)
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
          if (value.primaryWrapper.ownerId === ownerId) {
            if (value.submitted) setReplacement(value)
            else sessionStorage.removeItem(storageKey + ':replacement')
          }
        }
      } catch {
        setError(t('storageError'))
      }
    })
    void getReplacementIntent(ownerId)
      .then((saved) => {
        if (!disposed) setSignedReplacement(saved)
      })
      .catch(() => {
        if (!disposed) setError(t('storageError'))
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
      replacementFocus.current = null
      setReplacementDraft(null)
      setPhrase('')
      setKit('')
      setEntry('')
      setReveal(false)
      setSetupReveal(false)
    }
    document.addEventListener('visibilitychange', clear)
    window.addEventListener('eton-vault-invalidated', invalidate)
    return () => {
      disposed = true
      versionCounter.current++
      replacementFocus.current = null
      document.removeEventListener('visibilitychange', clear)
      window.removeEventListener('eton-vault-invalidated', invalidate)
    }
  }, [ownerId, storageKey, t])
  useEffect(() => {
    const target = replacementFocus.current
    if (!target || busy || document.hidden) return
    replacementFocus.current = null
    if (target === 'confirm') {
      const confirmation = confirmationEntry.current ?? confirmButton.current
      confirmation?.focus()
      return
    }
    const button =
      target === 'passphrase'
        ? replacePassphraseButton.current
        : target === 'passkey'
          ? replacePasskeyButton.current
          : unlockButton.current
    const fallback = credentialEntry.current ?? methodButton.current
    const control = button && !button.disabled ? button : fallback
    control?.focus()
  }, [busy, replacementDraft, signedReplacement])
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
  async function submitSetup(body: unknown) {
    const response = await fetch('/api/note-vault', {
      method: 'POST',
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
  const start = (method: 'passphrase' | 'passkey') =>
    run(async (version) => {
      const created = await createVaultCandidate(ownerId, method)
      check(version)
      setSetupReveal(false)
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
  function matchesSetup(current: ConfirmedVault, candidate: VaultCandidate) {
    const vaultId = canonicalIdSchema.parse(current.id)
    const setupId = canonicalIdSchema.parse(current.setupId)
    const primary = vaultWrapperSchema.parse(current.primaryWrapper)
    const recovery = vaultWrapperSchema.parse(current.recoveryWrapper)
    if (
      current.ownerId !== ownerId ||
      primary.ownerId !== ownerId ||
      recovery.ownerId !== ownerId ||
      primary.vaultId !== vaultId ||
      recovery.vaultId !== vaultId ||
      primary.purpose === 'recovery' ||
      recovery.purpose !== 'recovery'
    )
      throw new Error('Invalid setup status')
    const authorizationVersion = current.authorizationVersion ?? 0
    if (
      authorizationVersion !== 1 &&
      (authorizationVersion !== 0 || current.authorization != null)
    )
      throw new Error('Invalid vault authorization')
    const installedAuthorization =
      authorizationVersion === 1
        ? authorizationSchema.parse(current.authorization)
        : null
    const savedAuthorization = candidate.authorization
      ? authorizationSchema.parse(candidate.authorization)
      : null
    return (
      vaultId === candidate.vaultId &&
      setupId === candidate.setupId &&
      JSON.stringify(recovery) ===
        JSON.stringify(vaultWrapperSchema.parse(candidate.recoveryWrapper)) &&
      JSON.stringify(installedAuthorization) ===
        JSON.stringify(savedAuthorization)
    )
  }
  function finishSetup(message: 'created' | 'reconciled' | 'lostSetup') {
    sessionStorage.removeItem(storageKey)
    setCandidate(null)
    setPhrase('')
    setKit('')
    setMessage(t(message))
  }
  const submit = () =>
    run(async (version) => {
      if (!candidate?.primaryChecked || !candidate.recoveryChecked) return
      const pending = {...candidate, submitted: true}
      save(pending)
      const result = await submitSetup({
        setupId: pending.setupId,
        vaultId: pending.vaultId,
        primaryWrapper: pending.primaryWrapper,
        recoveryWrapper: pending.recoveryWrapper,
        ...(pending.authorization
          ? {authorizationVersion: 1, authorization: pending.authorization}
          : {}),
      })
      check(version)
      if (
        (result.status !== 'success' && result.status !== 'conflict') ||
        !result.vault
      )
        throw new Error('Unconfirmed setup')
      const sameSetup = matchesSetup(result.vault, pending)
      if (result.status === 'success' && !sameSetup)
        throw new Error('Invalid setup acknowledgement')
      const current = await onRefresh(true)
      check(version)
      if (!current || matchesSetup(current, pending) !== sameSetup)
        throw new Error('Unconfirmed setup')
      const confirmedMessage =
        candidate.submitted || result.status === 'conflict'
          ? 'reconciled'
          : 'created'
      finishSetup(sameSetup ? confirmedMessage : 'lostSetup')
    })
  async function reconcileSigned(
    request: SignedReplacement,
    version: number,
    fresh = false,
  ) {
    const response = await fetch(
      '/api/note-vault?operationId=' + encodeURIComponent(request.operationId),
      {cache: 'no-store'},
    )
    if (!response.ok) throw new Error('Replacement status unavailable')
    const result = (await response.json()) as {
      status: string
      vault: ConfirmedVault | null
      receipt: null | {
        operationId: string
        intentDigest: string
        appliedRevision: string
      }
    }
    check(version)
    if (
      result.status !== 'success' ||
      !result.vault ||
      result.vault.ownerId !== ownerId ||
      result.vault.id !== request.vaultId
    )
      throw new Error('Replacement status unavailable')
    if (!result.receipt) {
      await onRefresh(true)
      check(version)
      setMessage(
        t(
          result.vault.revision === request.expectedRevision
            ? 'replacementUnconfirmed'
            : 'replacementStale',
        ),
      )
      return
    }
    const receipt = z
      .strictObject({
        operationId: z.uuid(),
        intentDigest: z.string(),
        appliedRevision: z.uuid(),
      })
      .parse(result.receipt)
    const {signature: _signature, ...intent} = request
    if (
      receipt.operationId !== request.operationId ||
      receipt.intentDigest !== (await replacementIntentDigest(intent))
    )
      throw new Error('Receipt mismatch')
    const current = await onRefresh(true)
    check(version)
    if (
      !current ||
      current.ownerId !== ownerId ||
      current.id !== request.vaultId
    )
      throw new Error('Vault unavailable')
    const isCurrent =
      current.revision === receipt.appliedRevision &&
      JSON.stringify(vaultWrapperSchema.parse(current.primaryWrapper)) ===
        JSON.stringify(request.primaryWrapper)
    await clearReplacementIntent(ownerId, request)
    check(version)
    setSignedReplacement(null)
    if (isCurrent && fresh) {
      setRecovery(false)
      setReveal(false)
      replacementFocus.current = 'unlock'
      setMessage(t('replacementChanged'))
    } else {
      setMessage(t(isCurrent ? 'replacementActive' : 'replacementHistorical'))
    }
  }
  async function sendReplacement(
    request: SignedReplacement,
    version: number,
    fresh = false,
  ) {
    check(version)
    const patch = () =>
      fetch('/api/note-vault', {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'x-note-encryption-protocol': '1',
        },
        body: JSON.stringify(request),
      })
    const response = await patch()
    check(version)
    const binding = request.primaryWrapper.passkeyBinding
    if (
      binding &&
      response.ok &&
      (await response.json()).status === 'passkey_assertion_required'
    ) {
      check(version)
      const output = await assertPasskey(request.vaultId, binding)
      output.fill(0)
      check(version)
      await patch()
      check(version)
    }
    await reconcileSigned(request, version, fresh)
  }
  const beginReplacement = (method: 'passphrase' | 'passkey') =>
    run(async (version) => {
      if (
        !vault ||
        vault.authorizationVersion !== 1 ||
        signedReplacement ||
        replacementDraft
      )
        return
      const authorization = authorizationSchema.parse(vault.authorization)
      const raw = await rawUnlock()
      try {
        check(version)
        const created = await createReplacementCandidate(
          raw,
          {...vault, authorization},
          method,
          () => check(version),
        )
        check(version)
        replacementFocus.current = 'confirm'
        setReveal(false)
        setReplacementDraft(created.candidate)
        setPhrase(created.passphrase)
        setEntry('')
      } finally {
        raw.fill(0)
      }
    })
  const submitReplacement = () =>
    run(async (version) => {
      if (!replacementDraft || signedReplacement) return
      const secret =
        replacementDraft.primaryWrapper.purpose === 'passkey'
          ? await assertPasskey(
              replacementDraft.vaultId,
              replacementDraft.primaryWrapper.passkeyBinding!,
            )
          : entry
      try {
        const request = await confirmReplacement(replacementDraft, secret)
        check(version)
        await saveReplacementIntent(request, () => check(version))
        check(version)
        setSignedReplacement(request)
        setReplacementDraft(null)
        setPhrase('')
        check(version)
        await sendReplacement(request, version, true)
      } finally {
        if (secret instanceof Uint8Array) secret.fill(0)
      }
    })
  const reconcile = () =>
    run(async (version) => {
      if (signedReplacement) {
        await reconcileSigned(signedReplacement, version)
        return
      }
      const current = await onRefresh(true)
      check(version)
      if (!current) {
        if (replacement) throw new Error('Unconfirmed replacement')
        setMessage(t('retrySameSetup'))
        return
      }
      if (replacement) {
        const isCurrent =
          current.id === replacement.primaryWrapper.vaultId &&
          current.lastOperationId === replacement.operationId &&
          JSON.stringify(vaultWrapperSchema.parse(current.primaryWrapper)) ===
            JSON.stringify(replacement.primaryWrapper)
        sessionStorage.removeItem(storageKey + ':replacement')
        setReplacement(null)
        setMessage(t(isCurrent ? 'replacementActive' : 'replacementInactive'))
      } else if (candidate) {
        finishSetup(
          matchesSetup(current, candidate) ? 'reconciled' : 'lostSetup',
        )
      }
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
      if (!vault || active) return
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
  const controls = (
    <>
      <p className="text-ink-muted text-sm">{t('disclosure')}</p>
      <p className="text-ink-muted text-sm">{t('passkeyPending')}</p>
      {vault ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              ref={methodButton}
              variant="secondary"
              disabled={busy || !!replacementDraft}
              onClick={() => {
                setRecovery(!recovery)
                setReveal(false)
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
          {!replacementDraft &&
            (recovery || vault.primaryWrapper.purpose !== 'passkey') && (
              <>
                <label className="block space-y-2">
                  <span>{t(recovery ? 'recoveryKey' : 'passphrase')}</span>
                  <Input
                    ref={credentialEntry}
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
          <Button
            ref={unlockButton}
            loading={busy}
            onClick={() => void unlock()}
            disabled={
              active ||
              !!replacementDraft ||
              (!entry &&
                (recovery || vault.primaryWrapper.purpose !== 'passkey'))
            }
          >
            {t('unlock')}
          </Button>
          {vault.authorizationVersion === 1 &&
          authorizationSchema.safeParse(vault.authorization).success ? (
            <div className="space-y-2">
              <p className="text-ink-muted text-sm">
                {t(
                  replacementDraft
                    ? 'replacementConfirmHelp'
                    : 'replacementHelp',
                )}
              </p>
              {phrase && replacementDraft ? (
                <p className="font-mono break-words">{phrase}</p>
              ) : null}
              {replacementDraft ? (
                <>
                  {replacementDraft.primaryWrapper.purpose !== 'passkey' && (
                    <label className="block space-y-2">
                      <span>{t('replacementConfirmation')}</span>
                      <Input
                        ref={confirmationEntry}
                        autoComplete="off"
                        type={reveal ? 'text' : 'password'}
                        value={entry}
                        onChange={(event) => setEntry(event.target.value)}
                      />
                    </label>
                  )}
                  <Button
                    ref={confirmButton}
                    loading={busy}
                    disabled={
                      !entry &&
                      replacementDraft.primaryWrapper.purpose !== 'passkey'
                    }
                    onClick={() => void submitReplacement()}
                  >
                    {t('confirmReplacement')}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      replacementFocus.current =
                        replacementDraft.primaryWrapper.purpose === 'passkey'
                          ? 'passkey'
                          : 'passphrase'
                      setReplacementDraft(null)
                      setReveal(false)
                      setPhrase('')
                      setEntry('')
                    }}
                  >
                    {t('cancelReplacement')}
                  </Button>
                </>
              ) : !signedReplacement ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    ref={replacePassphraseButton}
                    variant="secondary"
                    loading={busy}
                    disabled={
                      !entry &&
                      (recovery || vault.primaryWrapper.purpose !== 'passkey')
                    }
                    onClick={() => void beginReplacement('passphrase')}
                  >
                    {t('replacePassphrase')}
                  </Button>
                  <Button
                    ref={replacePasskeyButton}
                    variant="secondary"
                    loading={busy}
                    disabled={
                      !entry &&
                      (recovery || vault.primaryWrapper.purpose !== 'passkey')
                    }
                    onClick={() => void beginReplacement('passkey')}
                  >
                    {t('replacePasskey')}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-ink-muted text-sm">{t('replacementClosed')}</p>
          )}
          {signedReplacement && (
            <div className="space-y-2">
              <p>{t('replacementPending')}</p>
              <Button
                variant="secondary"
                loading={busy}
                onClick={() =>
                  void run((version) =>
                    sendReplacement(signedReplacement, version),
                  )
                }
              >
                {t('retryReplacement')}
              </Button>
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => void reconcile()}
              >
                {t('reconcile')}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void run(async (version) => {
                    await onRefresh(true)
                    check(version)
                    await clearReplacementIntent(ownerId, signedReplacement)
                    check(version)
                    setSignedReplacement(null)
                    setMessage(t('replacementForgotten'))
                  })
                }
              >
                {t('forgetReplacement')}
              </Button>
            </div>
          )}
          {(replacement || candidate?.submitted) && (
            <>
              {replacement && <p>{t('replacementCheck')}</p>}
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => void reconcile()}
              >
                {t('reconcile')}
              </Button>
            </>
          )}
        </>
      ) : candidate ? (
        <>
          <p className="text-sm">{t('saveKit')}</p>
          {phrase ? <p className="font-mono break-words">{phrase}</p> : null}
          {kit ? (
            <p className="font-mono break-all">
              {setupReveal ? kit : t('kitHidden')}
            </p>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => setSetupReveal(!setupReveal)}
          >
            {t(setupReveal ? 'hide' : 'reveal')}
          </Button>
          <label className="block space-y-2">
            <span>{t('confirmationEntry')}</span>
            <Input
              autoComplete="off"
              type={setupReveal ? 'text' : 'password'}
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
    </>
  )
  return (
    <section
      className="border-hairline bg-paper-raised space-y-4 rounded-lg border p-4"
      aria-label={t('heading')}
    >
      <div
        className={
          compact && active ? 'flex flex-wrap items-center gap-2' : 'space-y-4'
        }
      >
        <h2 className="font-semibold">{t('heading')}</h2>
        {vault && <p role="status">{t(active ? 'unlocked' : 'locked')}</p>}
        {active && (
          <Button variant="secondary" onClick={() => void lockVault(ownerId)}>
            {t('lock')}
          </Button>
        )}
      </div>
      {compact && active ? (
        <details className="space-y-4">
          <summary className="min-h-10 cursor-pointer content-center text-sm">
            {t('credentialSettings')}
          </summary>
          {controls}
        </details>
      ) : (
        controls
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
