import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {webcrypto} from 'node:crypto'
import {chromium, firefox, webkit} from '@playwright/test'

// Offline design probe only: no vault, account, or application endpoint.
const fixture = JSON.parse(
  await readFile(
    new URL('./fixtures/note-encryption-signed-intents.json', import.meta.url),
    'utf8',
  ),
)
const curve = {name: 'ECDSA', namedCurve: 'P-256'}
const algorithm = {name: 'ECDSA', hash: 'SHA-256'}
const message = 'note-encryption signature compatibility probe'
const bytes = new TextEncoder().encode(message)
const subtle = webcrypto.subtle
const keys = await subtle.generateKey(curve, false, ['sign', 'verify'])
const nodePublic = Array.from(
  new Uint8Array(await subtle.exportKey('raw', keys.publicKey)),
)
const nodeSignature = Array.from(
  new Uint8Array(await subtle.sign(algorithm, keys.privateKey, bytes)),
)

// This same self-contained function runs independently in Node and each browser.
// Reconstruct positions explicitly: object insertion order must have no effect.
async function checkVectors({fixture, wrongPublic}) {
  const subtle = globalThis.crypto.subtle
  const curve = {name: 'ECDSA', namedCurve: 'P-256'}
  const algorithm = {name: 'ECDSA', hash: 'SHA-256'}
  const decode = (value) =>
    Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
      c.charCodeAt(0),
    )
  const encode = (value) =>
    btoa(String.fromCharCode(...value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  const serialize = (input) => {
    const w = input.wrapper
    return JSON.stringify([
      input.domain,
      input.version,
      input.operation,
      input.ownerId,
      input.vaultId,
      input.verifierId,
      input.expectedRevision,
      input.operationId,
      [
        w.version,
        w.algorithm,
        w.ownerId,
        w.vaultId,
        w.wrapperId,
        w.purpose,
        w.profileId,
        w.passkeyBinding,
        w.salt,
        w.iv,
        w.ciphertext,
      ],
    ])
  }
  const bytes = (value) => new TextEncoder().encode(value)
  const check = (condition, label) => {
    if (!condition) throw new Error(label)
  }
  const raw = decode(fixture.publicKeyRaw)
  check(raw.length === 65 && raw[0] === 4, 'raw verifier encoding')
  check(
    encode(new Uint8Array(await subtle.digest('SHA-256', raw))) ===
      fixture.publicKeySha256,
    'verifier fingerprint',
  )
  const verifier = await subtle.importKey('raw', raw, curve, false, ['verify'])
  const wrongVerifier = await subtle.importKey(
    'raw',
    new Uint8Array(wrongPublic),
    curve,
    false,
    ['verify'],
  )
  const reverseObjects = (value) =>
    Array.isArray(value)
      ? value.map(reverseObjects)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .reverse()
              .map(([key, child]) => [key, reverseObjects(child)]),
          )
        : value
  // Every leaf is signed, including explicit nulls and each passkey tuple slot.
  const leaves = (value, path = []) =>
    value && typeof value === 'object'
      ? Object.entries(value).flatMap(([key, child]) =>
          leaves(child, [...path, key]),
        )
      : [path]
  let substitutions = 0
  for (const vector of fixture.vectors) {
    const text = serialize(vector.input)
    check(text === vector.messageUtf8, `${vector.name}: literal UTF-8 message`)
    const digest = Array.from(
      new Uint8Array(await subtle.digest('SHA-256', bytes(text))),
      (byte) => byte.toString(16).padStart(2, '0'),
    ).join('')
    check(digest === vector.messageSha256, `${vector.name}: message digest`)
    check(
      vector.input.verifierId === fixture.publicKeySha256,
      `${vector.name}: verifier ID`,
    )
    const signature = decode(vector.signatureP1363)
    check(signature.length === 64, `${vector.name}: P1363 signature`)
    const verify = (text, key = verifier) =>
      subtle.verify(algorithm, key, signature, bytes(text))
    check(await verify(text), `${vector.name}: fixed signature`)
    check(
      !(await verify(text, wrongVerifier)),
      `${vector.name}: wrong key rejected`,
    )
    const reordered = serialize(reverseObjects(vector.input))
    check(
      reordered === text && (await verify(reordered)),
      `${vector.name}: object property order`,
    )
    for (const path of leaves(vector.input)) {
      const changed = structuredClone(vector.input)
      const parent = path
        .slice(0, -1)
        .reduce((value, key) => value[key], changed)
      const key = path.at(-1)
      const value = parent[key]
      parent[key] =
        path.join('.') === 'expectedRevision'
          ? '99999999-9999-4999-8999-999999999999'
          : value === null
            ? 'changed-null'
            : typeof value === 'number'
              ? value + 1
              : value + '!'
      check(
        !(await verify(serialize(changed))),
        `${vector.name}: binds ${path.join('.')}`,
      )
      substitutions++
    }
  }
  return {vectors: fixture.vectors.length, substitutions}
}

console.log(
  'Node fixed vectors:',
  await checkVectors({fixture, wrongPublic: nodePublic}),
)
for (const engine of [chromium, firefox, webkit]) {
  const browser = await engine.launch()
  try {
    const page = await browser.newPage()
    const url = 'http://localhost/signature-compatibility'
    await page.route(url, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<title>Local compatibility probe</title>',
      }),
    )
    await page.goto(url)
    const vectors = await page.evaluate(checkVectors, {
      fixture,
      wrongPublic: nodePublic,
    })
    assert.equal(vectors.vectors, 2)
    const result = await page.evaluate(
      async ({curve, algorithm, message, nodePublic, nodeSignature}) => {
        const subtle = crypto.subtle
        const data = new TextEncoder().encode(message)
        const verifier = await subtle.importKey(
          'raw',
          new Uint8Array(nodePublic),
          curve,
          false,
          ['verify'],
        )
        const accepted = await subtle.verify(
          algorithm,
          verifier,
          new Uint8Array(nodeSignature),
          data,
        )
        const keys = await subtle.generateKey(curve, false, ['sign', 'verify'])
        return {
          accepted,
          publicKey: Array.from(
            new Uint8Array(await subtle.exportKey('raw', keys.publicKey)),
          ),
          signature: Array.from(
            new Uint8Array(await subtle.sign(algorithm, keys.privateKey, data)),
          ),
        }
      },
      {curve, algorithm, message, nodePublic, nodeSignature},
    )
    assert.equal(result.accepted, true)
    assert.equal(result.publicKey.length, 65)
    assert.equal(result.publicKey[0], 4)
    assert.equal(result.signature.length, 64)
    const verifier = await subtle.importKey(
      'raw',
      new Uint8Array(result.publicKey),
      curve,
      false,
      ['verify'],
    )
    const signature = new Uint8Array(result.signature)
    assert.equal(
      await subtle.verify(algorithm, verifier, signature, bytes),
      true,
    )
    assert.equal(
      await subtle.verify(
        algorithm,
        verifier,
        signature,
        new TextEncoder().encode(message + '!'),
      ),
      false,
    )
    console.log(
      `${engine.name()} ${browser.version()} and Node ${process.versions.node}: fresh primitive verified both directions; ${vectors.vectors} fixed vectors and ${vectors.substitutions} field substitutions passed`,
    )
  } finally {
    await browser.close()
  }
}
