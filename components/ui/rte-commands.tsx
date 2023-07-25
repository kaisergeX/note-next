'use client'

import {
  IconArrowBackUp,
  IconClearFormatting,
  IconCode,
  IconHighlight,
  IconItalic,
  IconStrikethrough,
} from '@tabler/icons-react'
import {IconBlockquote} from '@tabler/icons-react'
import {IconH1} from '@tabler/icons-react'
import {IconArrowForwardUp} from '@tabler/icons-react'
import {IconClearAll} from '@tabler/icons-react'
import {IconBold} from '@tabler/icons-react'
import type {Editor} from '@tiptap/react'
import {Fragment, type ReactNode} from 'react'
import {classNames} from '~/util'

type RTEMenuItem =
  | {
      Icon?: ReactNode
      title: string
      shortcut?: string
      action: () => boolean
      actived?: boolean
      disabled?: boolean
      customItem?: ReactNode
    }
  | {
      Icon?: ReactNode
      title?: string
      shortcut?: string
      action?: () => boolean
      actived?: boolean
      disabled?: boolean
      customItem: ReactNode
    }

export type RTECommandsProps = {
  className?: string
  editor: Editor | null
  menuType?: 'fixed' | 'bubble' | 'floating'
}

export default function RTECommands({
  className = '',
  editor,
  menuType,
}: RTECommandsProps) {
  if (!editor) {
    return <></>
  }

  const modifierKey = navigator.userAgent.includes('Mac OS') ? 'Cmd' : 'Ctrl'
  const iconSize = '1.2rem'
  const Divider = <div className="mx-0.5 h-4 w-0.5 bg-zinc-300" />

  // Menu show up when user select text, text format only.
  const floatingMenu: RTEMenuItem[] = [
    {
      Icon: <IconH1 size={iconSize} />,
      title: 'H1',
      action: () => editor.chain().focus().toggleHeading({level: 1}).run(),
      actived: editor.isActive('heading', {level: 1}),
    },
    {
      Icon: <IconBlockquote size={iconSize} />,
      title: 'Blockquote',
      action: () => editor.chain().focus().toggleBlockquote().run(),
      actived: editor.isActive('blockquote'),
      disabled: !editor.can().chain().focus().toggleBlockquote().run(),
    },
    {
      Icon: <IconCode size={iconSize} />,
      title: 'Code',
      action: () => editor.chain().focus().toggleCode().run(),
      actived: editor.isActive('code'),
      disabled: !editor.can().chain().focus().toggleCode().run(),
    },
    {
      Icon: <IconClearAll size={iconSize} />,
      title: 'Clear formats',
      action: () => editor.chain().focus().clearNodes().run(),
    },
  ]

  // Menu show up on new line, line block format only.
  const bubbleMenu: RTEMenuItem[] = [
    {
      Icon: <IconBold size={iconSize} />,
      title: 'Bold',
      shortcut: `(${modifierKey} B)`,
      action: () => editor.chain().focus().toggleBold().run(),
      actived: editor.isActive('bold'),
      disabled: !editor.can().chain().focus().toggleBold().run(),
    },
    {
      Icon: <IconItalic size={iconSize} />,
      title: 'Italicize',
      shortcut: `(${modifierKey} I)`,
      action: () => editor.chain().focus().toggleItalic().run(),
      actived: editor.isActive('italic'),
      disabled: !editor.can().chain().focus().toggleItalic().run(),
    },
    {
      Icon: <IconStrikethrough size={iconSize} />,
      title: 'Strike',
      shortcut: `(${modifierKey} Shift X)`,
      action: () => editor.chain().focus().toggleStrike().run(),
      actived: editor.isActive('strike'),
      disabled: !editor.can().chain().focus().toggleStrike().run(),
    },
    {
      Icon: <IconHighlight size={iconSize} />,
      title: 'Highlight',
      shortcut: `(${modifierKey} Shift H)`,
      action: () => editor.chain().focus().toggleHighlight().run(),
      actived: editor.isActive('highlight'),
      disabled: !editor.can().chain().focus().toggleHighlight().run(),
    },
    {
      Icon: <IconClearFormatting size={iconSize} />,
      title: 'Clear marks',
      action: () => editor.chain().focus().unsetAllMarks().run(),
    },
  ]

  const fixedMenu: RTEMenuItem[] = [
    ...bubbleMenu,
    {
      customItem: Divider,
    },
    ...floatingMenu,
    {
      customItem: Divider,
    },
    {
      Icon: <IconArrowBackUp size={iconSize} />,
      title: 'Undo',
      action: () => editor.chain().focus().undo().run(),
      disabled: !editor.can().chain().focus().undo().run(),
    },
    {
      Icon: <IconArrowForwardUp size={iconSize} />,
      title: 'Redo',
      action: () => editor.chain().focus().redo().run(),
      disabled: !editor.can().chain().focus().redo().run(),
    },
  ]

  const renderMenu = () => {
    switch (menuType) {
      case 'fixed':
        return fixedMenu

      case 'bubble':
        return bubbleMenu

      case 'floating':
        return floatingMenu

      default:
        return []
    }
  }

  if (renderMenu().length === 0) {
    return <></>
  }

  return (
    <div
      className={classNames(
        'mb-2 flex flex-wrap items-center gap-2',
        className,
      )}
      role="menubar"
    >
      {renderMenu().map(
        (
          {Icon, title, shortcut = '', action, actived, disabled, customItem},
          index,
        ) =>
          customItem ? (
            <Fragment key={index.toString()}>{customItem}</Fragment>
          ) : (
            <button
              key={title}
              className={classNames(
                actived ? 'button' : 'button-secondary',
                Icon ? 'button-icon p-1' : '',
              )}
              title={`${title} ${shortcut}`}
              type="button"
              role="menuitem"
              onClick={action}
              disabled={disabled}
            >
              {Icon || title}
            </button>
          ),
      )}
    </div>
  )
}
