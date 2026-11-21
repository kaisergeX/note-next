import {notFound} from 'next/navigation'
import {Suspense} from 'react'
import {NextIntlClientProvider} from 'next-intl'
import english from '~/dictionaries/en.json'
import Preview from './preview'

export default function EncryptedNotesPreview() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return (
    <Suspense>
      <NextIntlClientProvider
        locale="en"
        messages={{note: {search: english.note.search}}}
      >
        <Preview />
      </NextIntlClientProvider>
    </Suspense>
  )
}
