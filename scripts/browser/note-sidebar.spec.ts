import {test, expect} from './fixtures'

// Allow normal Serwist registration when observing page errors.
test.use({deviceScaleFactor: 2, serviceWorkers: 'allow'})

test('the note grid stays within the viewport without overlapping as the sidebar toggles', async ({
  page,
  noteApp,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.emulateMedia({reducedMotion: 'no-preference'})
  await noteApp.createMany(24)
  await page.goto('/en/eton')
  const list = page.locator('ul[data-masonry]')
  await expect(list.locator('li')).toHaveCount(24)
  await page.evaluate(() => document.fonts.ready.then(() => {}))
  const toggle = page.getByRole('button', {
    name: /^(expand|collapse) sidebar$/i,
  })

  for (const width of [1024, 1440, 1512, 1728, 1800, 1920, 2048]) {
    await page.setViewportSize({width, height: 1000})
    for (const expanded of [true, false]) {
      const result = await toggle.evaluate(async (button) => {
        const list = document.querySelector('ul[data-masonry]')!
        const sidebar = button.closest('aside')!
        const initialWidth = list.getBoundingClientRect().width
        const widths = new Set([initialWidth])
        let overflow = 0
        let overlap = false
        let sidebarTransitioned = false
        const trackWidthTransition = (event: TransitionEvent) => {
          if (event.target === sidebar && event.propertyName === 'width')
            sidebarTransitioned = true
        }
        sidebar.addEventListener('transitionrun', trackWidthTransition)
        ;(button as HTMLButtonElement).click()
        const start = performance.now()
        do {
          // Sample after layout and ResizeObserver have run for this frame.
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => setTimeout(resolve, 0)),
          )
          const bounds = list.getBoundingClientRect()
          widths.add(bounds.width)
          const cards = [...list.children].map((card) =>
            card.getBoundingClientRect(),
          )
          overflow = Math.max(
            overflow,
            document.documentElement.scrollWidth - innerWidth,
            ...cards.map((card) => card.right - bounds.right),
          )
          overlap ||= cards.some((first, index) =>
            cards
              .slice(index + 1)
              .some(
                (second) =>
                  Math.min(first.right, second.right) >
                    Math.max(first.left, second.left) + 1 &&
                  Math.min(first.bottom, second.bottom) >
                    Math.max(first.top, second.top) + 1,
              ),
          )
        } while (performance.now() - start < 250)
        sidebar.removeEventListener('transitionrun', trackWidthTransition)
        return {
          overflow,
          overlap,
          sidebarTransitioned,
          widthCount: widths.size,
          widthChange: list.getBoundingClientRect().width - initialWidth,
        }
      })
      await expect(toggle).toHaveAttribute('aria-expanded', String(expanded))
      const state = `${width}px, sidebar ${expanded ? 'expanded' : 'collapsed'}`
      expect(result.overflow, state).toBeLessThanOrEqual(1)
      expect(result.overlap, state).toBe(false)
      expect(result.sidebarTransitioned, state).toBe(true)
      expect(result.widthCount, state).toBe(2)
      expect(
        expanded ? -result.widthChange : result.widthChange,
        state,
      ).toBeGreaterThan(0)
    }
  }
  expect(pageErrors).toEqual([])
})
