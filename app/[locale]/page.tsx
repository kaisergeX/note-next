import {IconNotes} from '@tabler/icons-react'
import {getServerSession} from 'next-auth'
import {getTranslator, redirect} from 'next-intl/server'
import Image from 'next/image'
import Link from 'next/link'
import {authOptions} from '~/config/auth'
import SwooshImg from '~/public/swoosh.png'

type HomeProps = {
  params: {locale: string}
  searchParams: {
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_content?: string
    utm_term?: string
    p_r?: string
  }
}

export default async function Home({
  params: {locale},
  searchParams: {p_r},
}: HomeProps) {
  const t = await getTranslator(locale)
  const session = await getServerSession(authOptions)

  if (session && !p_r) {
    redirect('/eton')
  }

  return (
    <main className="[&>section]:h-[100svh] [&>section]:w-full [&>section]:px-4">
      <section className="flex-center flex-col">
        <h2 className="text-center text-2xl font-extrabold md:text-4xl">
          {t('homepage.title')}
        </h2>
        <p className="mx-auto mb-8 text-justify sm:w-1/2">
          Lorem ipsum dolor sit amet consectetur adipisicing elit.
          Necessitatibus quidem quo sapiente alias magnam mollitia ad nesciunt
          quasi! Eius quibusdam libero vero tenetur deserunt ullam saepe eaque
          quia ducimus dicta.
        </p>
        <div className="flex-center">
          <Link href="/eton" className="button-secondary">
            <span>{t('note.title')}</span>
            <IconNotes />
          </Link>
        </div>
      </section>

      <section className="bg-reverse flex-center relative flex-col">
        <h2 className="mb-8 text-center text-4xl font-extrabold">
          Well, nothing here yet ☁️
        </h2>
        <h3>Stop scrolling!</h3>

        <Image
          className="absolute bottom-0 left-0 hidden dark:block"
          src={SwooshImg}
          alt="fancy wave background"
          quality={100}
          placeholder="blur"
        />
      </section>

      <section className="flex-center relative">
        <h2 className="mb-8 text-center text-4xl font-extrabold">
          Told you 🤷‍♂️...
        </h2>

        <Image
          className="absolute bottom-0 left-0 -z-10 dark:hidden"
          src={SwooshImg}
          alt="a fancy wave background"
          quality={100}
          placeholder="blur"
        />
      </section>
    </main>
  )
}
