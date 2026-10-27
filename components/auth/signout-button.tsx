'use client'
import {signOut} from 'next-auth/react'
import type {ButtonHTMLAttributes, PropsWithChildren} from 'react'
import {MenuItemButton} from '~/components/ui/button'
import {requestAccountExit} from '~/lib/notes/session-sync'

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
      onClick={() =>
        void requestAccountExit().then((allowed) => {
          if (allowed) return signOut({redirect: true, redirectTo: '/'})
        })
      }
      {...props}
    >
      {children}
    </MenuItemButton>
  )
}
