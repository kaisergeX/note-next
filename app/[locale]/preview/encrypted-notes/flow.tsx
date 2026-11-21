'use client'

import {
  IconCheck,
  IconCopy,
  IconFingerprint,
  IconKey,
} from '@tabler/icons-react'
import {useState, type ReactNode} from 'react'
import Button from '~/components/ui/button'
import NoteScene from './note-scene'
import PreviewCollection, {sampleNotes} from './preview-collection'

export type Stage = 'setup' | 'backup' | 'verify' | 'locked' | 'open'
type Method = 'passkey' | 'passphrase'

const methods = {
  passkey: {
    icon: IconFingerprint,
    label: 'Passkey',
  },
  passphrase: {
    icon: IconKey,
    label: 'Generated passphrase',
  },
}

const sampleRecoveryKey = 'DEMO-ONLY-NOT-A-KEY'

function RecoveryKey() {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  )
  const CopyIcon = copyStatus === 'copied' ? IconCheck : IconCopy

  async function copy() {
    try {
      await navigator.clipboard.writeText(sampleRecoveryKey)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  return (
    <div className="relative grid min-h-18 content-center gap-1 py-3 pr-16 pl-4">
      <dt className="text-ink-muted text-xs font-medium">Recovery key</dt>
      <dd>
        <code className="block text-sm wrap-anywhere select-all">
          {sampleRecoveryKey}
        </code>
        <Button
          variant="ghost"
          iconOnly
          className="absolute top-1/2 right-3 -translate-y-1/2"
          pressMotion={false}
          aria-label="Copy recovery key"
          title={copyStatus === 'copied' ? 'Key copied' : 'Copy recovery key'}
          onClick={copy}
        >
          <CopyIcon size={18} aria-hidden />
        </Button>
      </dd>
      <dd
        role="status"
        className={
          copyStatus === 'failed' ? 'text-ink-muted text-xs' : 'sr-only'
        }
      >
        {copyStatus === 'copied' && 'Key copied'}
        {copyStatus === 'failed' && 'Select the key and copy it manually.'}
      </dd>
    </div>
  )
}

function Verify({
  method,
  onBack,
  onFinish,
}: {
  method: Method
  onBack: () => void
  onFinish: () => void
}) {
  const [primaryChecked, setPrimaryChecked] = useState(false)
  const [recoveryChecked, setRecoveryChecked] = useState(false)
  const checks = [
    {
      label: method,
      checked: primaryChecked,
      confirm: setPrimaryChecked,
      icon: methods[method].icon,
    },
    {
      label: 'recovery key',
      checked: recoveryChecked,
      confirm: setRecoveryChecked,
      icon: IconKey,
    },
  ]

  return (
    <>
      <NoteScene
        stage="verify"
        method={method}
        primaryChecked={primaryChecked}
        recoveryChecked={recoveryChecked}
      />
      <div className="space-y-5">
        <div className="grid gap-2">
          {checks.map(({label, checked, confirm, icon: Icon}) => (
            <Button
              key={label}
              variant="secondary"
              className="justify-start"
              aria-disabled={checked}
              onClick={() => confirm(true)}
            >
              {checked ? (
                <IconCheck size={18} className="text-success" aria-hidden />
              ) : (
                <Icon size={18} aria-hidden />
              )}
              {checked ? `Sample ${label} verified` : `Use sample ${label}`}
            </Button>
          ))}
        </div>
        <p className="sr-only" role="status">
          {Number(primaryChecked) + Number(recoveryChecked)} of 2 checks
          complete
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!primaryChecked || !recoveryChecked}
            onClick={onFinish}
          >
            Activate encrypted notes
          </Button>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>
    </>
  )
}

export default function Flow({
  stage,
  onStage,
  setupDetails,
}: {
  stage: Stage
  onStage: (stage: Stage) => void
  setupDetails: ReactNode
}) {
  const [method, setMethod] = useState<Method>('passkey')
  const [notes, setNotes] = useState(sampleNotes)
  const primary = methods[method]

  function start(nextMethod: Method) {
    setMethod(nextMethod)
    onStage('backup')
  }

  if (stage === 'setup') {
    return (
      <>
        <NoteScene stage="setup" />
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Button size="lg" onClick={() => start('passkey')}>
              <IconFingerprint size={20} aria-hidden /> Set up with passkey
            </Button>
            <Button variant="link" onClick={() => start('passphrase')}>
              Use a passphrase
            </Button>
          </div>
          {setupDetails}
        </div>
      </>
    )
  }

  if (stage === 'backup') {
    return (
      <>
        <NoteScene stage="backup" />
        <div className="space-y-5">
          <dl className="bg-paper-raised border-hairline divide-hairline divide-y rounded-lg border">
            <div className="space-y-1 p-4">
              <dt className="text-ink-muted text-xs font-medium">
                {primary.label}
              </dt>
              <dd className="text-sm break-words">
                {method === 'passkey' ? (
                  'Sample passkey'
                ) : (
                  <code>sample willow harbor lantern</code>
                )}
              </dd>
            </div>
            <RecoveryKey />
          </dl>
          <p className="text-ink-muted text-sm leading-relaxed">
            If you lose both your {method} and recovery key, you lose access to
            these notes.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onStage('verify')}>
              Continue to verification
            </Button>
            <Button variant="ghost" onClick={() => onStage('setup')}>
              Change method
            </Button>
          </div>
        </div>
      </>
    )
  }

  if (stage === 'verify') {
    return (
      <Verify
        method={method}
        onBack={() => onStage('backup')}
        onFinish={() => onStage('open')}
      />
    )
  }

  return (
    <PreviewCollection
      locked={stage === 'locked'}
      notes={notes}
      setNotes={setNotes}
      onLock={() => onStage('locked')}
      onUnlock={() => onStage('open')}
    />
  )
}
