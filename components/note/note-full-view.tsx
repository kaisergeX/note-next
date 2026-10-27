'use client'

import {
  IconArrowLeft,
  IconWindowMaximize,
  IconWindowMinimize,
} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {cn} from 'cn'
import {useRef, useState} from 'react'
import Button from '~/components/ui/button'
import NoteCustomize from '~/components/note/note-customize'
import NoteWriting from '~/components/note/note-writing'
import type {NoteStoreState} from '~/types/note'
import {useFullscreen} from '~/util/hooks'
import {usePersistStore} from '~/store'

export default function NoteFullView({
  identity,
  editorId,
  pending,
  error,
  creating = false,
  onClose,
  onTrash,
}: {
  identity: string
  editorId: string
  pending?: boolean
  error?: NonNullable<NoteStoreState['noteSession']>['error']
  creating?: boolean
  onClose: () => void
  onTrash: () => void
}) {
  const navigationRef = useRef<HTMLElement>(null)
  const [navigationHandedOff, setNavigationHandedOff] = useState(false)
  const [mobileCount, setMobileCount] = useState<'words' | 'characters'>(
    'words',
  )
  const t = useTranslations('note')
  const contentCount = usePersistStore(
    (state) => state.editorCharCount[`${editorId}-content`],
  )
  const {
    isFullscreen,
    toggleFullscreen,
    error: fullscreenError,
  } = useFullscreen()
  const backAction = (
    <Button
      variant="ghost"
      iconOnly
      disabled={pending}
      aria-label={t('editor.close')}
      onClick={onClose}
    >
      <IconArrowLeft />
    </Button>
  )
  const fullscreenAction = (
    <Button
      variant="ghost"
      className="max-sm:hidden"
      iconOnly
      disabled={fullscreenError}
      aria-label={t('editor.fullscreen')}
      onClick={() => void toggleFullscreen()}
    >
      {isFullscreen ? <IconWindowMinimize /> : <IconWindowMaximize />}
    </Button>
  )
  return (
    <main className="relative flex flex-1 flex-col">
      <section
        ref={navigationRef}
        className={cn(
          'bg-paper/50 sticky top-0 z-40 flex items-center justify-between gap-4 px-4 py-3 backdrop-blur-sm transition-all duration-200 ease-out motion-reduce:transition-none',
          navigationHandedOff
            ? 'pointer-events-none -translate-y-full opacity-0'
            : 'translate-y-0 opacity-100',
        )}
        inert={navigationHandedOff}
        aria-hidden={navigationHandedOff}
      >
        {backAction}
        {fullscreenAction}
      </section>
      <NoteWriting
        key={identity}
        id={editorId}
        pending={pending}
        fullPage
        navigationRef={navigationRef}
        onNavigationHandoffChange={setNavigationHandedOff}
        leadingActions={backAction}
        viewAction={fullscreenAction}
      />
      {error && (
        <p role="alert" className="text-destructive px-4">
          {t(error === 'trash' ? 'trash.moveFailed' : 'status.saveFailed')}
        </p>
      )}
      <NoteCustomize
        type={creating ? 'create' : 'update'}
        details={
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-ink-muted h-10 px-1 font-normal tabular-nums sm:hidden"
              aria-label={t('count.switch', {
                current: t(`count.${mobileCount}`, {
                  count: contentCount?.[mobileCount] ?? 0,
                }),
                next: t(
                  mobileCount === 'words'
                    ? 'count.showCharacters'
                    : 'count.showWords',
                ),
              })}
              onClick={() =>
                setMobileCount((value) =>
                  value === 'words' ? 'characters' : 'words',
                )
              }
            >
              {t(`count.${mobileCount}`, {
                count: contentCount?.[mobileCount] ?? 0,
              })}
            </Button>
            <span className="group text-ink-muted hidden cursor-default text-xs tabular-nums sm:inline">
              <span className="opacity-0 transition-opacity group-hover:opacity-100 max-sm:hidden">
                {t('count.characters', {count: contentCount?.characters ?? 0})}
                ,{' '}
              </span>
              {t('count.words', {count: contentCount?.words ?? 0})}
            </span>
          </>
        }
        error={!!error}
        loading={pending}
        onMoveToTrash={onTrash}
      />
    </main>
  )
}
