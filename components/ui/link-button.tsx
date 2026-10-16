import Link from 'next/link'
import {cn} from 'cn'
import type {ComponentProps} from 'react'
import {
  buttonClass,
  type ButtonSize,
  type ButtonVariant,
} from '~/components/ui/button'

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant
  size?: ButtonSize
}

/**
 * Anchor styled like Button (same class assembly), rendering the app's Link.
 * Styling mirrors Button; Link has no disabled/loading states.
 */
export default function LinkButton({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={cn(buttonClass({variant, size, iconOnly: false}), className)}
      {...rest}
    >
      {children}
    </Link>
  )
}

export type {LinkButtonProps}
