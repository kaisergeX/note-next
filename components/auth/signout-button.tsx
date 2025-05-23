'use client'
import type {ButtonHTMLAttributes, PropsWithChildren} from 'react'
import {signOut} from '~/config/auth'

type Props = ButtonHTMLAttributes<HTMLButtonElement>

export default function SignOutButton({
  children,
  ...props
}: PropsWithChildren<Props>) {
  return (
    <button
      type="button"
      className="button"
      onClick={() => void signOut({redirect: true, redirectTo: '/'})}
      {...props}
    >
      {children}
    </button>
  )
}
