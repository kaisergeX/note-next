'use client'

import {IconInfoCircle, IconPencil, IconSelector} from '@tabler/icons-react'
import {cn} from 'cn'
import {useSearchParams} from 'next/navigation'
import {useEffect, useRef} from 'react'
import {buttonClass} from '~/components/ui/button'
import PopoverBase from '~/components/ui/popover'
import Flow, {type Stage} from './flow'

const screens: Record<Stage, {label: string; title: string; hint: string}> = {
  setup: {
    label: 'Set up',
    title: 'Encrypted notes',
    hint: 'Choose how you’ll unlock this collection.',
  },
  backup: {
    label: 'Save recovery kit',
    title: 'Save your recovery kit',
    hint: 'Keep a copy somewhere safe before you leave this tab.',
  },
  verify: {
    label: 'Verify',
    title: 'Check your saved keys',
    hint: 'Confirm you can open your notes both ways.',
  },
  locked: {
    label: 'Locked',
    title: 'Unlock your notes',
    hint: 'Your titles and writing stay hidden until you unlock.',
  },
  open: {label: 'Collection', title: 'Encrypted notes', hint: ''},
}

function setScreen(screen: Stage) {
  const url = new URL(window.location.href)
  url.searchParams.delete('design')
  url.searchParams.set('screen', screen)
  window.history.replaceState(null, '', url)
}

function PrivacyDetails() {
  return (
    <div className="border-hairline mt-6 border-t pt-1">
      <PopoverBase
        anchor="bottom-start"
        trigger={
          <>
            <IconInfoCircle size={16} aria-hidden /> What stays private?
          </>
        }
        triggerClassName={cn(
          buttonClass({variant: 'ghost'}),
          'text-ink-muted px-1',
        )}
        className="border-hairline bg-paper-raised text-ink shadow-sheet max-w-72 rounded-lg border p-4 text-sm leading-relaxed"
      >
        Your device encrypts titles and text. The service can see a note’s ID,
        size, dates, color, and Trash status.
      </PopoverBase>
    </div>
  )
}

export default function Preview() {
  const query = useSearchParams()
  const requestedStage = query.get('screen')
  const stage =
    requestedStage && Object.hasOwn(screens, requestedStage)
      ? (requestedStage as Stage)
      : 'open'
  const listVisible = stage === 'open' || stage === 'locked'
  const screen = screens[stage]
  const heading = useRef<HTMLHeadingElement>(null)
  const surface = listVisible ? 'list' : stage
  const previousSurface = useRef(surface)
  useEffect(() => {
    if (previousSurface.current !== surface)
      heading.current?.focus({preventScroll: true})
    previousSurface.current = surface
  }, [surface])

  return (
    <main
      lang="en"
      className="body-h-auto text-ink bg-paper min-h-full px-4 pb-14 lg:px-6"
    >
      <div>
        <div
          aria-label="Design preview controls"
          role="group"
          className="border-hairline mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 border-b py-3"
        >
          <span className="text-ink-muted mr-auto inline-flex items-center gap-2 text-sm">
            <IconPencil size={16} aria-hidden /> Collections preview
          </span>
          <label className="text-ink-muted inline-flex min-h-10 items-center gap-2 text-sm lg:order-last lg:ml-auto">
            Screen
            <span className="relative">
              <select
                value={stage}
                onChange={(event) => setScreen(event.target.value as Stage)}
                className="text-ink focus-visible:outline-accent min-h-10 cursor-pointer appearance-none rounded-md py-2 pr-6 pl-1 font-semibold focus-visible:outline-2"
              >
                {Object.entries(screens).map(([id, {label}]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <IconSelector
                size={14}
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2"
              />
            </span>
          </label>
        </div>

        <section
          className={cn(
            'mx-auto',
            listVisible
              ? 'mt-4 max-w-7xl'
              : 'mt-6 grid max-w-lg gap-y-5 md:mt-16 md:max-w-5xl md:grid-cols-2 md:gap-x-12 lg:gap-x-16',
          )}
        >
          <div
            className={cn(
              'min-w-0',
              !listVisible && 'md:col-start-2 md:row-start-1 md:self-end',
            )}
          >
            <h1
              ref={heading}
              tabIndex={-1}
              className={cn(
                'font-serif text-4xl font-normal tracking-tight outline-none sm:text-5xl',
                listVisible && 'sr-only',
              )}
            >
              {listVisible ? 'Notes preview' : screen.title}
            </h1>
            {!listVisible && screen.hint && (
              <p className="text-ink-muted mt-2 text-base leading-relaxed">
                {screen.hint}
              </p>
            )}
          </div>
          <Flow
            stage={stage}
            onStage={setScreen}
            setupDetails={<PrivacyDetails />}
          />
        </section>
        <p className="text-ink-muted mx-auto mt-6 text-center text-xs">
          Sample data only.
        </p>
      </div>
    </main>
  )
}
