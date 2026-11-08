import {test, expect, body} from './fixtures'

for (const mobile of [false, true]) {
  test(`long masonry stays bounded and returns to the ${mobile ? 'mobile' : 'modal'} card`, async ({
    page,
    noteApp,
    browserName,
  }) => {
    const tab = 'Tab'
    const backTab = 'Shift+Tab'
    if (mobile) await page.setViewportSize({width: 390, height: 844})
    await noteApp.createMany(240)
    // Exercise the explicit loading path without racing automatic page loads.
    await page.addInitScript(() => {
      window.IntersectionObserver = class extends IntersectionObserver {
        observe(target: Element) {
          if (target.matches('li')) super.observe(target)
        }
      }
    })
    await page.goto('/en/eton')
    const list = page.locator('ul[data-masonry]')
    for (let loaded = 24; loaded < 240; loaded += 24) {
      await expect(list.locator('li').first()).toHaveAttribute(
        'aria-setsize',
        String(loaded),
      )
      await page
        .getByRole('button', {name: 'Load more notes', exact: true})
        .press('Enter')
    }
    await expect(list.locator('li').first()).toHaveAttribute(
      'aria-setsize',
      '240',
    )
    const mounted = list.locator('a[data-note-id]')
    await expect.poll(() => mounted.count()).toBeLessThan(120)
    await page.evaluate(() =>
      scrollTo({top: document.body.scrollHeight * 0.8, behavior: 'instant'}),
    )
    const visibleId = () =>
      mounted.evaluateAll((elements) =>
        elements
          .find((element) => {
            const rect = element.getBoundingClientRect()
            return rect.top >= 100 && rect.top < innerHeight - 100
          })
          ?.getAttribute('data-note-id'),
      )
    await expect.poll(visibleId).toBeTruthy()
    const id = await visibleId()
    const link = list.locator(`a[data-note-id="${id}"]`)
    await link.evaluate((element) => {
      element.addEventListener(
        'click',
        () => {
          sessionStorage.setItem(
            'masonry-open-top',
            String(element.getBoundingClientRect().top),
          )
        },
        {once: true},
      )
    })
    await list.locator(`a[data-note-id="${id}"]`).click()
    const top = Number(
      await page.evaluate(() => sessionStorage.getItem('masonry-open-top')),
    )
    await expect(body(page)).toBeVisible()
    await page
      .getByRole('button', {name: 'Save and go back', exact: true})
      .click()
    await expect(page).toHaveURL(/\/en\/eton$/)
    const returned = list.locator(`a[data-note-id="${id}"]`)
    await expect(returned).toBeInViewport()
    await expect
      .poll(async () =>
        Math.abs(
          (await returned.evaluate(
            (element) => element.getBoundingClientRect().top,
          )) - top,
        ),
      )
      .toBeLessThan(5)
    await expect(returned).toBeFocused()
    await page.keyboard.press(tab)
    await expect(
      returned
        .locator('..')
        .getByRole('button', {name: 'More note actions', exact: true}),
    ).toBeFocused()
    const nextIndex =
      Number(
        await returned.locator('xpath=ancestor::li').getAttribute('data-index'),
      ) + 1
    if (nextIndex < 240) {
      await page.keyboard.press(tab)
      await expect(
        browserName === 'webkit'
          ? list
              .locator(`li[data-index="${nextIndex}"]`)
              .getByRole('button', {name: 'More note actions', exact: true})
          : list.locator(`li[data-index="${nextIndex}"] a[data-note-id]`),
      ).toBeFocused()
      await page.keyboard.press(backTab)
      if (browserName !== 'webkit') await page.keyboard.press(backTab)
      else await returned.focus()
    }
    await page.setViewportSize({width: mobile ? 430 : 1024, height: 900})
    await expect(returned).toBeInViewport()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    )
    expect(overflow).toBe(false)
    await page.evaluate(() => scrollTo(0, 0))
    await expect.poll(() => mounted.count()).toBeLessThan(120)
    console.log(
      JSON.stringify({
        mobile,
        path: await list.getAttribute('data-masonry'),
        loaded: 240,
        mounted: await mounted.count(),
      }),
    )
  })
}

test('mounted card bodies stay bounded as cursor pages grow to 960 notes', async ({
  page,
  noteApp,
  browserName,
}) => {
  const tab = 'Tab'
  test.setTimeout(90000)
  await noteApp.createMany(960)
  await page.addInitScript(() => {
    window.IntersectionObserver = class extends IntersectionObserver {
      observe(target: Element) {
        if (target.matches('li')) super.observe(target)
      }
    }
  })
  await page.goto('/en/eton')
  const list = page.locator('ul[data-masonry]')
  const samples: {loaded: number; mounted: number}[] = []
  for (let loaded = 24; loaded <= 960; loaded += 24) {
    await expect(list.locator('li').first()).toHaveAttribute(
      'aria-setsize',
      String(loaded),
    )
    if ([240, 480, 960].includes(loaded)) {
      await page.evaluate(() => scrollTo({top: 0, behavior: 'instant'}))
      await expect(
        list.locator('li[data-index="0"] a[data-note-id]'),
      ).toBeInViewport()
      await expect
        .poll(() => list.locator('a[data-note-id]').count())
        .toBeLessThan(100)
      samples.push({
        loaded,
        mounted: await list.locator('a[data-note-id]').count(),
      })
    }
    if (loaded < 960)
      await page
        .getByRole('button', {name: 'Load more notes', exact: true})
        .press('Enter')
  }
  console.log(
    JSON.stringify({path: await list.getAttribute('data-masonry'), samples}),
  )
  await list.locator('li[data-index="0"] a[data-note-id]').focus()
  // Walk across the network page boundary with ordinary Tab. Focus pins the
  // next source card even when it is outside the viewport window.
  for (let index = 0; index < 26; index++) {
    await page.keyboard.press(tab)
    await expect(
      list
        .locator(`li[data-index="${index}"]`)
        .getByRole('button', {name: 'More note actions', exact: true}),
    ).toBeFocused()
    // The Windows WebKit test shell skips hyperlinks in sequential focus,
    // so verify its native button sequence rather than changing app tabindex.
    if (browserName !== 'webkit') {
      await page.keyboard.press(tab)
      await expect(
        list.locator(`li[data-index="${index + 1}"] a[data-note-id]`),
      ).toBeFocused()
    }
  }
})
