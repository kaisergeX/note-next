import assert from 'node:assert/strict'
import {test} from 'node:test'
import {encode} from 'next-auth/jwt'
import {matchesSessionUser} from '../lib/auth/session-identity'
import {
  hasFreshDeleteVerification,
  DELETE_VERIFICATION_SECONDS,
} from '../lib/account/policy'
import {encodeDeleteIntent, decodeDeleteIntent} from '../lib/account/reauth'
import {
  isAccountNetworkPath,
  isPrecacheablePath,
} from '../lib/notes/network-policy'

test('deleted or email-only sessions cannot attach to a new account with the same email', () => {
  assert.equal(matchesSessionUser(undefined, {id: 'new'}), false)
  assert.equal(matchesSessionUser('deleted', null), false)
  assert.equal(matchesSessionUser('deleted', {id: 'new'}), false)
  assert.equal(matchesSessionUser('existing', {id: 'existing'}), true)
})

test('destructive verification expires and rejects absent, future, or malformed timestamps', () => {
  const now = 1000000
  for (const value of [
    undefined,
    null,
    '1000000',
    NaN,
    Infinity,
    now + 1,
    now - DELETE_VERIFICATION_SECONDS * 1000,
  ])
    assert.equal(hasFreshDeleteVerification(value, now), false)
  assert.equal(hasFreshDeleteVerification(now - 1000, now), true)
})

test('reauthentication intent is encrypted, identity-bound, expiring, and tamper-resistant', async () => {
  const intent = {
    userId: 'original-user',
    email: 'fixture@test.invalid',
    locale: 'en' as const,
  }
  const encoded = await encodeDeleteIntent(intent)
  assert.ok(!encoded.includes(intent.email))
  assert.deepEqual(await decodeDeleteIntent(encoded), intent)
  assert.equal(await decodeDeleteIntent(`${encoded.slice(0, -5)}xxxxx`), null)
  const expired = await encode({
    secret: (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET)!,
    salt: 'account-delete-verification',
    maxAge: -60,
    token: {...intent, purpose: 'account-delete-verification'},
  })
  assert.equal(await decodeDeleteIntent(expired), null)
  const wrongPurpose = await encode({
    secret: (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET)!,
    salt: 'other-purpose',
    token: intent,
  })
  assert.equal(await decodeDeleteIntent(wrongPurpose), null)
})

test('account and session responses stay outside service-worker caches', () => {
  for (const path of [
    '/api/auth/session',
    '/api/user/account',
    '/api/user/appearance',
    '/en/settings/account',
    '/vi/settings/account.rsc',
    '/user/info',
  ]) {
    assert.equal(isAccountNetworkPath(path), true, path)
    assert.equal(isPrecacheablePath(path), false, path)
  }
  assert.equal(isAccountNetworkPath('/en/settings/appearance'), false)
  assert.equal(isAccountNetworkPath('/api/users'), false)
})
