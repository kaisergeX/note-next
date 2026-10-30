import {test, expect, body, drafts, review, fullPath} from './fixtures'
import type {SyncRequest} from '../../lib/notes/sync'

const copyBody = (page: Parameters<typeof review>[0]) =>
  review(page).getByRole('textbox', {name: 'Note content', exact: true})

async function startCopy(page: Parameters<typeof review>[0]) {
  await page.getByRole('button', {name: 'Review changes', exact: true}).click()
  await review(page)
    .getByRole('button', {name: 'Edit a copy', exact: true})
    .click()
  await expect(copyBody(page)).toBeVisible()
}

test('identical copy stays distinct, edits one durable version, reloads and keeps mobile undo', async ({
  page,
  noteApp,
}) => {
  const {original, remote, local} = await noteApp.conflict()
  await startCopy(page)
  await expect
    .poll(
      async () =>
        (await drafts(page)).filter((row) => row.noteId === original.id).length,
    )
    .toBe(2)
  const initial = await drafts(page)
  const source = initial.find((row) => row.retainedSource)!
  const copy = initial.find((row) => row.editedCopyOf)!
  expect(copy.draft).toEqual(source.draft)
  expect(copy.editedCopyOf).toBe(source.versionId)
  await copyBody(page).fill('Composed Tiếng Việt')
  await expect
    .poll(
      async () =>
        (await drafts(page)).find((row) => row.editedCopyOf)?.draft.content,
    )
    .toBe('<p>Composed Tiếng Việt</p>')
  await page.setViewportSize({width: 390, height: 844})
  await review(page)
    .getByRole('tab', {name: 'Saved version', exact: true})
    .click()
  await review(page)
    .getByRole('tab', {name: 'Working copy', exact: true})
    .click()
  await expect(copyBody(page)).toHaveText('Composed Tiếng Việt')
  await expect(
    review(page).getByRole('button', {name: 'Undo', exact: true}),
  ).toBeEnabled()
  await page.reload()
  await expect(copyBody(page)).toHaveText('Composed Tiếng Việt')
  expect((await drafts(page)).filter((row) => row.editedCopyOf)).toHaveLength(1)
  expect(
    (await drafts(page)).find((row) => row.retainedSource)?.draft.content,
  ).toBe(`<p>${local}</p>`)
  expect((await noteApp.read(original.id)).revision).toBe(remote.revision)
  await review(page)
    .getByRole('button', {name: 'Close comparison', exact: true})
    .click()
  await page
    .getByRole('button', {name: 'Review other versions', exact: true})
    .click()
  await expect(
    page
      .getByRole('button', {name: /^Choose browser version:/})
      .getByText('Working copy', {exact: true}),
  ).toBeVisible()
})

test('copy rejects a stale revision without changing composition and retains source after saving', async ({
  page,
  noteApp,
}) => {
  const {original, remote, local} = await noteApp.conflict()
  await startCopy(page)
  await copyBody(page).fill('Manually composed result')
  const newer = await noteApp.save(remote, {
    content: '<p>Another session changed this</p>',
  })
  await review(page)
    .getByRole('button', {name: 'Use this version', exact: true})
    .click()
  await expect(
    review(page).getByRole('region', {name: 'Saved version', exact: true}),
  ).toContainText('Another session changed this')
  await expect(copyBody(page)).toHaveText('Manually composed result')
  expect((await noteApp.read(original.id)).revision).toBe(newer.revision)
  await review(page)
    .getByRole('button', {name: 'Use this version', exact: true})
    .click()
  await expect(review(page)).not.toBeVisible()
  await expect
    .poll(async () => (await noteApp.read(original.id)).content)
    .toBe('<p>Manually composed result</p>')
  await expect
    .poll(
      async () =>
        (await drafts(page)).filter((row) => row.noteId === original.id).length,
    )
    .toBe(1)
  expect((await drafts(page))[0].draft.content).toBe(`<p>${local}</p>`)
  await page.reload()
  await expect(body(page)).toHaveText('Manually composed result')
  await expect(
    page.getByRole('button', {name: 'Review other versions', exact: true}),
  ).toBeVisible()
})

test('discarding a copy returns to its source and allows a fresh copy', async ({
  page,
  noteApp,
}) => {
  const {original, local} = await noteApp.conflict()
  await startCopy(page)
  await copyBody(page).fill('Discard this composition')
  await expect
    .poll(
      async () =>
        (await drafts(page)).find((row) => row.editedCopyOf)?.draft.content,
    )
    .toBe('<p>Discard this composition</p>')
  await review(page)
    .getByRole('button', {name: 'Manage local versions', exact: true})
    .click()
  await page.getByRole('button', {name: 'Discard', exact: true}).click()
  const confirmation = page.getByRole('dialog', {
    name: 'Discard this browser copy?',
    exact: true,
  })
  await confirmation.getByRole('button', {name: 'Discard', exact: true}).click()
  await expect(
    review(page).getByRole('region', {name: 'Your version', exact: true}),
  ).toContainText(local)
  expect(
    (await drafts(page)).filter(
      (row) => row.noteId === original.id && row.editedCopyOf,
    ),
  ).toHaveLength(0)
  await review(page)
    .getByRole('button', {name: 'Edit a copy', exact: true})
    .click()
  await expect(copyBody(page)).toHaveText(local)
})

