'use client'

import {
  IconBold,
  IconCheck,
  IconFileText,
  IconHighlight,
  IconItalic,
  IconUser,
} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {useSyncExternalStore} from 'react'
import Button from '~/components/ui/button'
import {Input} from '~/components/ui/input'
import {usePersistStore} from '~/store'
import type {AppearanceId, AppearanceMode} from '~/lib/appearance'

const appearances: AppearanceId[] = ['paper-ink', 'sepia']
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
      </div>

      <div className="mt-5 flex max-w-4xl flex-col gap-6 xl:flex-row xl:items-start">
        <fieldset className="min-w-0 xl:w-56 xl:shrink-0">
          <legend className="mb-3 text-sm font-semibold">{t('presets')}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {appearances.map((id) => (
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

        <div className="min-w-0 flex-1">
          <p
            id="appearance-preview-title"
            className="mb-3 text-sm font-semibold"
          >
            {t('previewTitle')}
          </p>
          <div
            role="group"
            aria-labelledby="appearance-preview-title"
            aria-describedby="appearance-preview-description"
            data-appearance-preview={appearance}
            className="appearance-preview border-hairline bg-paper text-ink overflow-hidden rounded-xl border font-sans"
          >
            <div>
              <div className="border-hairline flex h-12 items-center justify-between border-b px-5">
                <span className="text-accent font-serif text-lg font-semibold">
                  etoN
                </span>
                <span className="bg-ink-tint text-ink-muted flex size-7 items-center justify-center rounded-full">
                  <IconUser size={15} aria-hidden />
                </span>
              </div>
              <div className="space-y-6 p-4 sm:p-6">
                <div className="border-hairline bg-paper-raised relative rounded-lg border">
                  <div
                    role="group"
                    aria-label={t('previewFormatting')}
                    className="bg-paper-raised border-hairline text-ink-muted shadow-sheet absolute -top-3 right-3 flex items-center gap-1 rounded-lg border p-1"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('previewBold')}
                      className="size-10 rounded-sm p-0"
                    >
                      <IconBold size={15} aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('previewItalic')}
                      className="size-10 rounded-sm p-0"
                    >
                      <IconItalic size={15} aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('previewHighlight')}
                      className="bg-accent/10 text-accent size-10 rounded-sm p-0"
                    >
                      <IconHighlight size={15} aria-hidden />
                    </Button>
                  </div>
                  <div className="border-hairline flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                    <span className="text-ink-muted inline-flex items-center gap-2 text-xs font-medium">
                      <IconFileText size={15} aria-hidden />
                      {t('previewNote')}
                    </span>
                  </div>
                  <div className="px-5 pt-5 pb-3 sm:px-6">
                    <p className="font-serif text-2xl leading-tight font-medium">
                      {t('previewHeading')}
                    </p>
                    <p className="mt-3 font-serif text-lg leading-relaxed">
                      {t('previewBody')}
                    </p>
                    <Button variant="link" className="mt-2">
                      {t('previewLink')}
                    </Button>
                  </div>
                  <div className="border-hairline text-ink-muted flex items-center gap-1.5 border-t px-4 py-2 text-xs">
                    <IconCheck size={14} className="text-success" aria-hidden />
                    {t('previewSaved')}
                  </div>
                </div>
                <div>
                  <p className="text-ink-muted mb-3 text-xs font-medium">
                    {t('previewChat')}
                  </p>
                  <div className="flex flex-col items-start gap-3 text-sm leading-relaxed">
                    <p className="bg-ink text-paper max-w-4/5 self-end rounded-xl rounded-br-sm px-4 py-3">
                      {t('previewPrompt')}
                    </p>
                    <p className="border-hairline bg-paper-raised max-w-4/5 rounded-xl rounded-bl-sm border px-4 py-3">
                      {t('previewReply')}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Input
                      aria-label={t('previewMessage')}
                      placeholder={t('previewMessage')}
                      className="h-10 min-w-0 flex-1"
                    />
                    <Button>{t('previewSend')}</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p id="appearance-preview-description" className="sr-only">
            {t('previewDescription', {preset: t(`names.${appearance}`)})}
          </p>
        </div>
      </div>

      <fieldset className="mt-7 max-w-4xl">
        <legend className="mb-3 text-sm font-semibold">{t('colorMode')}</legend>
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
              <span className="border-control-border bg-paper-raised peer-checked:border-accent peer-checked:bg-ink-tint peer-checked:text-ink peer-focus-visible:outline-accent inline-flex min-h-10 items-center rounded-md border px-4 text-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
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
    </section>
  )
}
