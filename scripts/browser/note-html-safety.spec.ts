import {test, expect, drafts} from './fixtures'

test('saved title and body cannot execute HTML in note cards', async ({
  page,
  noteApp,
}) => {
  const original = await noteApp.create()
  const title = '<p>Safe title<img src="x" onerror="window.__noteXss=1"></p>'
  const content =
    '<p><strong>Nội dung</strong> <mark>highlight</mark></p>' +
    '<img src="x" onerror="window.__noteXss=1">' +
    '<svg onload="window.__noteXss=1"></svg>' +
    '<style>.note-html-probe{display:none}</style>'
  const saved = await noteApp.save(original, {title, content})
  await page.goto('/en/eton')
  const card = page.getByRole('link').filter({hasText: 'Safe title'})
  await expect(card).toBeVisible()
  await expect(card.locator('strong')).toHaveText('Nội dung')
  await expect(card.locator('mark')).toHaveText('highlight')
  await expect(card.locator('img, svg, style, script, iframe, a')).toHaveCount(
    0,
  )
  expect(await page.evaluate(() => '__noteXss' in window)).toBe(false)
  // Rendering must not rewrite authoritative HTML or cause a save.
  expect((await noteApp.read(saved.id)).title).toBe(title)
  expect((await noteApp.read(saved.id)).content).toBe(content)
})

test('browser recovery HTML is sanitized without modifying its source', async ({
  page,
  noteApp,
}) => {
  await page.goto('/en/eton')
  await expect(
    page.getByRole('button', {name: 'New note', exact: true}),
  ).toBeVisible()
  const content =
    '<p><em>Browser content</em><img src="x" onerror="window.__noteXss=1"></p>'
  await page.evaluate(
    async ({ownerId, content}) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('etoN-note-recovery')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction('drafts', 'readwrite')
          transaction.objectStore('drafts').put({
            id: crypto.randomUUID(),
            ownerId,
            noteId: null,
            creationId: crypto.randomUUID(),
            baseline: {},
            draft: {
              title:
                '<p>Browser unsafe<svg onload="window.__noteXss=1"></svg></p>',
              content,
              theme: null,
            },
            generation: 1,
            updatedAt: Date.now(),
          })
          transaction.oncomplete = () => {
            db.close()
            resolve()
          }
          transaction.onerror = () => {
            db.close()
            reject(transaction.error)
          }
        }
      })
      window.dispatchEvent(new Event('note-recovery-changed'))
    },
    {ownerId: noteApp.ownerId, content},
  )
  for (const path of ['/en/eton', '/en/collection/browser-work']) {
    await page.goto(path)
    const card = page.getByRole('link').filter({hasText: 'Browser unsafe'})
    await expect(card).toBeVisible()
    await expect(card.locator('em')).toHaveText('Browser content')
    await expect(card.locator('img, svg')).toHaveCount(0)
    expect(await page.evaluate(() => '__noteXss' in window)).toBe(false)
    expect((await drafts(page))[0].draft.content).toBe(content)
  }
})
