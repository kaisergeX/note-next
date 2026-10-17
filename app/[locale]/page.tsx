import {IconNotes} from '@tabler/icons-react'
import {getTranslations} from 'next-intl/server'
import Image from 'next/image'
import {redirect} from 'next/navigation'
import {connection} from 'next/server'
import {auth} from '~/auth'
import LinkButton from '~/components/ui/link-button'
import SwooshImg from '~/public/swoosh.png'
import {isValidSession} from '~/server-utils'
import type {PropsWithLocale} from '~/types'

export const instant = false

type HomeProps = PropsWithLocale<{
  searchParams: Promise<{
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_content?: string
    utm_term?: string
    p_r?: string
  }>
}>

export default async function Home(props: HomeProps) {
  const searchParams = await props.searchParams
  const {p_r} = searchParams
  const t = await getTranslations()
  await connection()
  const session = await auth()

  if (isValidSession(session) && !p_r) {
    redirect('/eton')
  }

  return (
    <main className="body-h-auto [&>section]:h-svh [&>section]:w-full [&>section]:px-4">
      <section className="flex-center flex-col">
        <h2 className="text-center font-serif text-4xl leading-tight font-medium md:text-5xl">
          {t('homepage.title')}
        </h2>
        <p className="mx-auto mb-8 text-justify sm:w-1/2">
          Lorem ipsum dolor sit amet consectetur adipisicing elit.
          Necessitatibus quidem quo sapiente alias magnam mollitia ad nesciunt
          quasi! Eius quibusdam libero vero tenetur deserunt ullam saepe eaque
          quia ducimus dicta.
        </p>
        <div className="flex-center">
          <LinkButton href="/eton" variant="secondary">
            <span>{t('note.title')}</span>
            <IconNotes />
          </LinkButton>
        </div>
      </section>

      <section className="bg-ink text-paper flex-center relative flex-col">
        <h2 className="mb-8 text-center font-serif text-4xl leading-tight font-medium">
          Well, nothing here yet ☁️
        </h2>
        <h3>Stop scrolling!</h3>

        <Image
          className="absolute bottom-0 left-0 hidden dark:block"
          src={SwooshImg}
          alt="fancy wave background"
          placeholder="blur"
        />
      </section>

      <section className="flex-center relative">
        <h2 className="mb-8 text-center text-4xl font-extrabold">😶‍🌫️</h2>

        <Image
          className="absolute bottom-0 left-0 -z-10 dark:hidden"
          src={SwooshImg}
          alt="a fancy wave background"
          placeholder="blur"
        />
      </section>
    </main>
  )
}
