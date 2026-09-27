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

export type MenuCustomItem = {
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
  items?: MenuCustomItem[]
  /**
   * Headless UI forces `portal` when `anchor` is set, which renders MenuItems
   * into a body-level portal div that sits below a <dialog> top layer.
   * Pass `null` to render the items inline (no anchor, no portal) and position
   * them via `itemsClassName` — required inside native <dialog> drawers.
   */
  anchor?: MenuItemsProps['anchor'] | null
}

export default function MenuCustom({
  as,
  className,
  menuClassName = '',
  itemsClassName = '',
  items = [],
  anchor = 'bottom end',
  children,
}: PropsWithChildren<MenuCustomProps>) {
  const renderMenuItems = items.flatMap((item, index) =>
    item.hidden ? (
      []
    ) : (
      <MenuItem key={index} as={item.containerAs} disabled={item.disabled}>
        {item.type === 'link' ? (
          <Link
            href={item.url}
            className={classNames(
              'hover:bg-reverse data-active:bg-reverse data-disabled:disabled flex items-center gap-2 p-4 transition-colors',
              item.className || '',
            )}
          >
            {item.label}
          </Link>
        ) : (
          item.component
        )}
      </MenuItem>
    ),
  )

  return (
    <Menu as="div" className={classNames('relative', menuClassName)}>
      <MenuButton className={className}>{children}</MenuButton>

      <MenuItems
        as={as}
        className={classNames(
          'bg-default shadow-theme ring-theme overflow-hidden rounded-md border border-gray-400 text-sm font-semibold focus:outline-none dark:border-gray-900',
          'transform transition',
          'data-closed:scale-95 data-closed:opacity-0',
          'data-enter:opacity-100 data-enter:duration-100 data-enter:ease-out',
          'data-leave:opacity-0 data-leave:duration-75 data-leave:ease-in',
          itemsClassName,
        )}
        transition
        {...(anchor === null ? {} : {anchor})}
        // modal={false} skips the useInertOthers inert sweep; with many menus
        // on a page the modal stack desyncs and the whole page stays inert until reload.
        modal={false}
      >
        {renderMenuItems}
      </MenuItems>
      {/* </Float> */}
    </Menu>
  )
}
