import assert from 'node:assert/strict'
import {defineConfig} from '@playwright/test'

const origin = process.env.NOTES_TEST_ORIGIN
assert.ok(
  origin,
  'Set NOTES_TEST_ORIGIN to the running local app (see docs/note-editor/browser-tests.md).',
)
const url = new URL(origin)
assert.ok(
  url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
  'Browser regressions require a loopback HTTP server.',
)

export default defineConfig({
  testDir: './scripts/browser',
  testMatch: '**/*.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: {timeout: 15000},
  reporter: 'list',
  outputDir: '.playwright-mcp/note-regressions',
  use: {
    baseURL: url.origin,
    browserName: 'chromium',
    viewport: {width: 1440, height: 1000},
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
