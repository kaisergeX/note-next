'use client'
import type {ButtonHTMLAttributes, PropsWithChildren} from 'react'
import {IconArrowUp} from '@tabler/icons-react'
import {useWindowScroll} from '~/util/hooks/use-window-scroll'
import {classNames} from '~/util'

export default function ScrollTopButton({
  children,
  ...props
}: PropsWithChildren<
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>
>) {
  const [scroll, scrollTo] = useWindowScroll()

  return (
    <button
      type="button"
      role="navigation"
      className={classNames(
        scroll.y > 200 ? 'visible bottom-4' : 'invisible -bottom-16',
        'button fixed right-4 rounded-full p-1 mix-blend-difference invert transition-all dark:invert-0',
      )}
      onClick={() => scrollTo({y: 0})}
      {...props}
    >
      {children || <IconArrowUp />}
    </button>
  )
}
