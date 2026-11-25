import type {Locator, Page} from '@playwright/test'
import {test, expect} from './fixtures'
import en from '../../dictionaries/en.json' with {type: 'json'}
import vi from '../../dictionaries/vi.json' with {type: 'json'}

// Traverse the real tab order rather than focusing the requested control directly.
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 60; i++) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      await expect(target).toBeFocused()
      return
    }
    await page.keyboard.press('Tab')
  }
  throw new Error('Control was not reachable through the keyboard tab order')
}

for (const [locale, messages] of [
  ['en', en],
  ['vi', vi],
] as const) {
  test(`${locale} vault setup, recovery and paused-sync resume work with keyboard controls`, async ({
    page,
    noteApp,
  }) => {
    test.setTimeout(120_000)
    // Request the fixture before entering this synthetic account's collection.
    expect(noteApp.ownerId).toBeTruthy()
    const v = messages.note.vault
    const n = messages.note.encryption
    const e = messages.note.encryptedEditor
    await page.goto(`/${locale}/collection/encrypted`)
    const controls = page.getByRole('region', {name: v.heading, exact: true})
    const button = (name: string) =>
      controls.getByRole('button', {name, exact: true})
    const activate = async (target: Locator) => {
      await tabTo(page, target)
      await page.keyboard.press('Enter')
    }
    const enter = async (target: Locator, value: string) => {
      await tabTo(page, target)
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.insertText(value)
    }

    await activate(button(v.setup))
    const phrase = await controls.locator('p.font-mono').first().innerText()
    await activate(button(v.reveal))
    const recovery = await controls.locator('p.font-mono').nth(1).innerText()
    await activate(button(v.hide))
    await activate(button(v.continueToVerify))
    const primaryEntry = controls.getByRole('textbox', {
      name: v.passphraseLabel,
      exact: true,
    })
    const recoveryEntry = controls.getByRole('textbox', {
      name: v.recoveryKey,
      exact: true,
    })
    const primaryCard = controls.getByRole('group', {
      name: v.passphraseLabel,
      exact: true,
    })
    await enter(primaryEntry, phrase)
    await activate(button(v.verifyPrimary))
    await expect(
      primaryCard.getByRole('button', {name: v.verifyPrimary}),
    ).toBeHidden()
    await expect(recoveryEntry).toBeFocused()
    await enter(recoveryEntry, recovery)
    await activate(button(v.verifyRecovery))
    await expect(button(v.verifyRecovery)).toBeHidden()
    await expect(button(v.activate)).toBeFocused()
    await activate(button(v.activate))

    const passphrase = controls.getByLabel(v.passphrase, {exact: true})
    await expect(passphrase).toHaveAttribute('type', 'password')
    await enter(passphrase, phrase)
    await activate(button(v.unlock))
    await expect(
      controls.getByRole('status').filter({hasText: v.unlocked}),
    ).toBeVisible()
    await expect(button(v.unlock)).toBeDisabled()
    await expect(
      page.getByRole('button', {name: n.create, exact: true}),
    ).toBeVisible()
    await activate(button(v.lock))
    await expect(
      controls.getByRole('status').filter({hasText: v.locked}),
    ).toBeVisible()

    const replacement = controls.getByLabel(v.replacementConfirmation, {
      exact: true,
    })
    await enter(passphrase, phrase)
    await activate(button(v.replacePassphrase))
    await expect(replacement).toBeFocused()
    await activate(button(v.cancelReplacement))
    await expect(passphrase).toBeFocused()
    await expect(passphrase).toBeEmpty()
    await enter(passphrase, phrase)
    await activate(button(v.replacePassphrase))
    await expect(replacement).toBeFocused()
    const newPhrase = await controls.locator('p.font-mono').first().innerText()
    await enter(replacement, newPhrase)
    await activate(button(v.confirmReplacement))
    await expect(
      controls.getByRole('status').filter({hasText: v.replacementChanged}),
    ).toBeVisible()
    await expect(passphrase).toBeFocused()
    await expect(passphrase).toBeEmpty()

    // A reload removes in-memory keys; recovery must work without the phrase.
    await page.reload()
    await activate(button(v.useRecovery))
    const unlockRecoveryEntry = controls.getByLabel(v.recoveryKey, {
      exact: true,
    })
    await expect(unlockRecoveryEntry).toHaveAttribute('type', 'password')
    await enter(unlockRecoveryEntry, recovery)
    await activate(button(v.unlock))
    await expect(
      controls.getByRole('status').filter({hasText: v.unlocked}),
    ).toBeVisible()
    await activate(page.getByRole('button', {name: n.create, exact: true}))
    const encryptedWrites = '**/api/note-encryption/*'
    await page.route(encryptedWrites, async (route) => {
      if (route.request().method() !== 'PUT') return route.continue()
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({status: 'unauthenticated'}),
      })
    })
    await enter(
      page.getByRole('textbox', {name: e.body, exact: true}),
      'Synthetic keyboard recovery note',
    )
    await expect(
      page.getByRole('status').filter({hasText: e.unauthenticated}),
    ).toBeVisible()
    await tabTo(page, page.getByRole('link', {name: e.signIn, exact: true}))
    await page.unroute(encryptedWrites)
    await activate(
      page.getByRole('button', {name: e.resumeAfterSignIn, exact: true}),
    )
    await expect(
      page.getByRole('status').filter({hasText: e.synced}),
    ).toBeVisible()
    await activate(button(v.lock))
    await expect(
      controls.getByRole('status').filter({hasText: v.locked}),
    ).toBeVisible()
  })
}
