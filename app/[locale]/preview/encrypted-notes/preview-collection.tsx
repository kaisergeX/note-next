import {
  IconChevronDown,
  IconDeviceLaptop,
  IconLock,
  IconLockOpen,
  IconNotebook,
  IconPlus,
} from '@tabler/icons-react'
import {useRef, useState, type Dispatch, type SetStateAction} from 'react'
import NoteCard, {NoteCardSummary} from '~/components/note/note-card'
import NoteMasonry from '~/components/note/note-masonry'
import NoteSearchControls from '~/components/note/note-search-controls'
import Button, {buttonClass} from '~/components/ui/button'
import MenuCustom from '~/components/ui/menu'
import type {NoteTheme} from '~/db/schema/notes'
import {foldSearchText, searchableNoteText} from '~/lib/notes/search'
import {noteText} from '~/lib/notes/text'
import PreviewEditor, {PreviewUnlock} from './preview-editor'

type Kind = 'ordinary' | 'encrypted'

export type PreviewNote = {
  id: number
  kind: Kind
  location: 'account' | 'browser'
  title: string
  content: string
  theme?: NoteTheme
  edited?: boolean
}

export const sampleNotes: PreviewNote[] = [
  {
    id: 0,
    kind: 'ordinary',
    location: 'account',
    theme: 'yellow',
    title: '<p>Saturday market</p>',
    content:
      '<p>Pick up pears and fresh bread. Ask the flower stall when the dahlias are back.</p>',
  },
  {
    id: 1,
    kind: 'encrypted',
    location: 'account',
    title: '<p>A quiet Sunday</p>',
    content:
      '<p>Coffee by the window. The first snow started before the kettle boiled.</p>',
  },
  {
    id: 2,
    kind: 'ordinary',
    location: 'account',
    theme: 'cyan',
    title: '<p>Places to read</p>',
    content:
      '<p>The library window seat, the old greenhouse and that bench along the river.</p><p>Bring a spare pencil next time.</p>',
  },
  {
    id: 3,
    kind: 'encrypted',
    location: 'browser',
    title: '<p>A letter in progress</p>',
    content: '<p>Start with the small things I remember about that summer.</p>',
  },
]

const collections = [
  {id: 'ordinary', label: 'Notes', icon: IconNotebook},
  {id: 'encrypted', label: 'Encrypted', icon: IconLock},
] as const

const ignoreLayout = () => {}

