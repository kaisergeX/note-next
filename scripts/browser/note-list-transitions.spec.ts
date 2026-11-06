import type {Page} from '@playwright/test'
import {test, expect, body, title} from './fixtures'

async function trackMotion(page: Page) {
  return page.evaluateHandle(() => {
    const state = {frames: 0, overlap: 0, moves: 0, effects: 0}
    const seen = new WeakSet<Animation>()
    let running = true
    const sample = () => {
      state.frames++
      const dialogVisible = [...document.querySelectorAll('dialog')].some(
        (dialog) =>
          dialog.getBoundingClientRect().height > 0 &&
          Number(getComputedStyle(dialog).opacity) > 0,
      )
      for (const animation of document.getAnimations()) {
        const effect = animation.effect
        if (
          !(effect instanceof KeyframeEffect) ||
          !effect.pseudoElement?.includes('view-transition')
        )
          continue
        if (dialogVisible) state.overlap++
        if (seen.has(animation)) continue
        seen.add(animation)
        state.effects++
        const keys = effect.getKeyframes()
        if (keys[0]?.transform && keys[0].transform !== keys.at(-1)?.transform)
          state.moves++
      }
      if (running) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    return {
      state,
      stop: () => {
        running = false
      },
    }
  })
}

for (const reduced of [false, true]) {
  test(`real creation waits for the dialog, preserves latest edits and animates the list${reduced ? ' with reduced motion' : ''}`, async ({
    page,
    noteApp,
  }) => {
    await page.emulateMedia({
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    })
    for (let index = 0; index < 3; index++) {
      const note = await noteApp.create()
      await noteApp.save(note, {title: `<p>Existing note ${index}</p>`})
    }
    await page.goto('/en/eton')
    const cards = page.locator('section[aria-label="Notes"] > ul > li')
    const links = page.locator(
      'section[aria-label="Notes"] > ul > li > div > a',
    )
    await expect(cards).toHaveCount(3)
    const original = await links.evaluateAll((items) =>
      items.map((item) => item.getAttribute('href')),
    )

    await page.getByRole('button', {name: 'New note', exact: true}).click()
    const dialog = page.getByRole('dialog', {name: 'New note', exact: true})
    await expect(dialog).toBeVisible()
    const motion = await trackMotion(page)
    try {
      await title(page).fill('First autosaved title')
      await expect
        .poll(async () =>
          (await noteApp.all()).some((note) =>
            note.title?.includes('First autosaved title'),
          ),
        )
        .toBe(true)
      await expect(cards).toHaveCount(3)

      await title(page).fill('Latest title before closing')
      await body(page).fill('Latest content before closing')
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
      await expect(cards).toHaveCount(4)
      await page.waitForFunction(() => !document.activeViewTransition)
      const result = await motion.evaluate((audit) => audit.state)
      expect(result.frames).toBeGreaterThan(0)
      expect(result.overlap).toBe(0)
      if (reduced) expect(result.effects).toBe(0)
      else expect(result.moves).toBeGreaterThan(0)
    } finally {
      await motion.evaluate((audit) => audit.stop())
      await motion.dispose()
    }

    const saved = (await noteApp.all()).find((note) =>
      note.title?.includes('Latest title before closing'),
    )!
    expect(saved.content).toContain('Latest content before closing')
    await expect(links.first()).toHaveAttribute('href', `/en/eton/${saved.id}`)
    expect(
      await links.evaluateAll((items) =>
        items.slice(1).map((item) => item.getAttribute('href')),
      ),
    ).toEqual(original)
    await page.reload()
    await expect(links.first()).toHaveAttribute('href', `/en/eton/${saved.id}`)
    const created = cards.filter({hasText: 'Latest title before closing'})
    await expect(created).toHaveCount(1)
    await expect(created).toContainText('Latest content before closing')

    const removal = await trackMotion(page)
    try {
      await created
        .getByRole('button', {name: 'More note actions', exact: true})
        .click()
      await page
        .getByRole('button', {name: 'Move to Trash', exact: true})
        .click()
      await expect(created).toHaveCount(0)
      await page.waitForFunction(() => !document.activeViewTransition)
      const result = await removal.evaluate((audit) => audit.state)
      expect(result.overlap).toBe(0)
      if (reduced) expect(result.effects).toBe(0)
      else expect(result.moves).toBeGreaterThan(0)
    } finally {
      await removal.evaluate((audit) => audit.stop())
      await removal.dispose()
    }
  })
}
