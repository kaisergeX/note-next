import {IconActivity, IconNotes} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'

export default function Home() {
  const t = useTranslations('admin')

  return (
    <main className="[&>div]:w-full [&>div]:px-4">
      <section className="flex-center h-[100dvh] flex-col">
        <h1 className="mb-8 text-center text-4xl font-extrabold">
          Imagine a home page here 🏡
        </h1>
        <div className="flex-center">
          <Link href="/users" className="button">
            {t('title')} <IconActivity size="1.2rem" />
          </Link>
          <Link href="/eton" className="button-secondary">
            Notes <IconNotes size="1.2rem" />
          </Link>
        </div>
      </section>

      <section className="bg-reverse flex-center h-[150vh]  w-full">
        <h1 className="mb-8 text-center text-4xl font-extrabold">
          Well, nothing here yet ☁️
        </h1>
      </section>
    </main>
  )
}
