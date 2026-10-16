'use client'
import {cn} from 'cn'
import {IconArrowUp} from '@tabler/icons-react'
import type {ButtonHTMLAttributes, PropsWithChildren} from 'react'
import Button from '~/components/ui/button'
import {useWindowScroll} from '~/util/hooks'

export default function ScrollTopButton({
  children,
  ...props
}: PropsWithChildren<
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>
>) {
  const [scroll, scrollTo] = useWindowScroll()

  return (
    <Button
      type="button"
      variant="secondary"
      iconOnly
      size="md"
      aria-label="Scroll to top"
      className={cn(
        'shadow-sheet fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] transition-all max-sm:hidden',
        scroll.y > 200 ? 'visible' : 'invisible translate-y-16',
      )}
      onClick={() => scrollTo({y: 0})}
      {...props}
    >
      {children || <IconArrowUp />}
    </Button>
  )
}
