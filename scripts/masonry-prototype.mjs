// Compare page spacers with continuous native masonry without app data.
// Install Playwright engines first; optionally set PLAYWRIGHT_BROWSERS_PATH.
import assert from 'node:assert/strict'
import {chromium, firefox, webkit} from '@playwright/test'

for (const [name, type] of Object.entries({chromium, firefox, webkit})) {
  const browser = await type.launch({headless: true})
  try {
    const page = await browser.newPage({viewport: {width: 1200, height: 900}})
    await page.setContent(`<style>
      .grid {display:grid-lanes;grid-template-columns:repeat(3,1fr);gap:16px}
      .card > div {height:100px} .card:nth-child(24n) > div {height:700px}
      </style><div id="continuous" class="grid"></div><div id="pages"></div>`)
    const result = await page.evaluate(() => {
      const supported = CSS.supports('display', 'grid-lanes')
      if (!supported) return {supported}
      const continuous = document.getElementById('continuous')
      const pages = document.getElementById('pages')
      const html = Array.from(
        {length: 240},
        (_, index) => `<div class="card" data-i="${index}"><div></div></div>`,
      )
      continuous.innerHTML = html.join('')
      pages.innerHTML = Array.from(
        {length: 10},
        (_, index) =>
          `<div class="grid">${html.slice(index * 24, (index + 1) * 24).join('')}</div>`,
      ).join('')
      const total = (element) => element.getBoundingClientRect().height
      const next = (element) =>
        element.querySelector('[data-i="24"]').getBoundingClientRect().top -
        element.getBoundingClientRect().top
      const continuousHeight = total(continuous)
      const pageHeight = total(pages)
      const continuousNext = next(continuous)
      const pageNext = next(pages)
      const cards = [...continuous.children]
      const before = cards.map((element) => element.getBoundingClientRect().top)
      cards.forEach((element) => {
        element.style.height = `${element.getBoundingClientRect().height}px`
        element.replaceChildren()
      })
      return {
        supported,
        continuousHeight,
        pageHeight,
        excess: pageHeight - continuousHeight,
        continuousNext,
        pageNext,
        shellDrift: Math.max(
          ...cards.map((element, index) =>
            Math.abs(element.getBoundingClientRect().top - before[index]),
          ),
        ),
      }
    })
    console.log(name, browser.version(), result)
    if (result.supported) {
      assert.ok(
        result.excess > 0,
        'Page boundaries should expose the tall-card gap',
      )
      assert.equal(
        result.shellDrift,
        0,
        'Measured shells must preserve native placement',
      )
    }
  } finally {
    await browser.close()
  }
}
