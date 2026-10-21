import assert from 'node:assert/strict'
import {runInNewContext} from 'node:vm'
import {
  APPEARANCE_STORAGE_KEY,
  createAppearanceBootstrapScript,
} from '../lib/appearance'
import {usePersistStore} from '../store'

// Run with `node --import tsx scripts/appearance-bootstrap.ts`.
// Exercise the actual inline script without hydration or application providers.
function bootstrap(raw: string | null, osDark = false, storageThrows = false) {
  const classes = new Set<string>()
  const root = {
    dataset: {appearance: ''},
    classList: {
      toggle: (name: string, enabled: boolean) => {
        if (enabled) classes.add(name)
        else classes.delete(name)
      },
    },
  }
  runInNewContext(createAppearanceBootstrapScript(), {
    document: {documentElement: root, querySelectorAll: () => []},
    localStorage: {
      getItem: (key: string) => {
        assert.equal(key, APPEARANCE_STORAGE_KEY)
        if (storageThrows) throw new Error('Storage unavailable')
        return raw
      },
    },
    window: {matchMedia: () => ({matches: osDark})},
  })
  return {appearance: root.dataset.appearance, dark: classes.has('dark')}
}

for (const appearance of ['paper-ink', 'sepia']) {
  for (const mode of ['light', 'dark', 'system']) {
    for (const osDark of [false, true]) {
      assert.deepEqual(
        bootstrap(
          JSON.stringify({state: {appearance, mode}, version: 1}),
          osDark,
        ),
        {appearance, dark: mode === 'dark' || (mode === 'system' && osDark)},
      )
    }
  }
}
for (const theme of ['light', 'dark']) {
  assert.deepEqual(bootstrap(JSON.stringify({state: {theme}, version: 0})), {
    appearance: 'paper-ink',
    dark: theme === 'dark',
  })
}
for (const raw of [
  null,
  '{invalid',
  '{}',
  '{"state":null}',
  '{"state":{"appearance":"unknown","mode":"unknown"}}',
]) {
  for (const osDark of [false, true]) {
    assert.deepEqual(bootstrap(raw, osDark), {
      appearance: 'paper-ink',
      dark: osDark,
    })
  }
}
assert.deepEqual(bootstrap(null, true, true), {
  appearance: 'paper-ink',
  dark: true,
})
assert.equal(APPEARANCE_STORAGE_KEY, 'etoN-app')
const options = usePersistStore.persist.getOptions()
assert.equal(options.name, APPEARANCE_STORAGE_KEY)
assert.deepEqual(options.migrate?.({theme: 'dark'}, 0), {
  appearance: 'paper-ink',
  mode: 'dark',
})
assert.deepEqual(options.migrate?.({theme: 'light'}, 0), {
  appearance: 'paper-ink',
  mode: 'light',
})
const merged = options.merge?.(
  {appearance: 'unknown', mode: 'unknown'},
  usePersistStore.getState(),
)
assert.equal(merged?.appearance, 'paper-ink')
assert.equal(merged?.mode, 'system')
console.log(
  'Appearance bootstrap: 25 preference cases plus store key, migration, and invalid-value checks passed.',
)
