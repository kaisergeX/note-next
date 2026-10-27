'use client'

import {
  IconArrowLeft,
  IconWindowMaximize,
  IconWindowMinimize,
} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {cn} from 'cn'
import {useRef, useState} from 'react'
import {useRouter} from '~/i18n/navigation'
import Button from '~/components/ui/button'
import NoteCustomize from '~/components/note/note-customize'
import NoteWriting from '~/components/note/note-writing'
import {useNoteSession} from '~/components/note/use-note-session'
import type {Note} from '~/db/schema/notes'
import {useFullscreen, useWindowScroll} from '~/util/hooks'
import {usePersistStore} from '~/store'

export default function NoteDetail({noteData}: {noteData: Note}) {
  const router = useRouter()
  const [scroll] = useWindowScroll()
  const navigationRef = useRef<HTMLElement>(null)
  const [navigationHandedOff, setNavigationHandedOff] = useState(false)
  const t = useTranslations('note')
  const session = useNoteSession(noteData)
  const contentCount = usePersistStore(
    (state) => state.editorCharCount[`note-${noteData.id}-content`],
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
      disabled={session.pending}
      aria-label={t('editor.close')}
      onClick={() =>
        void session.saveAndLeave(() => {
          window.history.length > 1 ? router.back() : router.push('/eton')
        })
      }
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
  if (!session.ready) return null
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
        key={session.identity}
        id={`note-${noteData.id}`}
        pending={session.pending}
        fullPage
        navigationRef={navigationRef}
        onNavigationHandoffChange={setNavigationHandedOff}
        leadingActions={backAction}
        viewAction={fullscreenAction}
      />
      {session.error && (
        <p role="alert" className="text-destructive px-4">
          {t(
            session.error === 'trash'
              ? 'trash.moveFailed'
              : 'status.saveFailed',
          )}
        </p>
      )}
      <NoteCustomize
        className={scroll.y > 200 ? 'sm:pr-16' : undefined}
        type="update"
        details={
          <span className="group text-ink-muted cursor-default text-xs tabular-nums">
            <span className="opacity-0 transition-opacity group-hover:opacity-100 max-sm:hidden">
              {t('count.characters', {count: contentCount?.characters ?? 0})}
              ,{' '}
            </span>
            {t('count.words', {count: contentCount?.words ?? 0})}
          </span>
        }
        error={!!session.error}
        loading={session.pending}
        onMoveToTrash={() =>
          void session.trashAndLeave(() => router.replace('/eton'))
        }
      />
    </main>
  )
}
