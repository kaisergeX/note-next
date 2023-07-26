import {Menu} from '@headlessui/react'
import {Fragment, type PropsWithChildren, type ReactNode} from 'react'
import {classNames} from '~/util'
import Link from 'next/link'
import type {ReactTag} from '@headlessui/react/dist/types'
import {Float, type FloatProps} from '@headlessui-float/react'

export type MenuItem = {
  containerAs?: 'div'
  disabled?: boolean
  hidden?: boolean
} & (
  | {type: 'link'; className?: string; url: string; label: ReactNode}
  | {type?: undefined; component: ReactNode}
)

type MenuCustomProps = {
  as?: ReactTag
  className?: string
  menuClassName?: string
  itemsClassName?: string
  items?: MenuItem[]
  floatOptions?: Omit<FloatProps, 'as' | 'children'>
}

export default function MenuCustom({
  as = 'div',
  className,
  menuClassName = '',
  itemsClassName = '',
  items = [],
  floatOptions,
  children,
}: PropsWithChildren<MenuCustomProps>) {
  const renderMenuItems = items.map((item, index) => (
    <Menu.Item key={index} as={item.containerAs} disabled={item.disabled}>
      {item.type === 'link' ? (
        <Link
          href={item.url}
          className={classNames(
            'hover:bg-reverse ui-active:bg-reverse flex items-center gap-2 p-4 transition-colors ui-disabled:disabled',
            item.className || '',
          )}
        >
          {item.label}
        </Link>
      ) : (
        item.component
      )}
    </Menu.Item>
  ))

  return (
    <Menu as={as} className={classNames('relative', menuClassName)}>
      <Float
        as={Fragment}
        offset={8}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
        tailwindcssOriginClass
        placement="bottom-end"
        {...floatOptions}
      >
        <Menu.Button className={className}>{children}</Menu.Button>

        <Menu.Items
          className={classNames(
            'bg-default shadow-theme ring-theme overflow-hidden rounded-md text-sm font-semibold focus:outline-none',
            itemsClassName,
          )}
        >
          {renderMenuItems}
        </Menu.Items>
      </Float>
    </Menu>
  )
}
