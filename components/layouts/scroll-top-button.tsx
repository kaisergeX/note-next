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
        'button button-affix rounded-full p-1 transition-all sm-only:hidden',
        scroll.y > 200 ? 'visible' : 'invisible -bottom-16',
      )}
      onClick={() => scrollTo({y: 0})}
      {...props}
    >
      {children || <IconArrowUp />}
    </button>
  )
}
