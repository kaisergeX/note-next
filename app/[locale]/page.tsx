import {useTranslations} from 'next-intl'
import Link from 'next/link'

export default function Home() {
  const t = useTranslations('homepage')

  return (
    <main className="flex min-h-screen flex-col p-4">
      <Link href="/">
        {/* <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-yellow-400">
          {t('title')}
        </span> */}
        <span className="bg-gradient-to-r from-rose-500 to-violet-500 bg-clip-text text-4xl font-bold text-transparent">
          {t('title')}
        </span>
      </Link>

      <div className="flex-center flex-1">
        <Link href="/users" className="button">
          User Management <span aria-hidden="true">&rarr;</span>
        </Link>

        <Link href="/eton" className="button-secondary">
          Notes <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
    </main>
  )
}