for (const reload of [false, true]) {
  test(`edited Keep both retries a lost response ${reload ? 'after reload' : 'in place'} and preserves source`, async ({
    page,
    noteApp,
  }) => {
    const {original, remote, local} = await noteApp.conflict()
    await startCopy(page)
    await copyBody(page).fill('Copy to a separate note')
    const creations: SyncRequest[] = []
    await page.route('**/api/note/sync', async (route) => {
      const request = route.request().postDataJSON() as SyncRequest
      if (!request.noteId) {
        creations.push(request)
        if (creations.length === 1) {
          await route.fetch()
          await route.abort('failed')
          return
        }
      }
      await route.continue()
    })
    await review(page)
      .getByRole('button', {name: 'Keep both', exact: true})
      .click()
    await expect(page).toHaveURL(/\/recover\//)
    if (reload) await page.reload()
    else await page.getByRole('button', {name: 'Retry', exact: true}).click()
    await expect(page).toHaveURL(
      new RegExp(`/full/eton/${creations[0].creationId}(?:\\?version=[^&]+)?$`),
    )
    expect(creations).toHaveLength(2)
    expect(creations[1]).toEqual(creations[0])
    expect((await noteApp.read(original.id)).revision).toBe(remote.revision)
    expect((await noteApp.all()).length).toBe(2)
    expect(
      (await drafts(page)).find((row) => row.retainedSource)?.draft.content,
    ).toBe(`<p>${local}</p>`)
    await page.goto(fullPath(original))
    await expect(
      page.getByRole('button', {name: 'Review changes', exact: true}),
    ).toBeVisible()
  })
}

test('an unresolved edited copy survives account switching without exposing either version', async ({
  page,
  noteApp,
}) => {
  const {original, local} = await noteApp.conflict()
  await startCopy(page)
  await copyBody(page).fill('Private edited copy')
  await expect
    .poll(
      async () =>
        (await drafts(page)).find((row) => row.editedCopyOf)?.draft.content,
    )
    .toBe('<p>Private edited copy</p>')
  const selectedURL = page.url()
  await noteApp.signIn('secondary')
  await page.goto('/en/collection/browser-work')
  await expect(
    page.getByText('Private edited copy', {exact: true}),
  ).toHaveCount(0)
  await expect(page.getByText(local, {exact: true})).toHaveCount(0)
  await noteApp.signIn('primary')
  await page.goto(selectedURL)
  await expect(copyBody(page)).toHaveText('Private edited copy')
  expect(
    (await drafts(page)).filter((row) => row.noteId === original.id),
  ).toHaveLength(2)
})

test('Keep both from the preserved source keeps both browser versions on the original note', async ({
  page,
  noteApp,
}) => {
  const {original, remote, local} = await noteApp.conflict()
  await startCopy(page)
  const sourceVersionId = (await drafts(page)).find(
    (row) => row.retainedSource,
  )!.versionId
  await review(page)
    .getByRole('button', {name: 'Close comparison', exact: true})
    .click()
  await page
    .getByRole('button', {name: 'Review other versions', exact: true})
    .click()
  await page.getByRole('button', {name: /^Choose browser version:/}).click()
  await page
    .locator(':popover-open')
    .getByRole('button')
    .filter({hasNot: page.getByText('Working copy', {exact: true})})
    .click()
  await page
    .getByRole('button', {name: 'Continue this version', exact: true})
    .click()
  await page.getByRole('button', {name: 'Review changes', exact: true}).click()
  await review(page)
    .getByRole('button', {name: 'Keep both', exact: true})
    .click()
  await expect.poll(async () => (await noteApp.all()).length).toBe(2)
  await expect
    .poll(async () => {
      const source = (await drafts(page)).find(
        (row) => row.versionId === sourceVersionId,
      )
      return {noteId: source?.noteId, content: source?.draft.content}
    })
    .toEqual({noteId: original.id, content: `<p>${local}</p>`})
  expect((await noteApp.read(original.id)).revision).toBe(remote.revision)
  expect(
    (await drafts(page)).some(
      (row) =>
        row.noteId === original.id && row.editedCopyOf === sourceVersionId,
    ),
  ).toBe(true)
})

test.describe('service-worker navigation', () => {
  test.use({serviceWorkers: 'allow'})
  test('working-copy history handoffs send cloneable URLs to the active worker', async ({
    page,
    noteApp,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await noteApp.conflict()
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()
    await startCopy(page)
    await review(page)
      .getByRole('button', {name: 'Close comparison', exact: true})
      .click()
    await page
      .getByRole('button', {name: 'Review other versions', exact: true})
      .click()
    await page
      .getByRole('button', {name: 'Continue this version', exact: true})
      .click()
    await expect(copyBody(page)).toBeVisible()
    expect(
      errors.filter((message) =>
        /DataCloneError|could not be cloned|postMessage/.test(message),
      ),
    ).toEqual([])
  })
})

test('discarding source then working copy returns to a live saved-note editor', async ({
  page,
  noteApp,
}) => {
  const {original} = await noteApp.conflict()
  await startCopy(page)
  await review(page)
    .getByRole('button', {name: 'Close comparison', exact: true})
    .click()
  await page
    .getByRole('button', {name: 'Review other versions', exact: true})
    .click()
  await page.getByRole('button', {name: /^Choose browser version:/}).click()
  await page
    .locator(':popover-open')
    .getByRole('button')
    .filter({hasNot: page.getByText('Working copy', {exact: true})})
    .click()
  await page
    .getByRole('dialog', {name: 'Choose a version to continue', exact: true})
    .getByRole('button', {name: 'Manage local versions', exact: true})
    .click()
  await page.getByRole('button', {name: 'Discard', exact: true}).click()
  await page
    .getByRole('dialog', {name: 'Discard this browser copy?', exact: true})
    .getByRole('button', {name: 'Discard', exact: true})
    .click()
  await expect
    .poll(async () => (await drafts(page)).some((row) => row.retainedSource))
    .toBe(false)
  await page.getByRole('button', {name: 'Review changes', exact: true}).click()
  await expect(copyBody(page)).toBeVisible()
  await review(page)
    .getByRole('button', {name: 'Manage local versions', exact: true})
    .click()
  await page.getByRole('button', {name: 'Discard', exact: true}).click()
  await page
    .getByRole('dialog', {name: 'Discard this browser copy?', exact: true})
    .getByRole('button', {name: 'Discard', exact: true})
    .click()
  await expect(review(page)).not.toBeVisible()
  await expect(body(page)).toHaveText('Saved elsewhere')
  await body(page).fill('Editing still saves after both discards')
  await page
    .getByRole('button', {name: 'Save and go back', exact: true})
    .click()
  await expect
    .poll(async () => (await noteApp.read(original.id)).content)
    .toBe('<p>Editing still saves after both discards</p>')
})

for (const width of [1440, 390]) {
  test(`long working copy scrolls within comparison at ${width}px`, async ({
    page,
    noteApp,
  }) => {
    await page.setViewportSize({width, height: width === 390 ? 844 : 1000})
    const {remote} = await noteApp.conflict()
    await noteApp.save(remote, {
      content: Array.from(
        {length: 100},
        (_, i) =>
          `<p>Saved paragraph ${i + 1}: a long reference must scroll independently.</p>`,
      ).join(''),
    })
    await startCopy(page)
    await copyBody(page).fill(
      Array.from(
        {length: 120},
        (_, i) =>
          `Paragraph ${i + 1}: long browser work needs to remain reachable while comparing versions.`,
      ).join('\n'),
    )
    const pane = review(page).getByRole('region', {
      name: 'Your version',
      exact: true,
    })
    await pane.evaluate((el) => {
      el.scrollTop = 0
    })
    const box = await pane.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + 40, box!.y + 60)
    await page.mouse.wheel(0, 900)
    await expect
      .poll(() => pane.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0)
    await pane.evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await expect
      .poll(() =>
        copyBody(page).evaluate((el) => {
          const range = document.createRange()
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
          let last: Node | null = null
          while (walker.nextNode()) last = walker.currentNode
          if (!last) return false
          range.selectNodeContents(last)
          range.collapse(false)
          const rect = range.getBoundingClientRect()
          const region = el.closest('[role="region"]')!.getBoundingClientRect()
          return rect.bottom <= region.bottom + 1 && rect.bottom >= region.top
        }),
      )
      .toBe(true)
    const mineScroll = await pane.evaluate((el) => el.scrollTop)
    if (width === 390)
      await review(page)
        .getByRole('tab', {name: 'Saved version', exact: true})
        .click()
    const saved = review(page).getByRole('region', {
      name: 'Saved version',
      exact: true,
    })
    expect(await saved.evaluate((el) => el.scrollTop)).toBe(0)
    const savedBox = await saved.boundingBox()
    await page.mouse.move(savedBox!.x + 40, savedBox!.y + 60)
    await page.mouse.wheel(0, 900)
    await expect
      .poll(() => saved.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0)
    if (width === 390)
      await review(page)
        .getByRole('tab', {name: 'Working copy', exact: true})
        .click()
    expect(await pane.evaluate((el) => el.scrollTop)).toBe(mineScroll)
    for (const name of ['Use this version', 'Close comparison']) {
      expect(
        await review(page)
          .getByRole('button', {name, exact: true})
          .evaluate((el) => {
            const rect = el.getBoundingClientRect()
            return rect.top >= 0 && rect.bottom <= innerHeight
          }),
      ).toBe(true)
    }
  })
}
