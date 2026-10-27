import {
  IconArrowRight,
  IconBold,
  IconHighlight,
  IconItalic,
  IconMessageCircle,
  IconNotes,
  IconPalette,
  IconPencilPlus,
  IconSparkles,
  IconUsersGroup,
} from '@tabler/icons-react'
import {NextIntlClientProvider} from 'next-intl'
import {getMessages, getTranslations} from 'next-intl/server'
import {connection} from 'next/server'
import {auth} from '~/auth'
import NoteTiny from '~/components/note/note-tiny'
import LinkButton from '~/components/ui/link-button'
import type {Note} from '~/db/schema/notes'
import {isValidSession} from '~/server-utils'
import type {PropsWithLocale} from '~/types'

export const instant = false

type NotePreviewCopy = {
  title: string
  createNote: string
  createNoteHref: string
  themes: string
}

const NOTE_THEMES = [
  'slate',
  'zinc',
  'stone',
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'purple',
  'pink',
  'rose',
] as const

type InterviewPreviewCopy = {
  label: string
  status: string
  name: string
  role: string
  prompt: string
  reply: string
}

function NoteGalleryPreview({
  notes,
  copy,
}: {
  notes: Note[]
  copy: NotePreviewCopy
}) {
  return (
    <div className="bg-dotgrid border-hairline rounded-xl border p-3 sm:p-6">
      <div className="border-hairline bg-paper/90 mb-4 flex items-center justify-between rounded-lg border px-3 py-2.5 sm:px-4">
        <div
          aria-hidden="true"
          className="flex items-center gap-2 text-sm font-medium"
        >
          <IconNotes className="text-ink-muted" size={17} /> {copy.title}
        </div>
        <LinkButton
          href={copy.createNoteHref}
          variant="secondary"
          aria-label={copy.createNote}
          className="group btn-light-sweep w-auto gap-0 p-2 transition-all duration-300 sm:hover:gap-2"
        >
          <IconPencilPlus className="sm:group-hover:hidden" />
          <IconSparkles className="hidden sm:group-hover:block" />
          <span className="max-w-0 overflow-clip whitespace-nowrap opacity-0 transition-all duration-300 ease-in-out group-hover:max-w-36 group-hover:opacity-100 max-sm:hidden">
            {copy.createNote}
          </span>
        </LinkButton>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none grid gap-3 sm:grid-cols-12 sm:items-start sm:gap-4"
      >
        <div className="relative sm:col-span-7 sm:row-span-2">
          <NoteTiny data={notes[0]} />
          <div className="bg-paper-raised border-hairline text-ink-muted absolute -top-2 right-3 z-10 flex items-center gap-1 rounded-lg border p-1 shadow-md">
            <IconBold size={15} />
            <IconItalic size={15} />
            <span className="text-accent bg-accent/10 rounded px-1 text-xs font-medium">
              <IconHighlight className="inline" size={14} />
            </span>
          </div>
        </div>
        <div className="rotate-1 sm:col-span-5 sm:translate-y-3">
          <NoteTiny data={notes[1]} />
        </div>
        <div className="-rotate-1 sm:col-span-5 sm:-translate-y-1">
          <NoteTiny data={notes[2]} />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="text-ink-muted mt-5 flex flex-wrap items-center justify-between gap-3 px-1 text-xs"
      >
        <span className="flex items-center gap-2">
          <IconPalette size={15} /> {copy.themes}
        </span>
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          {NOTE_THEMES.map((theme) => (
            <i key={theme} className={`picker-${theme} size-3 rounded-full`} />
          ))}
        </span>
      </div>
    </div>
  )
}