export default function PreviewCollection({
  notes,
  setNotes,
  locked,
  onLock,
  onUnlock,
}: {
  notes: PreviewNote[]
  setNotes: Dispatch<SetStateAction<PreviewNote[]>>
  locked: boolean
  onLock: () => void
  onUnlock: () => void
}) {
  const [selection, setSelection] = useState<PreviewNote | null>(null)
  const [collection, setCollection] = useState<Kind>('encrypted')
  const [query, setQuery] = useState('')
  const [wasLocked, setWasLocked] = useState(locked)
  const opener = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const encryptedCollection = collection === 'encrypted'
  const CurrentIcon = encryptedCollection ? IconLock : IconNotebook
  const VaultIcon = locked ? IconLock : IconLockOpen
  const title = encryptedCollection ? 'Encrypted notes' : 'Notes'
  const term = encryptedCollection ? '' : foldSearchText(query.trim())
  const visible = new Map(
    notes
      .filter(
        (note) =>
          note.kind === collection &&
          (!term ||
            foldSearchText(
              searchableNoteText(note.title) +
                ' ' +
                searchableNoteText(note.content),
            ).includes(term)),
      )
      .map((note) => [String(note.id), note]),
  )

  if (wasLocked !== locked) {
    setWasLocked(locked)
    if (locked && selection?.kind === 'encrypted') setSelection(null)
  }

  function select(note: PreviewNote, trigger: HTMLButtonElement | null) {
    opener.current = trigger
    setSelection(note)
  }

  function closeSelection() {
    setSelection(null)
    opener.current?.focus()
  }

  function create(trigger: HTMLButtonElement) {
    select(
      {
        id: notes.length,
        kind: collection,
        title: '',
        content: '',
        location: 'browser',
      },
      trigger,
    )
  }

  function save(note: PreviewNote) {
    setNotes((current) =>
      current.some(({id}) => id === note.id)
        ? current.map((item) => (item.id === note.id ? note : item))
        : [note, ...current],
    )
  }

  function navigate(next: Kind) {
    setQuery('')
    setCollection(next)
  }

  return (
    <div className="min-w-0 lg:flex">
      <nav
        aria-label="Note collections"
        className="border-hairline mr-5 hidden w-36 shrink-0 space-y-1 border-r pr-3 lg:block"
      >
        {collections.map(({id, label, icon: Icon}) => (
          <Button
            key={id}
            variant="ghost"
            aria-current={collection === id ? 'page' : undefined}
            className={
              collection === id
                ? 'bg-ink-tint w-full justify-start px-2'
                : 'text-ink-muted w-full justify-start px-2'
            }
            onClick={() => navigate(id)}
          >
            <Icon size={18} aria-hidden /> {label}
          </Button>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="lg:hidden">
            <MenuCustom
              anchor="bottom-start"
              ariaLabel={'Note collections: ' + title}
              className={
                buttonClass({variant: 'ghost', pressMotion: false}) +
                ' px-0 text-base'
              }
              itemsClassName="w-40 p-1"
              items={collections.map(({id, label, icon: Icon}) => ({
                type: 'action',
                label: (
                  <>
                    <Icon size={18} aria-hidden /> {label}
                  </>
                ),
                onSelect: () => navigate(id),
              }))}
            >
              <CurrentIcon size={18} aria-hidden /> {title}{' '}
              <IconChevronDown size={15} aria-hidden />
            </MenuCustom>
          </div>
          <h2 className="sr-only text-base font-semibold lg:not-sr-only">
            {title}
          </h2>
          {!encryptedCollection && (
            <div className="note-search-slot">
              <NoteSearchControls
                value={query}
                onChange={setQuery}
                onCompositionChange={ignoreLayout}
                pending={false}
                fetching={false}
              />
            </div>
          )}
          <Button
            className="ml-auto"
            onClick={(event) => create(event.currentTarget)}
          >
            <IconPlus size={18} aria-hidden />
            {encryptedCollection ? 'New encrypted note' : 'New note'}
          </Button>
        </div>
        {encryptedCollection && (
          <div className="border-hairline mb-4 flex min-w-0 flex-wrap items-center justify-between gap-x-3 border-b pb-2">
            <div className="text-ink-muted flex items-center gap-2 text-sm">
              <VaultIcon size={16} aria-hidden />
              <p role="status">
                {locked
                  ? 'Encrypted notes are locked'
                  : 'Encrypted notes are unlocked'}
              </p>
            </div>
            <Button variant="ghost" onClick={locked ? onUnlock : onLock}>
              {locked ? 'Try sample unlock' : 'Lock encrypted notes'}
            </Button>
          </div>
        )}
        {visible.size > 0 ? (
          <NoteMasonry
            ids={[...visible.keys()]}
            listRef={list}
            onLayout={ignoreLayout}
            renderCard={(id) => {
              const note = visible.get(id)!
              const encrypted = note.kind === 'encrypted'
              const hidden = encrypted && locked
              const label = hidden
                ? 'Locked encrypted note'
                : noteText(note.title) || 'Untitled note'
              return (
                <NoteCard theme={note.theme} className="relative min-h-24 p-4">
                  {encrypted ? (
                    <p className="flex items-start gap-2 font-serif text-lg font-semibold wrap-anywhere">
                      <IconLock
                        size={17}
                        className="text-ink-muted mt-1 shrink-0"
                        aria-hidden
                      />
                      {label}
                    </p>
                  ) : (
                    <NoteCardSummary
                      title={note.title || 'Untitled note'}
                      content={note.content}
                      theme={note.theme}
                    />
                  )}
                  {note.location === 'browser' && (
                    <p className="text-ink-muted mt-3 flex items-center gap-1.5 text-xs">
                      <IconDeviceLaptop size={14} aria-hidden /> Saved on this
                      browser
                    </p>
                  )}
                  <Button
                    variant="ghost"
                    data-note-id={id}
                    className="absolute inset-0 h-full w-full hover:bg-transparent"
                    aria-label={
                      hidden
                        ? 'Try sample unlock and open encrypted note'
                        : encrypted
                          ? 'Open encrypted note, ' + label
                          : 'Open ' + label
                    }
                    onClick={(event) => select(note, event.currentTarget)}
                  />
                </NoteCard>
              )
            }}
          />
        ) : (
          <p role="status" className="text-ink-muted py-5 text-sm">
            No matching notes.
          </p>
        )}
      </div>
      {selection &&
        (locked && selection.kind === 'encrypted' ? (
          <PreviewUnlock onConfirm={onUnlock} onCancel={closeSelection} />
        ) : (
          <PreviewEditor
            key={selection.id}
            note={selection}
            onChange={save}
            onClose={closeSelection}
          />
        ))}
    </div>
  )
}
