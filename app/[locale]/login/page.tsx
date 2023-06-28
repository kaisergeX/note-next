import FancyHeading from '~/components/fancy-heading'
import SignInButton from '~/components/auth/signin-button'
import {redirect} from 'next/navigation'
import {getTranslator} from 'next-intl/server'
import {authOptions} from '~/app/api/auth/[...nextauth]/route'
import {getServerSession} from 'next-auth'

type Props = {
  params: {locale: string}
}

export default async function Login({params: {locale}}: Props) {
  const t = await getTranslator(locale, 'auth')
  const session = await getServerSession(authOptions)

  if (session) {
    redirect('/')
  }

  return (
    <main className="bg-fancy flex h-full flex-col p-4">
      <FancyHeading className="mb-4" title={t('login')} />

      <div className="flex-center">
        <SignInButton>
          <svg
            className="h-4 w-4"
            aria-hidden="true"
            focusable="false"
            data-prefix="fab"
            data-icon="google"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 488 512"
          >
            <path
              fill="currentColor"
              d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
            />
          </svg>

          {t('signIn.withGoogle')}
        </SignInButton>
      </div>
    </main>
  )
}