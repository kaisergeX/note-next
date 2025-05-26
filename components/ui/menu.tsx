import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  type MenuItemsProps,
} from '@headlessui/react'
import {classNames} from '@kaiverse/k/utils'
import Link from 'next/link'
import type {ElementType, PropsWithChildren, ReactNode} from 'react'

export type MenuItem = {
  containerAs?: 'div'
  disabled?: boolean
  hidden?: boolean
} & (
  | {type: 'link'; className?: string; url: string; label: ReactNode}
  | {type?: undefined; component: ReactNode}
)

type MenuCustomProps = {
  as?: ElementType
  className?: string
  menuClassName?: string
  itemsClassName?: string
  items?: MenuItem[]
  anchor?: MenuItemsProps['anchor']
}

export default function MenuCustom({
  as = 'div',
  className,
  menuClassName = '',
  itemsClassName = '',
  items = [],
  anchor = 'bottom end',
  children,
}: PropsWithChildren<MenuCustomProps>) {
  const renderMenuItems = items.map((item, index) => (
    <MenuItem key={index} as={item.containerAs} disabled={item.disabled}>
      {item.type === 'link' ? (
        <Link
          href={item.url}
          className={classNames(
            'hover:bg-reverse data-[active]:bg-reverse data-[disabled]:disabled flex items-center gap-2 p-4 transition-colors',
            item.className || '',
          )}
        >
          {item.label}
        </Link>
      ) : (
        item.component
      )}
    </MenuItem>
  ))

  return (
    <Menu as={as} className={classNames('relative', menuClassName)}>
      <MenuButton className={className}>{children}</MenuButton>

      <MenuItems
        className={classNames(
          'bg-default shadow-theme ring-theme overflow-hidden rounded-md text-sm font-semibold focus:outline-none',
          'transform transition',
          'data-closed:scale-95 data-closed:opacity-0',
          'data-enter:opacity-100 data-enter:duration-100 data-enter:ease-out',
          'data-leave:opacity-0 data-leave:duration-75 data-leave:ease-in',
          itemsClassName,
        )}
        transition
        anchor={anchor}
      >
        {renderMenuItems}
      </MenuItems>
      {/* </Float> */}
    </Menu>
  )
}
