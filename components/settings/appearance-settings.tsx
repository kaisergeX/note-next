'use client'

import {IconCheck} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {useSyncExternalStore} from 'react'
import {usePersistStore} from '~/store'
import {APPEARANCE_IDS, type AppearanceMode} from '~/lib/appearance'
import AppearancePreview from './appearance-preview'

const modes: AppearanceMode[] = ['system', 'light', 'dark']

function subscribeToColorScheme(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function getSystemMode() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getServerMode() {
  return null
}

export default function AppearanceSettings() {
  const t = useTranslations('user.appearance')
  const appearance = usePersistStore((state) => state.appearance)
  const setAppearance = usePersistStore((state) => state.setAppearance)
  const mode = usePersistStore((state) => state.mode)
  const setMode = usePersistStore((state) => state.setMode)
  const syncStatus = usePersistStore((state) => state.appearanceSyncStatus)
  const systemMode = useSyncExternalStore(
    subscribeToColorScheme,
    getSystemMode,
    getServerMode,
  )

  return (
    <section
      id="appearance"
      aria-labelledby="appearance-title"
      className="scroll-mt-20"
    >
      <div className="max-w-2xl">
        <h2 id="appearance-title">{t('title')}</h2>
        <p className="text-ink-muted mt-1 text-sm">{t('description')}</p>
        <p role="status" className="text-ink-muted mt-2 text-xs">
          {t(`sync.${syncStatus}`)}
        </p>
      </div>
      <div className="mt-5 flex max-w-4xl flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 xl:w-56 xl:shrink-0">
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">
              {t('presets')}
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {APPEARANCE_IDS.map((id) => (
                <label key={id} className="min-w-0 cursor-pointer">
                  <input
                    className="peer sr-only"
                    type="radio"
                    name="appearance"
                    value={id}
                    aria-label={t(`names.${id}`)}
                    aria-describedby={`appearance-${id}-description`}
                    checked={appearance === id}
                    onChange={() => setAppearance(id)}
                  />
                  <span className="border-control-border bg-paper-raised peer-checked:border-accent peer-checked:bg-ink-tint peer-focus-visible:outline-accent flex h-full items-start gap-3 rounded-lg border p-4 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                    <span
                      aria-hidden="true"
                      className={
                        appearance === id
                          ? 'border-accent text-accent mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border'
                          : 'border-control-border mt-0.5 size-5 shrink-0 rounded-full border'
                      }
                    >
                      {appearance === id ? <IconCheck size={14} /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {t(`names.${id}`)}
                      </span>
                      <span
                        id={`appearance-${id}-description`}
                        className="text-ink-muted mt-1 block text-sm leading-relaxed"
                      >
                        {t(`descriptions.${id}`)}
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-6">
            <legend className="mb-3 text-sm font-semibold">
              {t('colorMode')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {modes.map((value) => (
                <label key={value} className="cursor-pointer">
                  <input
                    className="peer sr-only"
                    type="radio"
                    name="color-mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                  />
                  <span className="border-control-border bg-paper-raised peer-checked:border-accent peer-checked:bg-ink-tint peer-checked:text-ink peer-focus-visible:outline-accent inline-flex min-h-10 items-center rounded-md border px-3 text-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                    {t(`modes.${value}`)}
                  </span>
                </label>
              ))}
            </div>
            {mode === 'system' && systemMode ? (
              <p className="text-ink-muted mt-2 text-sm">
                {t('systemStatus', {mode: t(`modes.${systemMode}`)})}
              </p>
            ) : null}
          </fieldset>
        </div>
        <AppearancePreview appearance={appearance} />
      </div>
    </section>
  )
}