function InterviewPreview({copy}: {copy: InterviewPreviewCopy}) {
  return (
    <div className="border-hairline bg-paper-raised overflow-hidden rounded-xl border">
      <div className="border-hairline text-ink-muted flex items-center justify-between border-b px-4 py-3 text-xs">
        <span className="flex items-center gap-2">
          <IconUsersGroup size={16} /> {copy.label}
        </span>
        <span className="flex items-center gap-1.5">
          <IconMessageCircle size={14} /> {copy.status}
        </span>
      </div>
      <div className="space-y-5 p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="border-hairline bg-paper flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-medium">
            L
          </div>
          <div>
            <p className="text-sm font-semibold">{copy.name}</p>
            <p className="text-ink-muted text-xs">{copy.role}</p>
          </div>
        </div>
        <div className="bg-ink text-paper ml-auto max-w-sm rounded-xl rounded-br-sm p-3 text-sm">
          {copy.prompt}
        </div>
        <div className="border-hairline bg-paper max-w-sm rounded-xl rounded-bl-sm border p-3 font-serif leading-relaxed">
          {copy.reply}
        </div>
      </div>
    </div>
  )
}

function LandingHero({
  copy,
  locale,
  authenticated,
}: {
  copy: {
    lineOne: string
    lineTwo: string
    description: string
    createAccount: string
    openNotes: string
    exploreFeatures: string
  }
  locale: string
  authenticated: boolean
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-8 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-serif text-5xl leading-tight font-medium tracking-tight">
          <span className="block">{copy.lineOne}</span>
          <span className="block">{copy.lineTwo}</span>
        </h1>
        <p className="text-ink-muted mx-auto mt-6 max-w-2xl text-sm leading-relaxed">
          {copy.description}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton
            href={`/${locale}/${authenticated ? 'eton' : 'login'}`}
            variant="primary"
          >
            {authenticated ? copy.openNotes : copy.createAccount}{' '}
            <IconArrowRight size={18} />
          </LinkButton>
          <a
            className="text-ink-muted hover:text-ink focus-visible:outline-accent rounded-md px-4 py-3 text-sm underline-offset-4 hover:underline focus-visible:outline-2"
            href="#features"
          >
            {copy.exploreFeatures}
          </a>
        </div>
      </div>
    </section>
  )
}

function UpcomingSection({
  copy,
}: {
  copy: {
    title: string
    description: string
    companionTitle: string
    companionDescription: string
    status: string
  }
}) {
  return (
    <section
      aria-labelledby="upcoming-heading"
      className="mx-auto max-w-7xl px-4 pb-20 sm:px-8"
    >
      <div className="border-hairline border-t pt-10 sm:pt-12">
        <div className="mb-6">
          <h2
            id="upcoming-heading"
            className="font-serif text-3xl font-medium sm:text-4xl"
          >
            {copy.title}
          </h2>
          <p className="text-ink-muted mt-3 max-w-2xl leading-relaxed">
            {copy.description}
          </p>
        </div>
        <div className="border-hairline flex flex-col gap-3 rounded-lg border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <IconSparkles className="text-accent shrink-0" size={19} />
            <div>
              <h3 className="font-semibold">{copy.companionTitle}</h3>
              <p className="text-ink-muted mt-1 text-sm">
                {copy.companionDescription}
              </p>
            </div>
          </div>
          <span className="border-hairline text-ink-muted w-fit rounded-full border px-3 py-1 text-xs">
            {copy.status}
          </span>
        </div>
      </div>
    </section>
  )
}

