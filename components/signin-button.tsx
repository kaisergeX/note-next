'use client'
import {signIn} from 'next-auth/react'
import {useSearchParams} from 'next/navigation'
import type {ButtonHTMLAttributes, PropsWithChildren} from 'react'

type Props = {
  provider?: Parameters<typeof signIn>[0]
} & ButtonHTMLAttributes<HTMLButtonElement>

export default function SigninButton({
  provider = 'google',
  children,
  ...props
}: PropsWithChildren<Props>) {
  const searchParams = useSearchParams()
  const callbackUrl = `/${searchParams.get('callbackUrl') || ''}`

  return (
    <button
      type="button"
      className="button"
      onClick={() => void signIn(provider, {redirect: true, callbackUrl})}
      {...props}
    >
      {children}
    </button>
  )
}
