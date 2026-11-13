import {test} from 'node:test'
import assert from 'node:assert/strict'
import {
  activateVault,
  currentVaultEpoch,
  discardBlockedEdits,
  getVaultRoot,
  lockVault,
  registerVaultCheckpoint,
} from '../lib/notes/encryption/runtime'
import {generateRoot, importRoot} from '../lib/notes/encryption/crypto'

test('lock releases successful and explicitly discarded checkpoint callbacks', async () => {
  const previousDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  )
  Object.defineProperty(globalThis, 'document', {
    value: {hidden: false},
    configurable: true,
  })
  const ownerId = crypto.randomUUID(),
    vaultId = crypto.randomUUID()
  const root = await importRoot(generateRoot())
  try {
    activateVault(ownerId, vaultId, root, currentVaultEpoch())
    let successful = 0
    registerVaultCheckpoint(ownerId, async () => {
      successful++
    })
    assert.equal(await lockVault(ownerId, false), true)
    assert.equal(getVaultRoot(ownerId, vaultId), null)
    activateVault(ownerId, vaultId, root, currentVaultEpoch())
    assert.equal(await lockVault(ownerId, false), true)
    assert.equal(successful, 1)

    activateVault(ownerId, vaultId, root, currentVaultEpoch())
    let failures = 0
    registerVaultCheckpoint(ownerId, async () => {
      failures++
      throw new Error('Quota')
    })
    assert.equal(await lockVault(ownerId, false), false)
    discardBlockedEdits(ownerId)
    activateVault(ownerId, vaultId, root, currentVaultEpoch())
    assert.equal(await lockVault(ownerId, false), true)
    assert.equal(failures, 1)

    activateVault(ownerId, vaultId, root, currentVaultEpoch())
    let retries = 0
    registerVaultCheckpoint(ownerId, async () => {
      if (++retries === 1) throw new Error('Quota')
    })
    assert.equal(await lockVault(ownerId, false), false)
    assert.equal(await lockVault(ownerId, false), true)
    activateVault(ownerId, vaultId, root, currentVaultEpoch())
    assert.equal(await lockVault(ownerId, false), true)
    assert.equal(retries, 2)
  } finally {
    if (previousDocument)
      Object.defineProperty(globalThis, 'document', previousDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
