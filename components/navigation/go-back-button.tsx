'use client'
import {useRouter} from 'next/navigation'
import type {ButtonHTMLAttributes, PropsWithChildren} from 'react'

export default function GoBackButton({
  children,
  ...props
}: PropsWithChildren<
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>
>) {
  const router = useRouter()

  return (
    <button
      type="button"
      className="button"
      {...props}
      onClick={() => router.back()}
    >
      {children}
    </button>
  )
}
