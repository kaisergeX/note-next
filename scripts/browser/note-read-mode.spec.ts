import {test, expect, body, title, fullPath} from './fixtures'

for (const mobile of [false, true]) {
  test(`reading mode preserves selection, content, and undo on ${mobile ? 'mobile' : 'desktop'}`, async ({
    page,
    noteApp,
  }) => {
    if (mobile) await page.setViewportSize({width: 390, height: 844})
    const note = await noteApp.create()
    let saves = 0
    page.on('request', (request) => {
      if (request.url().endsWith('/api/note/sync')) saves++
    })
    await page.goto(fullPath(note))
    await expect(body(page)).toHaveText('Original body')
    if (!mobile) {
      await expect(body(page)).toBeEditable()
      await page.getByRole('button', {name: 'Read', exact: true}).click()
    }
    await expect(body(page)).not.toBeEditable()
    await expect(title(page)).not.toBeEditable()
    await expect(
      page.getByRole('button', {name: 'Bold', exact: true}),
    ).toBeHidden()
    await body(page).click()
    await page.keyboard.type('Accidental typing')
    await expect(body(page)).toHaveText('Original body')
    expect((await noteApp.read(note.id)).revision).toBe(note.revision)
    expect(saves).toBe(0)

    // Select a passage as a reader would before choosing Edit.
    await body(page).evaluate((element) => {
      const text = element.querySelector('p')!.firstChild!
      const range = document.createRange()
      range.setStart(text, 0)
      range.setEnd(text, 8)
      window.getSelection()!.removeAllRanges()
      window.getSelection()!.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    })
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe('Original')
    await page.getByRole('button', {name: 'Edit', exact: true}).click()
    await expect(body(page)).toBeEditable()
    await expect(body(page)).toBeFocused()
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe('Original')
    await page.keyboard.type('Updated')
    await expect(body(page)).toHaveText('Updated body')
    const editorNode = await body(page).elementHandle()
    await page.getByRole('button', {name: 'Read', exact: true}).click()
    await expect(body(page)).not.toBeEditable()
    await expect(body(page)).toHaveText('Updated body')
    await expect
      .poll(async () => (await noteApp.read(note.id)).content)
      .toBe('<p>Updated body</p>')
    await page.getByRole('button', {name: 'Edit', exact: true}).click()
    expect(
      await body(page).evaluate((el, node) => el === node, editorNode),
    ).toBe(true)
    await page.getByRole('button', {name: 'Undo', exact: true}).click()
    await expect(body(page)).toHaveText('Original body')
  })
}

test('desktop note dialog supports reading mode without losing its navigation', async ({
  page,
  noteApp,
}) => {
  const note = await noteApp.create()
  await page.goto('/en/eton')
  await page.locator(`a[href="/en/eton/${note.id}"]`).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', {name: 'Read', exact: true}).click()
  await expect(body(page)).not.toBeEditable()
  await expect(dialog.getByRole('link', {name: 'Full page view'})).toBeVisible()
  await dialog.getByRole('button', {name: 'Edit', exact: true}).click()
  await expect(body(page)).toBeEditable()
  await dialog
    .getByRole('button', {name: 'Save and go back', exact: true})
    .click()
  await expect(dialog).toBeHidden()
})

test('a new mobile note starts in edit mode', async ({page, noteApp}) => {
  await noteApp.signIn()
  await page.setViewportSize({width: 390, height: 844})
  await page.goto('/en/full/eton/new', {waitUntil: 'domcontentloaded'})
  await expect(body(page)).toBeEditable()
  await expect(title(page)).toBeEditable()
  await expect(
    page.getByRole('button', {name: 'Read', exact: true}),
  ).toBeVisible()
})
