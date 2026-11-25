'use client'

import {useEffect, useId, useRef, useState} from 'react'
import {useTranslations} from 'next-intl'
import {
  IconCheck,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconFingerprint,
  IconInfoCircle,
  IconKey,
  IconPassword,
  IconRefresh,
  IconShieldCheck,
} from '@tabler/icons-react'
import {cn} from 'cn'
import Button, {buttonClass} from '~/components/ui/button'
import {Input} from '~/components/ui/input'
import PopoverBase from '~/components/ui/popover'
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
import SetupScene, {type SetupStage} from './setup-scene'
// Check cards take their group name from the visible header text
// (aria-labelledby), so getByLabel keeps resolving uniquely to the inputs.
// Secret fields pair the input with an inline eye toggle. Focus visuals live
// on the wrapper, so the focus ring wraps both instead of crossing the button.
const secretFieldClass =
  'relative rounded-md border border-control-border bg-paper-raised text-ink transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent'
const secretInputClass =
  'rounded-md border-0 bg-transparent focus:outline-none focus:ring-0!'
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
  onActivated,
  focusRequest = 0,
}: {
  ownerId: string
  vault: ConfirmedVault | null
  enrollmentEnabled: boolean
  onRefresh: (requireOnline?: boolean) => Promise<ConfirmedVault | null>
  onActivated?: () => void
  /** Increment to move focus to the unlock controls after a locked note. */
  focusRequest?: number
}) {
  const t = useTranslations('note.vault')
  const [candidate, setCandidate] = useState<VaultCandidate | null>(null)
  // SSR-safe: both server and first client render assume no passkey support;
  // the probe below upgrades capable devices right after hydration.
  const [passkeyCapable, setPasskeyCapable] = useState(false)
  const [phrase, setPhrase] = useState(''),
    [kit, setKit] = useState(''),
    [entry, setEntry] = useState('')
  const [recovery, setRecovery] = useState(false),
    [reveal, setReveal] = useState(false),
    [setupReveal, setSetupReveal] = useState(false)
  // reveal/setupReveal are shared across secret fields; safe while only one
  // secret field is ever visible at a time. Split per field if that changes.
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const [atVerify, setAtVerify] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  )
  // Which setup method is running its ceremony, so only that button spins.
  const [starting, setStarting] = useState<'passkey' | 'passphrase' | null>(
    null,
  )
  const [replacement, setReplacement] = useState<z.infer<
    typeof replacementSchema
  > | null>(null)
  const [replacementDraft, setReplacementDraft] =
    useState<ReplacementCandidate | null>(null)
  const [signedReplacement, setSignedReplacement] =
    useState<SignedReplacement | null>(null)
  const active = useVaultUnlocked(ownerId, vault?.id ?? '')
  const primaryHeadingId = useId()
  const recoveryHeadingId = useId()
  const generation = useRef(0),
    inFlight = useRef(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const focusSetupAction = useRef(false)
  const restartButton = useRef<HTMLButtonElement>(null)
  const setupPrimaryButton = useRef<HTMLButtonElement>(null)
  const replacementFocus = useRef<
    'confirm' | 'passphrase' | 'passkey' | 'unlock' | null
  >(null)
  const credentialEntry = useRef<HTMLInputElement>(null)
  const confirmationEntry = useRef<HTMLInputElement>(null)
  const confirmButton = useRef<HTMLButtonElement>(null)
  const verifyFocus = useRef<'entry' | 'activate' | null>(null)
  const verifyEntry = useRef<HTMLInputElement>(null)
  const activateButton = useRef<HTMLButtonElement>(null)
  const replacePassphraseButton = useRef<HTMLButtonElement>(null)
  const replacePasskeyButton = useRef<HTMLButtonElement>(null)
  const unlockButton = useRef<HTMLButtonElement>(null)
  const methodButton = useRef<HTMLButtonElement>(null)
  const setupHeading = useRef<HTMLHeadingElement>(null)
  const previousStage = useRef<SetupStage | undefined>(undefined)
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
      setAtVerify(false)
      setCopyState('idle')
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
      focusSetupAction.current = false
      replacementFocus.current = null
      verifyFocus.current = null
      if (copyTimer.current) clearTimeout(copyTimer.current)
      setReplacementDraft(null)
      setPhrase('')
      setKit('')
      setEntry('')
      setReveal(false)
      setSetupReveal(false)
      setCopyState('idle')
    }
    document.addEventListener('visibilitychange', clear)
    window.addEventListener('eton-vault-invalidated', invalidate)
    return () => {
      disposed = true
      versionCounter.current++
      replacementFocus.current = null
      if (copyTimer.current) clearTimeout(copyTimer.current)
      document.removeEventListener('visibilitychange', clear)
      window.removeEventListener('eton-vault-invalidated', invalidate)
    }
  }, [ownerId, storageKey, t])
  useEffect(() => {
    let disposed = false
    const probe =
      window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.()
    const decide = (capable: boolean) => {
      if (!disposed) setPasskeyCapable(capable)
    }
    if (probe) {
      probe
        .then((available) => decide(Boolean(available)))
        .catch(() => decide(false))
    } else {
      queueMicrotask(() => decide(false))
    }
    return () => {
      disposed = true
    }
  }, [])
  // The heading focus runs before the action-focus effects, so a requested
  // control (setup, verify, unlock) wins over the heading after a discard.
  const setupStage: SetupStage = !candidate
    ? 'setup'
    : candidate.submitted ||
        atVerify ||
        candidate.primaryChecked ||
        candidate.recoveryChecked ||
        (!phrase && !kit)
      ? 'verify'
      : 'backup'
  useEffect(() => {
    if (previousStage.current === undefined) {
      previousStage.current = setupStage
      return
    }
    if (previousStage.current !== setupStage)
      setupHeading.current?.focus({preventScroll: true})
    previousStage.current = setupStage
  }, [setupStage])
  useEffect(() => {
    if (!focusSetupAction.current || busy || document.hidden) return
    focusSetupAction.current = false
    const button = candidate ? restartButton : setupPrimaryButton
    button.current?.focus()
  }, [busy, candidate])
  useEffect(() => {
    const target = verifyFocus.current
    if (!target || busy || document.hidden) return
    verifyFocus.current = null
    const control =
      target === 'entry' ? verifyEntry.current : activateButton.current
    control?.focus()
  }, [busy, candidate])
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
  useEffect(() => {
    if (!focusRequest || active || document.hidden) return
    const control = credentialEntry.current ?? unlockButton.current
    control?.focus()
  }, [focusRequest, active])
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
      setStarting(method)
      try {
        const created = await createVaultCandidate(ownerId, method)
        check(version)
        setSetupReveal(false)
        setAtVerify(false)
        setCopyState('idle')
        save(created.candidate)
        setPhrase(created.passphrase)
        setKit(created.recoveryKit)
      } finally {
        setStarting(null)
      }
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
      setReveal(false)
      setCopyState('idle')
      // Hand focus to the next step: the recovery entry or activation.
      verifyFocus.current = purpose === 'primary' ? 'entry' : 'activate'
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
    if (vaultId !== candidate.vaultId && setupId !== candidate.setupId)
      return false
    // A known setup with missing or inconsistent pinned fields can be retried.
    if (
      vaultId !== candidate.vaultId ||
      setupId !== candidate.setupId ||
      JSON.stringify(recovery) !==
        JSON.stringify(vaultWrapperSchema.parse(candidate.recoveryWrapper)) ||
      JSON.stringify(installedAuthorization) !==
        JSON.stringify(savedAuthorization)
    )
      throw new Error('Unconfirmed setup identity')
    return true
  }
  function finishSetup(message: 'created' | 'reconciled' | 'lostSetup') {
    sessionStorage.removeItem(storageKey)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    setCandidate(null)
    setPhrase('')
    setKit('')
    setAtVerify(false)
    setCopyState('idle')
    setMessage(t(message))
    onActivated?.()
  }
  function discardCandidate() {
    sessionStorage.removeItem(storageKey)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    focusSetupAction.current = true
    setCandidate(null)
    setPhrase('')
    setKit('')
    setEntry('')
    setReveal(false)
    setAtVerify(false)
    setCopyState('idle')
    setError('')
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
      if (result.status === 'passkey_unavailable') {
        save({...pending, submitted: false, primaryChecked: false})
        setAtVerify(true)
        focusSetupAction.current = true
        setError(t('setupPasskeyExpired'))
        return
      }
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
    const binding = request.primaryWrapper.passkeyBinding
    const passkeyStatus = async (response: Response) =>
      binding && response.ok
        ? (await response.json().catch(() => null))?.status
        : null
    let response = await patch()
    let status = await passkeyStatus(response)
    check(version)
    if (binding && status === 'passkey_assertion_required') {
      const output = await assertPasskey(request.vaultId, binding)
      output.fill(0)
      check(version)
      response = await patch()
      status = await passkeyStatus(response)
      check(version)
    }
    if (status === 'passkey_unavailable') {
      setError(t('replacementPasskeyExpired'))
      return
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
  async function copyKit() {
    if (!kit) return
    // Stop any pending flip-to-idle so it cannot hide a fresh failure state.
    if (copyTimer.current) clearTimeout(copyTimer.current)
    try {
      await navigator.clipboard.writeText(kit)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
      return
    }
    // Return the control to its copy affordance after a brief confirmation.
    copyTimer.current = setTimeout(() => setCopyState('idle'), 2000)
  }
  const setupMethod =
    candidate?.primaryWrapper.purpose === 'passkey' ? 'passkey' : 'passphrase'
  const primaryLabel = t(
    setupMethod === 'passkey' ? 'passkeyLabel' : 'passphraseLabel',
  )
  const PrimaryIcon = setupMethod === 'passkey' ? IconFingerprint : IconPassword
  const setupViews: Record<SetupStage, {title: string; hint: string}> = {
    setup: {title: t('heading'), hint: t('setupHint')},
    backup: {title: t('backupTitle'), hint: t('backupHint')},
    verify: {title: t('verifyTitle'), hint: t('verifyHint')},
  }
  const setupView = setupViews[setupStage]
  // The checks are sequential: the primary method is confirmed first, then the
  // recovery key re-entry, so one input serves the current check at a time.
  const pending = !candidate?.primaryChecked
    ? 'primary'
    : !candidate?.recoveryChecked
      ? 'recovery'
      : null
  const messages = (
    <>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-ink-muted text-sm">
          {message}
        </p>
      ) : null}
    </>
  )
  if (!vault) {
    const disabled = !candidate && !enrollmentEnabled
    return (
      <section
        aria-label={t('heading')}
        className="grid gap-y-5 md:grid-cols-2 md:gap-x-12 lg:gap-x-16"
      >
        <div className="min-w-0 md:col-start-2 md:row-start-1 md:self-end">
          <h1
            ref={setupHeading}
            tabIndex={-1}
            className="font-serif text-4xl font-normal tracking-tight outline-none sm:text-5xl"
          >
            {setupView.title}
          </h1>
          {!disabled && (
            <p className="text-ink-muted mt-2 text-base leading-relaxed">
              {setupView.hint}
            </p>
          )}
        </div>
        {!disabled && (
          <SetupScene
            stage={setupStage}
            method={setupMethod}
            primaryChecked={candidate?.primaryChecked}
            recoveryChecked={candidate?.recoveryChecked}
          />
        )}
        <div className="min-w-0 md:col-start-2 md:row-start-2">
          {disabled ? (
            <p className="text-ink-muted text-sm">{t('disabled')}</p>
          ) : setupStage === 'setup' ? (
            <>
              {passkeyCapable ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Button
                      ref={setupPrimaryButton}
                      size="lg"
                      loading={starting === 'passkey'}
                      disabled={busy}
                      onClick={() => void start('passkey')}
                    >
                      {starting === 'passkey' ? null : (
                        <IconFingerprint size={20} aria-hidden />
                      )}
                      {t('setupPasskey')}
                    </Button>
                    <Button
                      variant="link"
                      disabled={busy}
                      onClick={() => void start('passphrase')}
                    >
                      {t('setup')}
                    </Button>
                  </div>
                  <p className="text-ink-muted mt-3 text-xs">
                    {t('passkeyPending')}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Button
                      ref={setupPrimaryButton}
                      size="lg"
                      loading={starting === 'passphrase'}
                      disabled={busy}
                      onClick={() => void start('passphrase')}
                    >
                      {starting === 'passphrase' ? null : (
                        <IconPassword size={20} aria-hidden />
                      )}
                      {t('setup')}
                    </Button>
                    <Button
                      variant="link"
                      disabled={busy}
                      onClick={() => void start('passkey')}
                    >
                      {t('setupPasskey')}
                    </Button>
                  </div>
                  <p className="text-ink-muted mt-3 text-xs">
                    {t('passkeyUnavailable')}
                  </p>
                </>
              )}
              <div className="border-hairline mt-6 border-t pt-1">
                <PopoverBase
                  anchor="bottom-start"
                  trigger={
                    <>
                      <IconInfoCircle size={16} aria-hidden />{' '}
                      {t('privacyTrigger')}
                    </>
                  }
                  triggerClassName={cn(
                    buttonClass({variant: 'ghost'}),
                    'text-ink-muted px-1',
                  )}
                  className="border-hairline bg-paper-raised text-ink shadow-sheet max-w-72 rounded-lg border p-4 text-sm leading-relaxed"
                >
                  {t('privacy')}
                </PopoverBase>
              </div>
            </>
          ) : setupStage === 'backup' ? (
            <div className="space-y-5">
              <dl className="bg-paper-raised border-hairline divide-hairline divide-y rounded-lg border">
                <div className="space-y-1 p-4">
                  <dt className="text-ink-muted text-xs font-medium">
                    {primaryLabel}
                  </dt>
                  <dd className="text-sm break-words">
                    {phrase ? (
                      <p className="font-mono break-words">{phrase}</p>
                    ) : (
                      t('passkeySaved')
                    )}
                  </dd>
                </div>
                <div className="relative grid min-h-18 content-center gap-1 py-3 pr-20 pl-4">
                  <dt className="text-ink-muted text-xs font-medium">
                    {t('recoveryKey')}
                  </dt>
                  <dd>
                    {/* While hidden, a same-length placeholder sits under the
                        blur: identical metrics (no reflow on reveal) and no
                        key material in the DOM until the user reveals it. */}
                    <p
                      className={cn(
                        'font-mono text-sm wrap-anywhere break-all',
                        setupReveal ? 'select-all' : 'blur-xs select-none',
                      )}
                    >
                      {setupReveal ? (
                        kit
                      ) : (
                        <>
                          <span className="sr-only">{t('kitHidden')}</span>
                          <span aria-hidden="true">
                            {kit.replace(/[^.]/g, 'x')}
                          </span>
                        </>
                      )}
                    </p>
                  </dd>
                  <dd
                    role="status"
                    className={
                      copyState === 'failed'
                        ? 'text-ink-muted text-xs'
                        : 'sr-only'
                    }
                  >
                    {copyState === 'copied' && t('copyKeySuccess')}
                    {copyState === 'failed' && t('copyKeyFailed')}
                  </dd>
                  <div className="absolute top-1/2 right-2 flex -translate-y-1/2 flex-col gap-2">
                    <Button
                      variant="ghost"
                      iconOnly
                      size="sm"
                      pressMotion={false}
                      aria-label={t(setupReveal ? 'hide' : 'reveal')}
                      title={t(setupReveal ? 'hide' : 'reveal')}
                      onClick={() => setSetupReveal(!setupReveal)}
                    >
                      {setupReveal ? (
                        <IconEyeOff size={18} aria-hidden />
                      ) : (
                        <IconEye size={18} aria-hidden />
                      )}
                    </Button>
                    {kit ? (
                      <Button
                        variant="ghost"
                        iconOnly
                        size="sm"
                        pressMotion={false}
                        aria-label={t('copyKey')}
                        title={t(
                          copyState === 'copied' ? 'copyKeySuccess' : 'copyKey',
                        )}
                        onClick={() => void copyKit()}
                      >
                        {copyState === 'copied' ? (
                          <IconCheck size={18} aria-hidden />
                        ) : (
                          <IconCopy size={18} aria-hidden />
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </dl>
              <p className="text-ink-muted text-sm leading-relaxed">
                {t('lossWarning')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={() => {
                    setAtVerify(true)
                    setSetupReveal(false)
                  }}
                >
                  {t('continueToVerify')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={discardCandidate}
                >
                  {t('changeMethod')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-2">
                <div
                  className="border-hairline overflow-hidden rounded-lg border"
                  role="group"
                  aria-labelledby={primaryHeadingId}
                >
                  <div
                    id={primaryHeadingId}
                    className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm font-medium"
                  >
                    {candidate?.primaryChecked ? (
                      <IconCheck
                        size={18}
                        className="text-success"
                        aria-hidden
                      />
                    ) : (
                      <PrimaryIcon size={18} aria-hidden />
                    )}
                    {primaryLabel}
                  </div>
                  {/* Height animates via grid-template-rows 0fr to 1fr. Closed
                      bodies carry visibility:hidden (excluded from role
                      queries and the accessibility tree once collapsed) plus
                      inert, which already covers the collapse window. */}
                  <div
                    className={cn(
                      'grid grid-rows-[0fr] transition-[grid-template-rows,visibility] duration-200 motion-reduce:transition-none',
                      pending === 'primary' ? 'grid-rows-[1fr]' : 'invisible',
                    )}
                  >
                    <div
                      className="min-h-0 overflow-hidden"
                      inert={pending !== 'primary'}
                    >
                      <div className="space-y-3 px-3 pb-3">
                        {setupMethod === 'passphrase' ? (
                          <div className={secretFieldClass}>
                            <Input
                              autoComplete="off"
                              type={reveal ? 'text' : 'password'}
                              value={entry}
                              onChange={(event) => setEntry(event.target.value)}
                              aria-label={primaryLabel}
                              className={cn('pr-11', secretInputClass)}
                            />
                            <Button
                              variant="ghost"
                              iconOnly
                              size="sm"
                              pressMotion={false}
                              aria-label={t(reveal ? 'hide' : 'reveal')}
                              title={t(reveal ? 'hide' : 'reveal')}
                              className="absolute top-1/2 right-1 -translate-y-1/2"
                              onClick={() => setReveal(!reveal)}
                            >
                              {reveal ? (
                                <IconEyeOff size={18} aria-hidden />
                              ) : (
                                <IconEye size={18} aria-hidden />
                              )}
                            </Button>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={busy}
                            disabled={setupMethod === 'passphrase' && !entry}
                            onClick={() => void verify('primary')}
                          >
                            {setupMethod === 'passkey'
                              ? t('verifyPasskey')
                              : t('verifyPrimary')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="border-hairline overflow-hidden rounded-lg border"
                  role="group"
                  aria-labelledby={recoveryHeadingId}
                >
                  <div
                    id={recoveryHeadingId}
                    className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm font-medium"
                  >
                    {candidate?.recoveryChecked ? (
                      <IconCheck
                        size={18}
                        className="text-success"
                        aria-hidden
                      />
                    ) : (
                      <IconKey size={18} aria-hidden />
                    )}
                    {t('recoveryKey')}
                  </div>
                  <div
                    className={cn(
                      'grid grid-rows-[0fr] transition-[grid-template-rows,visibility] duration-200 motion-reduce:transition-none',
                      pending === 'recovery' ? 'grid-rows-[1fr]' : 'invisible',
                    )}
                  >
                    <div
                      className="min-h-0 overflow-hidden"
                      inert={pending !== 'recovery'}
                    >
                      <div className="space-y-3 px-3 pb-3">
                        <div className={secretFieldClass}>
                          <Input
                            ref={verifyEntry}
                            autoComplete="off"
                            type={reveal ? 'text' : 'password'}
                            value={entry}
                            onChange={(event) => setEntry(event.target.value)}
                            aria-label={t('recoveryKey')}
                            className={cn('pr-11', secretInputClass)}
                          />
                          <Button
                            variant="ghost"
                            iconOnly
                            size="sm"
                            pressMotion={false}
                            aria-label={t(reveal ? 'hide' : 'reveal')}
                            title={t(reveal ? 'hide' : 'reveal')}
                            className="absolute top-1/2 right-1 -translate-y-1/2"
                            onClick={() => setReveal(!reveal)}
                          >
                            {reveal ? (
                              <IconEyeOff size={18} aria-hidden />
                            ) : (
                              <IconEye size={18} aria-hidden />
                            )}
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={busy}
                            disabled={!entry}
                            onClick={() => void verify('recovery')}
                          >
                            {t('verifyRecovery')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="sr-only" role="status">
                {t('checksComplete', {
                  done:
                    Number(Boolean(candidate?.primaryChecked)) +
                    Number(Boolean(candidate?.recoveryChecked)),
                })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  ref={activateButton}
                  loading={busy}
                  disabled={
                    !candidate?.primaryChecked || !candidate?.recoveryChecked
                  }
                  onClick={() => void submit()}
                >
                  {busy ? null : <IconShieldCheck size={20} aria-hidden />}
                  {t(candidate?.submitted ? 'retrySetup' : 'activate')}
                </Button>
                {candidate?.submitted ? (
                  <Button
                    variant="secondary"
                    loading={busy}
                    onClick={() => void reconcile()}
                  >
                    {t('reconcile')}
                  </Button>
                ) : null}
                {!candidate?.submitted && (
                  <Button
                    ref={restartButton}
                    variant="ghost"
                    disabled={busy}
                    onClick={discardCandidate}
                  >
                    <IconRefresh size={18} aria-hidden /> {t('restart')}
                  </Button>
                )}
              </div>
            </div>
          )}
          {messages}
        </div>
      </section>
    )
  }
  const purpose = vault.primaryWrapper.purpose
  const replacementOpen =
    vault.authorizationVersion === 1 &&
    authorizationSchema.safeParse(vault.authorization).success
  const unlockPanel = !active ? (
    <section
      aria-label={t('unlockHeading')}
      className="border-hairline bg-paper-raised space-y-4 rounded-lg border p-4"
    >
      <p className="text-ink-muted text-sm">{t('lockedHint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          ref={methodButton}
          variant="secondary"
          disabled={busy || Boolean(replacementDraft)}
          onClick={() => {
            setRecovery(!recovery)
            setReveal(false)
            setEntry('')
          }}
        >
          {t(
            recovery
              ? purpose === 'passkey'
                ? 'usePasskey'
                : 'usePassphrase'
              : 'useRecovery',
          )}
        </Button>
      </div>
      {!replacementDraft && (recovery || purpose !== 'passkey') ? (
        <div className="space-y-2">
          <span className="block">
            {t(recovery ? 'recoveryKey' : 'passphrase')}
          </span>
          <div className={secretFieldClass}>
            <Input
              ref={credentialEntry}
              autoComplete="off"
              type={reveal ? 'text' : 'password'}
              value={entry}
              onChange={(event) => setEntry(event.target.value)}
              aria-label={t(recovery ? 'recoveryKey' : 'passphrase')}
              className={cn('pr-11', secretInputClass)}
            />
            <Button
              variant="ghost"
              iconOnly
              size="sm"
              pressMotion={false}
              aria-label={t(reveal ? 'hide' : 'reveal')}
              title={t(reveal ? 'hide' : 'reveal')}
              className="absolute top-1/2 right-1 -translate-y-1/2"
              onClick={() => setReveal(!reveal)}
            >
              {reveal ? (
                <IconEyeOff size={18} aria-hidden />
              ) : (
                <IconEye size={18} aria-hidden />
              )}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          ref={unlockButton}
          loading={busy}
          onClick={() => void unlock()}
          disabled={
            active ||
            Boolean(replacementDraft) ||
            (!entry && (recovery || purpose !== 'passkey'))
          }
        >
          {t('unlock')}
        </Button>
      </div>
    </section>
  ) : null
  const pendingBlock = signedReplacement ? (
    <div className="space-y-2">
      <p className="text-sm">{t('replacementPending')}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          loading={busy}
          onClick={() =>
            void run((version) => sendReplacement(signedReplacement, version))
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
    </div>
  ) : replacement ? (
    <div className="space-y-2">
      <p className="text-sm">{t('replacementCheck')}</p>
      <Button
        variant="secondary"
        loading={busy}
        onClick={() => void reconcile()}
      >
        {t('reconcile')}
      </Button>
    </div>
  ) : null
  const draftBlock = replacementDraft ? (
    <div className="border-hairline space-y-3 rounded-lg border p-4">
      <p className="text-ink-muted text-sm">{t('replacementConfirmHelp')}</p>
      {phrase ? <p className="font-mono break-words">{phrase}</p> : null}
      {replacementDraft.primaryWrapper.purpose !== 'passkey' ? (
        <div className="space-y-2">
          <span className="block">{t('replacementConfirmation')}</span>
          <div className={secretFieldClass}>
            <Input
              ref={confirmationEntry}
              autoComplete="off"
              type={reveal ? 'text' : 'password'}
              value={entry}
              onChange={(event) => setEntry(event.target.value)}
              aria-label={t('replacementConfirmation')}
              className={cn('pr-11', secretInputClass)}
            />
            <Button
              variant="ghost"
              iconOnly
              size="sm"
              pressMotion={false}
              aria-label={t(reveal ? 'hide' : 'reveal')}
              title={t(reveal ? 'hide' : 'reveal')}
              className="absolute top-1/2 right-1 -translate-y-1/2"
              onClick={() => setReveal(!reveal)}
            >
              {reveal ? (
                <IconEyeOff size={18} aria-hidden />
              ) : (
                <IconEye size={18} aria-hidden />
              )}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          ref={confirmButton}
          loading={busy}
          disabled={
            !entry && replacementDraft.primaryWrapper.purpose !== 'passkey'
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
      </div>
    </div>
  ) : (
    <details className="border-hairline rounded-lg border p-4">
      <summary className="min-h-10 cursor-pointer content-center text-sm">
        {t('credentialSettings')}
      </summary>
      <div className="space-y-4 pt-3">
        <p className="text-ink-muted text-sm">{t('disclosure')}</p>
        {replacementOpen && !signedReplacement ? (
          <div className="space-y-3">
            <p className="text-ink-muted text-sm">{t('replacementHelp')}</p>
            {active && purpose !== 'passkey' ? (
              <div className="space-y-2">
                <span className="block">{t('passphrase')}</span>
                <div className={secretFieldClass}>
                  <Input
                    ref={credentialEntry}
                    autoComplete="off"
                    type={reveal ? 'text' : 'password'}
                    value={entry}
                    onChange={(event) => setEntry(event.target.value)}
                    aria-label={t('passphrase')}
                    className={cn('pr-11', secretInputClass)}
                  />
                  <Button
                    variant="ghost"
                    iconOnly
                    size="sm"
                    pressMotion={false}
                    aria-label={t(reveal ? 'hide' : 'reveal')}
                    title={t(reveal ? 'hide' : 'reveal')}
                    className="absolute top-1/2 right-1 -translate-y-1/2"
                    onClick={() => setReveal(!reveal)}
                  >
                    {reveal ? (
                      <IconEyeOff size={18} aria-hidden />
                    ) : (
                      <IconEye size={18} aria-hidden />
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                ref={replacePassphraseButton}
                variant="secondary"
                loading={busy}
                disabled={!entry && (recovery || purpose !== 'passkey')}
                onClick={() => void beginReplacement('passphrase')}
              >
                {t('replacePassphrase')}
              </Button>
              <Button
                ref={replacePasskeyButton}
                variant="secondary"
                loading={busy}
                disabled={!entry && (recovery || purpose !== 'passkey')}
                onClick={() => void beginReplacement('passkey')}
              >
                {t('replacePasskey')}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-ink-muted text-sm">{t('replacementClosed')}</p>
        )}
      </div>
    </details>
  )
  return (
    <>
      {unlockPanel}
      {pendingBlock}
      {draftBlock}
      {messages}
    </>
  )
}
export default VaultControls
