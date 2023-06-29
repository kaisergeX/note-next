import {IconActivity, IconNotes} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'

export default function Home() {
  const t = useTranslations()

  return (
    <main className="[&>section]:h-[100dvh] [&>section]:w-full [&>section]:px-4">
      <section className="flex-center flex-col">
        <h2 className="mb-8 text-center text-2xl font-extrabold md:text-4xl">
          {t('homepage.title')}
        </h2>
        <div className="flex-center">
          <Link href="/users" className="button">
            {t('admin.title')} <IconActivity />
          </Link>
          <Link href="/eton" className="button-secondary">
            {t('note.title')} <IconNotes />
          </Link>
        </div>
      </section>

      <section className="bg-reverse flex-center">
        <h2 className="mb-8 text-center text-4xl font-extrabold">
          Well, nothing here yet ☁️
        </h2>
      </section>
    </main>
  )
}
