import {test, expect, body, title, drafts, fullPath} from './fixtures'

// Light card fills are compiled from Tailwind's palette; those variables need
// not be emitted into the browser stylesheet by the note-theme plugin.
const lightColors = {
  blue: 'oklch(93.2% 0.032 255.585)',
  red: 'oklch(93.6% 0.032 17.717)',
  green: 'oklch(96.2% 0.044 156.743)',
}

for (const mode of ['light', 'dark'] as const) {
  test(`authored card colors survive browser recovery and saving in ${mode} mode`, async ({
    page,
    noteApp,
  }, testInfo) => {
    await page.emulateMedia({colorScheme: mode})
    const original = await noteApp.create()
    const saved = await noteApp.save(original, {theme: 'blue'})
    await page.route('**/api/note/sync', (route) =>
      route.fulfill({status: 503, json: {status: 'retryable_error'}}),
    )
    await page.goto('/en/eton')

    const checkCard = async (text: string, hue: 'blue' | 'red' | 'green') => {
      const link = page.getByRole('link').filter({hasText: text})
      await expect(link).toHaveCount(1)
      const card = link.locator('..')
      const expected = await page.evaluate(
        ({mode, hue, lightColor}) => {
          const probe = document.createElement('div')
          probe.style.backgroundColor =
            mode === 'dark'
              ? `color-mix(in oklab, var(--color-${hue}-950) 15%, var(--paper-raised))`
              : lightColor
          document.body.append(probe)
          const color = getComputedStyle(probe).backgroundColor
          probe.remove()
          return color
        },
        {mode, hue, lightColor: lightColors[hue]},
      )
      expect(expected).not.toBe('rgba(0, 0, 0, 0)')
      // The production CSS optimizer may serialize OKLCH as Lab. Compare the
      // rendered sRGB pixels so equivalent color spaces pass the same check.
      await expect
        .poll(() =>
          card.evaluate((element, expected) => {
            const canvas = document.createElement('canvas')
            canvas.width = canvas.height = 1
            const context = canvas.getContext('2d')!
            const pixel = (color: string) => {
              context.clearRect(0, 0, 1, 1)
              context.fillStyle = color
              context.fillRect(0, 0, 1, 1)
              return [...context.getImageData(0, 0, 1, 1).data]
            }
            return (
              JSON.stringify(
                pixel(getComputedStyle(element).backgroundColor),
              ) === JSON.stringify(pixel(expected))
            )
          }, expected),
        )
        .toBe(true)
    }
    const choose = async (hue: 'red' | 'green') => {
      await page
        .getByRole('button', {name: 'Choose note theme', exact: true})
        .click()
      await page
        .getByRole('button', {name: `Set note theme to ${hue}`, exact: true})
        .click()
      await page.keyboard.press('Escape')
    }
    const close = async () => {
      await page
        .getByRole('button', {name: 'Save and go back', exact: true})
        .click()
      await expect(page).toHaveURL(/\/en\/eton(?:\?|$)/)
    }

    await checkCard('Original body', 'blue')
    await page.goto(fullPath(saved))
    await body(page).fill('Colored browser continuation')
    await choose('red')
    await expect
      .poll(async () =>
        (await drafts(page)).some(
          (row) => row.noteId === saved.id && row.draft.theme === 'red',
        ),
      )
      .toBe(true)
    await close()
    await checkCard('Colored browser continuation', 'red')
    await page.reload()
    await checkCard('Colored browser continuation', 'red')
    expect((await noteApp.read(saved.id)).theme).toBe('blue')

    await page.goto('/en/full/eton/new')
    await title(page).fill('Colored browser-only note')
    await body(page).fill('New colored work')
    await choose('green')
    await expect
      .poll(async () =>
        (await drafts(page)).some(
          (row) => !row.noteId && row.draft.theme === 'green',
        ),
      )
      .toBe(true)
    await close()
    await checkCard('Colored browser-only note', 'green')
    await page.reload()
    await checkCard('Colored browser-only note', 'green')
    const screenshot = testInfo.outputPath(`recovery-card-colors-${mode}.png`)
    await page.screenshot({path: screenshot})
    await testInfo.attach(`recovery-card-colors-${mode}`, {
      path: screenshot,
      contentType: 'image/png',
    })

    await page.unroute('**/api/note/sync')
    await page
      .getByRole('link')
      .filter({hasText: 'Colored browser-only note'})
      .click()
    await expect(body(page)).toHaveText('New colored work')
    await expect.poll(async () => (await noteApp.all()).length).toBe(2)
    const created = (await noteApp.all()).find((note) => note.id !== saved.id)!
    await expect(page).toHaveURL(
      new RegExp(`/full/eton/${created.id}(?:\\?|$)`),
    )
    expect(created.theme).toBe('green')
    await close()
    await checkCard('Colored browser-only note', 'green')

    await page
      .getByRole('link')
      .filter({hasText: 'Colored browser continuation'})
      .click()
    await expect(body(page)).toHaveText('Colored browser continuation')
    await expect
      .poll(async () => (await noteApp.read(saved.id)).theme)
      .toBe('red')
    await close()
    await checkCard('Colored browser continuation', 'red')
  })
}
