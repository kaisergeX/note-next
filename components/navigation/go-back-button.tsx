'use client'
import {useRouter} from 'next/navigation'
import type {ButtonHTMLAttributes, PropsWithChildren} from 'react'
import Button from '~/components/ui/button'

export default function GoBackButton({
  children,
  ...props
}: PropsWithChildren<
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>
>) {
  const router = useRouter()

  return (
    <Button {...props} onClick={() => router.back()}>
      {children}
    </Button>
  )
}
