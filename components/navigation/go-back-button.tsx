'use client'
import {usePathname} from 'next/navigation'
import type {PropsWithChildren} from 'react'
import LinkButton, {type LinkButtonProps} from '~/components/ui/link-button'
import {parentPagePath} from '~/lib/navigation'

export default function GoBackButton({
  children,
  ...props
}: PropsWithChildren<Omit<LinkButtonProps, 'href'>>) {
  const pathname = usePathname()

  return (
    <LinkButton
      variant="primary"
      {...props}
      href={parentPagePath(pathname)}
      replace
    >
      {children}
    </LinkButton>
  )
}
