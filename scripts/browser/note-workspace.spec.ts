import {test, expect, body, review} from './fixtures'
import type {SyncRequest} from '../../lib/notes/sync'

const copyBody = (page: Parameters<typeof review>[0]) =>
  review(page).getByRole('textbox', {name: 'Note content', exact: true})

async function startCopy(page: Parameters<typeof review>[0]) {
  await page.getByRole('button', {name: 'Review changes', exact: true}).click()
  await review(page)
    .getByRole('button', {name: 'Edit a copy', exact: true})
    .click()
  await expect(copyBody(page)).toBeEditable()
}

test('closing and reopening comparison preserves the working editor through mobile tabs and diff', async ({
  page,
  noteApp,
}) => {
  await page.setViewportSize({width: 390, height: 844})
  const {local} = await noteApp.conflict()
  await startCopy(page)
  const comparison = review(page)
  const editor = copyBody(page)
  const editorNode = await editor.elementHandle()
  const composition = 'Fresh composition'
  await editor.fill(composition)

  await comparison
    .getByRole('button', {name: 'Close comparison', exact: true})
    .click()
  await expect(comparison).toBeHidden()
  await expect(body(page)).toHaveText(composition)
  expect(await body(page).evaluate((el, node) => el === node, editorNode)).toBe(
    true,
  )

  await page.getByRole('button', {name: 'Review changes', exact: true}).click()
  await expect(editor).toHaveText(composition)
  await comparison
    .getByRole('tab', {name: 'Saved version', exact: true})
    .click()
  await expect(editor).toBeHidden()
  await comparison
    .getByRole('button', {name: 'Show changes', exact: true})
    .click()
  for (const word of ['Saved', 'elsewhere']) {
    await expect(
      comparison
        .getByRole('tabpanel', {name: 'Saved version'})
        .locator('del')
        .filter({hasText: word}),
    ).toBeVisible()
  }
  await comparison.getByRole('tab', {name: 'Working copy', exact: true}).click()
  for (const word of composition.split(' ')) {
    await expect(
      comparison
        .getByRole('tabpanel', {name: 'Working copy'})
        .locator('ins')
        .filter({hasText: word}),
    ).toBeVisible()
  }
  await comparison
    .getByRole('button', {name: 'Show previews', exact: true})
    .click()
  await expect(editor).toHaveText(composition)
  expect(await editor.evaluate((el, node) => el === node, editorNode)).toBe(
    true,
  )
  await editor.click()
  await comparison.getByRole('button', {name: 'Undo', exact: true}).click()
  await expect(editor).toHaveText(local)
})

test('a pending stale resolution preserves the comparison, editor, and Undo', async ({
  page,
  noteApp,
}) => {
  const {original, remote, local} = await noteApp.conflict()
  await startCopy(page)
  const comparison = review(page)
  const editor = copyBody(page)
  const editorNode = await editor.elementHandle()
  const composition = 'Keep this working copy'
  await editor.fill(composition)

  let pendingRequest: SyncRequest | undefined
  let release!: () => void
  const responseGate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/note/sync', async (route) => {
    pendingRequest = route.request().postDataJSON() as SyncRequest
    await responseGate
    await route.continue()
  })
  const useVersion = comparison.getByRole('button', {
    name: 'Use this version',
    exact: true,
  })
  try {
    await useVersion.click()
    await expect
      .poll(() => pendingRequest?.expectedRevision)
      .toBe(remote.revision)
    await expect(comparison).toBeVisible()
    await expect(useVersion).toBeDisabled()
    await expect(editor).toBeVisible()
    await expect(editor).toHaveText(composition)
    expect(await editor.evaluate((el, node) => el === node, editorNode)).toBe(
      true,
    )
    await noteApp.save(remote, {content: '<p>Newer saved version</p>'})
  } finally {
    release()
  }

  await expect(
    comparison.getByRole('region', {name: 'Saved version', exact: true}),
  ).toContainText('Newer saved version')
  await expect(useVersion).toBeEnabled()
  await expect(editor).toHaveText(composition)
  expect(await editor.evaluate((el, node) => el === node, editorNode)).toBe(
    true,
  )
  await comparison.getByRole('button', {name: 'Undo', exact: true}).click()
  await expect(editor).toHaveText(local)
  expect((await noteApp.read(original.id)).content).toBe(
    '<p>Newer saved version</p>',
  )
})
