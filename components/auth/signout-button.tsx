'use client'
import {signOut} from 'next-auth/react'
import type {ButtonHTMLAttributes, PropsWithChildren} from 'react'
import {MenuItemButton} from '~/components/ui/button'

type Props = ButtonHTMLAttributes<HTMLButtonElement>

export default function SignOutButton({
  children,
  ...props
}: PropsWithChildren<Props>) {
  return (
    <MenuItemButton
      className="w-full"
      type="button"
      destructive
      onClick={() => void signOut({redirect: true, redirectTo: '/'})}
      {...props}
    >
      {children}
    </MenuItemButton>
  )
}
