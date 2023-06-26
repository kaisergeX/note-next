'use client'
import {signOut} from 'next-auth/react'
import type {ButtonHTMLAttributes, PropsWithChildren} from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement>

export default function SignOutButton({
  children,
  ...props
}: PropsWithChildren<Props>) {
  return (
    <button
      type="button"
      className="button"
      onClick={() => void signOut({redirect: true, callbackUrl: '/'})}
      {...props}
    >
      {children}
    </button>
  )
}
