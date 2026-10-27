'use client'
import {signIn} from 'next-auth/react'
import {useSearchParams} from 'next/navigation'
import type {ButtonHTMLAttributes, PropsWithChildren} from 'react'
import Button from '~/components/ui/button'
import {requestAccountExit} from '~/lib/notes/session-sync'

type Props = {
  provider?: Parameters<typeof signIn>[0]
} & ButtonHTMLAttributes<HTMLButtonElement>

export default function SignInButton({
  provider = 'google',
  children,
  ...props
}: PropsWithChildren<Props>) {
  const searchParams = useSearchParams()
  const callbackUrl = `/${searchParams.get('callbackUrl') || ''}`

  return (
    <Button
      onClick={() =>
        void requestAccountExit().then((allowed) => {
          if (allowed) return signIn(provider, {redirect: true, callbackUrl})
        })
      }
      {...props}
    >
      {children}
    </Button>
  )
}
