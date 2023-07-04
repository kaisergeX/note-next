import {IconActivity, IconNotes} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import SwooshImg from '~/public/swoosh.png'

export default function Home() {
  const t = useTranslations()

  return (
    <main className="[&>section]:h-[100dvh] [&>section]:w-full [&>section]:px-4">
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
          <Link href="/users" className="button">
            <span>{t('admin.title')}</span>
            <IconActivity />
          </Link>

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
