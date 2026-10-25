import type {Metadata} from 'next'
import {NextIntlClientProvider} from 'next-intl'
import {getMessages, getTranslations} from 'next-intl/server'
import {ViewTransition} from 'react'
import NoteCollectionLayout from '~/components/note/note-collection-layout'
import {requireAuth} from '~/server-utils'
import {genRandom} from '~/util'

export const instant = false

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  const appName = process.env.SERVICE_SHORTNAME ?? t('common.app')

  return {
    title: `${t('note.title')} | ${appName}`,
    description: t('common.slogan'),
  }
}

export default async function NoteLayout({children}: LayoutProps<'/[locale]'>) {
  await requireAuth()
  const noteMessages = (await getMessages()).note

  return (
    <NextIntlClientProvider messages={{note: noteMessages}}>
      <ViewTransition>
        <NoteCollectionLayout creationLabel={genRandom(noteMessages.creation)}>
          {children}
        </NoteCollectionLayout>
      </ViewTransition>
    </NextIntlClientProvider>
  )
}
