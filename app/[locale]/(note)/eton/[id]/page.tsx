'use client'
import {IconArrowLeft, IconPencil, IconTrash} from '@tabler/icons-react'
import {useRouter} from 'next/navigation'

type NoteDetailProps = {params: {id: string}}

export default function NoteDetail({params: {id}}: NoteDetailProps) {
  const router = useRouter()

  const noteData = fakeData.find((note) => note.id === id)
  if (!noteData) {
    return router.back()
  }

  const {title, content} = noteData

  return (
    <main className="relative flex h-full flex-col overflow-y-auto">
      <div className="glass sticky inset-x-0 top-0 flex items-center justify-between gap-4 p-4">
        <button
          type="button"
          className="button button-icon rounded-full p-1"
          onClick={() => router.push('/eton')}
        >
          <IconArrowLeft />
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="button-secondary button-icon rounded-full p-1"
            disabled
          >
            <IconPencil />
          </button>
          <button
            type="button"
            className="button-secondary button-icon rounded-full p-1"
            disabled
          >
            <IconTrash />
          </button>
        </div>
      </div>
      {title && <h1 className="px-8 py-6">{title}</h1>}

      <div className="shadow-theme m-4 h-full rounded-xl p-4">
        {content ? (
          <article
            className="prose prose-sm max-w-none dark:prose-invert sm:prose-base"
            dangerouslySetInnerHTML={{__html: content}}
          />
        ) : (
          <p className="cursor-default text-zinc-400">No content</p>
        )}
      </div>
    </main>
  )
}

const fakeData = [
  {
    title:
      "Long title Long title Long title Long title Long title Long title Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a g",
    content: '<p class="m-0">abcdeww<strong>eesssseee</strong>   123</p>',
    userId: 'Pi4IQ4NXtzaG5Z2C4ueye1DDtul2',
    id: 'DjHPIr4lwFUOr8wNOvMv',
  },
  {
    userId: 'Pi4IQ4NXtzaG5Z2C4ueye1DDtul2',
    title: 'title 1 ✏️',
    id: 'aEbHd4ExHT4J2HZX4zCf',
  },
  {
    content:
      "🍀<i>Lorem Ipsum</i> is simply dummy text of <del>the printing</del> and <mark>typesetting industry</mark>. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.",
    userId: 'Pi4IQ4NXtzaG5Z2C4ueye1DDtul2',
    id: 'cPRLBYmZ6D8e5S4v0Poj',
  },
  {
    title: 'Garlic bread with cheese: What the science tells us',
    userId: 'Pi4IQ4NXtzaG5Z2C4ueye1DDtul2',
    content: '<p class="m-0">asd4r4r</p>',
    id: 'jfqYY9Bjt6ngDFclqcPV',
  },
  {
    title:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a g",
    content:
      '<p class="m-0">abcdewweesssseee   123</p><blockquote><p>To start syncing your workspace, just sign in with Google in the menu.</p></blockquote>',
    userId: 'Pi4IQ4NXtzaG5Z2C4ueye1DDtul2',
    id: 'DjHPIr4lwFUOr8wNOvMc',
  },
  {
    userId: 'Pi4IQ4NXtzaG5Z2C4ueye1DDtul2',
    title: '🤡 title 1',
    content: '<blockquote><p>Quote nhảm</p></blockquote>',
    id: 'aEbHd4ExHT4J2HZX4zCe',
  },
  {
    content:
      "<code>Hello world!</code><i>Lorem Ipsum is simply dummy text of <strong>the printing</strong> and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.</i>",
    userId: 'Pi4IQ4NXtzaG5Z2C4ueye1DDtul2',
    id: 'cPRLBYmZ6D8e5S4v0Poc',
  },
  {
    title: 'wwww',
    userId: 'Pi4IQ4NXtzaG5Z2C4ueye1DDtul2',
    content:
      '<p class="m-0">asd4r4r</p><strong>Garlic bread with cheese: What the science tells us</strong>',
    id: 'jfqYY9Bjt6ngDFclqcPVs',
  },
]
