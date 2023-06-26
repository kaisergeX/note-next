import {useTranslations} from 'next-intl'
import {type ReactNode} from 'react'
import SignOutButton from '~/components/signout-button'

export const metadata = {
  title: 'etoN - Admin Portal',
  description:
    'Admin Portal of "etoN" - A minimalistic note-taking app for everyone.',
}

type Props = {
  children: ReactNode
}

export default function LocaleLayout({children}: Props) {
  const t = useTranslations('auth')

  return (
    <main className="bg-fancy flex min-h-[100dvh] flex-col items-center justify-center p-24">
      <SignOutButton>{t('signOut')}</SignOutButton>
      {children}
    </main>
  )
}