export default async function Home({params}: PropsWithLocale) {
  const {locale} = await params
  await connection()
  const session = await auth()
  const authenticated = isValidSession(session)

  const t = await getTranslations('landing')
  const messages = await getMessages()
  const createdAt = new Date('2026-10-19T09:41:00.000Z')

  const previewNotes: Note[] = [
    {
      id: '019a0000-0000-7000-8000-000000000001',
      authorId: '019a0000-0000-7000-8000-000000000000',
      revision: '019a0000-0000-7000-8000-000000000000',
      lastMutationId: null,
      title: t.raw('notes.preview.noteOneTitle') as string,
      content: t.raw('notes.preview.noteOneContent') as string,
      theme: 'yellow',
      isEncrypted: false,
      isArchived: false,
      pendingDeleteAt: null,
      updatedAt: createdAt,
      createdAt,
    },
    {
      id: '019a0000-0000-7000-8000-000000000002',
      authorId: '019a0000-0000-7000-8000-000000000000',
      revision: '019a0000-0000-7000-8000-000000000000',
      lastMutationId: null,
      title: t.raw('notes.preview.noteTwoTitle') as string,
      content: `<p>${t('notes.preview.noteTwoIntro')} <code>const nextStep = "begin";</code></p><p>${t('notes.preview.noteTwoCaption')}</p>`,
      theme: 'blue',
      isEncrypted: false,
      isArchived: false,
      pendingDeleteAt: null,
      updatedAt: new Date('2026-10-18T15:20:00.000Z'),
      createdAt: new Date('2026-10-18T15:20:00.000Z'),
    },
    {
      id: '019a0000-0000-7000-8000-000000000003',
      authorId: '019a0000-0000-7000-8000-000000000000',
      revision: '019a0000-0000-7000-8000-000000000000',
      lastMutationId: null,
      title: t.raw('notes.preview.noteThreeTitle') as string,
      content: t.raw('notes.preview.noteThreeContent') as string,
      theme: 'rose',
      isEncrypted: false,
      isArchived: false,
      pendingDeleteAt: null,
      updatedAt: new Date('2026-10-17T11:15:00.000Z'),
      createdAt: new Date('2026-10-17T11:15:00.000Z'),
    },
  ]

  return (
    <main className="body-h-auto">
      <LandingHero
        locale={locale}
        authenticated={authenticated}
        copy={{
          lineOne: t('hero.lineOne'),
          lineTwo: t('hero.lineTwo'),
          description: t('hero.description'),
          createAccount: t('hero.createAccount'),
          openNotes: t('hero.openNotes'),
          exploreFeatures: t('hero.exploreFeatures'),
        }}
      />
      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-8">
        <section className="border-hairline border-t py-10 sm:py-14">
          <div className="mb-7 max-w-2xl">
            <p className="text-ink-muted mb-3 flex items-center gap-2 text-sm">
              <IconUsersGroup size={17} /> {t('interview.eyebrow')}
            </p>
            <h2 className="font-serif text-3xl font-medium sm:text-4xl">
              {t('interview.title')}
            </h2>
            <p className="text-ink-muted mt-4 leading-relaxed">
              {t('interview.description')}
            </p>
          </div>
          <div className="bg-dotgrid rounded-lg p-3 sm:p-6">
            <div className="mx-auto max-w-3xl">
              <InterviewPreview
                copy={{
                  label: t('interview.preview.label'),
                  status: t('interview.preview.status'),
                  name: t('interview.preview.name'),
                  role: t('interview.preview.role'),
                  prompt: t('interview.preview.prompt'),
                  reply: t('interview.preview.reply'),
                }}
              />
            </div>
          </div>
          <LinkButton
            className="mt-5"
            href={`/${locale}/${authenticated ? 'ai/interview' : 'login'}`}
            variant="link"
          >
            {t('interview.action')} <IconArrowRight size={16} />
          </LinkButton>
        </section>
        <section className="border-hairline border-t py-10 sm:py-14">
          <div className="mb-7 max-w-2xl">
            <p className="text-ink-muted mb-3 flex items-center gap-2 text-sm">
              <IconNotes size={17} /> {t('notes.eyebrow')}
            </p>
            <h2 className="font-serif text-3xl font-medium sm:text-4xl">
              {t('notes.title')}
            </h2>
            <p className="text-ink-muted mt-4 leading-relaxed">
              {t('notes.description')}
            </p>
          </div>
          <NextIntlClientProvider messages={{note: messages.note}}>
            <NoteGalleryPreview
              notes={previewNotes}
              copy={{
                title: t('notes.preview.title'),
                createNote: t('notes.preview.createNote'),
                createNoteHref: `/${locale}/eton`,
                themes: t('notes.preview.themes'),
              }}
            />
          </NextIntlClientProvider>
          <LinkButton
            className="mt-5"
            href={`/${locale}/${authenticated ? 'eton' : 'login'}`}
            variant="link"
          >
            {t('notes.action')} <IconArrowRight size={16} />
          </LinkButton>
        </section>
      </section>
      <UpcomingSection
        copy={{
          title: t('upcoming.title'),
          description: t('upcoming.description'),
          companionTitle: t('upcoming.companionTitle'),
          companionDescription: t('upcoming.companionDescription'),
          status: t('upcoming.status'),
        }}
      />
    </main>
  )
}
