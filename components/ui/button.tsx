import {IconLoader2} from '@tabler/icons-react'
import {cn} from 'cn'
import type {ComponentPropsWithRef} from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  iconOnly?: boolean
  loading?: boolean
  /** Disable the shared pressed translation for compact menu-row actions. */
  pressMotion?: boolean
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
  sm: 'h-8 gap-1.5 px-3 text-xs touch-target-expand',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2.5 px-5 text-base',
}

const ICON_ONLY_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 w-8 p-0 rounded-full touch-target-expand', // increase touch area a bit for touch device while keep the button visually small size.
  md: 'h-10 w-10 p-0 rounded-full',
  lg: 'h-12 w-12 p-0 rounded-full',
}

const LOADER_SIZES: Record<ButtonSize, number> = {sm: 14, md: 16, lg: 18}

const BASE_CLASSES =
  'relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-md border border-transparent font-semibold transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed aria-busy:pointer-events-none aria-busy:opacity-75'

/** Assembles the full class list for a Button: base + variant + size (icon-aware). */
export function buttonClass({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  pressMotion = true,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  iconOnly?: boolean
  pressMotion?: boolean
} = {}): string {
  return cn(
    BASE_CLASSES,
    pressMotion && 'active:translate-y-px',
    VARIANTS[variant],
    iconOnly ? ICON_ONLY_SIZES[size] : SIZES[size],
  )
}

/**
 * Paper & Ink button. Variants per DESIGN.md; accent is never a button fill.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  loading = false,
  pressMotion = true,
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
      className={cn(
        buttonClass({variant, size, iconOnly, pressMotion}),
        className,
      )}
      {...props}
    >
      {loading ? (
        <IconLoader2
          className="animate-spin motion-reduce:animate-none"
          size={LOADER_SIZES[size]}
          aria-hidden
        />
      ) : null}
      {children}
    </button>
  )
}

type MenuItemButtonProps = Omit<ButtonProps, 'variant' | 'pressMotion'> & {
  destructive?: boolean
}

/** Full-width popover action using the shared button shape. */
export function MenuItemButton({
  destructive = false,
  className,
  ...props
}: MenuItemButtonProps) {
  return (
    <Button
      variant={destructive ? 'danger' : 'ghost'}
      pressMotion={false}
      className={cn(
        'w-full justify-start border-transparent px-3 text-left',
        className,
      )}
      {...props}
    />
  )
}

export type {ButtonProps, ButtonSize, ButtonVariant, MenuItemButtonProps}
