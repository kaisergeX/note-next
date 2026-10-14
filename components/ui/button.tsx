import {classNames} from '@kaiverse/k/utils'
import {IconLoader2} from '@tabler/icons-react'
import type {ComponentPropsWithRef} from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  iconOnly?: boolean
  loading?: boolean
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink-hover active:bg-ink',
  secondary:
    'border-hairline bg-paper-raised text-ink hover:border-hairline-strong hover:bg-raised-hover',
  ghost: 'bg-transparent text-ink hover:bg-ink-tint active:bg-ink-tint-strong',
  danger:
    'border-destructive/40 bg-transparent text-destructive hover:border-transparent hover:bg-destructive hover:text-paper',
  link: 'h-auto w-auto px-0 py-2.5 font-medium text-accent underline decoration-transparent underline-offset-[3px] transition-[text-decoration-color] hover:decoration-current active:translate-y-0',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2.5 px-5 text-base',
}

const ICON_ONLY_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 w-8 p-0',
  md: 'h-10 w-10 p-0',
  lg: 'h-12 w-12 p-0',
}

const LOADER_SIZES: Record<ButtonSize, number> = {sm: 14, md: 16, lg: 18}

const BASE_CLASSES =
  'relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-md border border-transparent font-semibold transition-colors duration-100 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed aria-busy:pointer-events-none aria-busy:opacity-75'

/**
 * Paper & Ink button. Variants per DESIGN.md; accent is never a button fill.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      className={classNames(
        BASE_CLASSES,
        VARIANTS[variant],
        iconOnly ? ICON_ONLY_SIZES[size] : SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <IconLoader2
          className="animate-spin"
          size={LOADER_SIZES[size]}
          aria-hidden
        />
      ) : null}
      {children}
    </button>
  )
}

export type {ButtonProps, ButtonVariant, ButtonSize}
