'use client'

import {cn} from 'cn'
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBlockquote,
  IconBold,
  IconClearAll,
  IconClearFormatting,
  IconCode,
  IconChevronLeft,
  IconChevronRight,
  IconH1,
  IconHighlight,
  IconItalic,
  IconStrikethrough,
} from '@tabler/icons-react'
import type {Editor} from '@tiptap/react'
import {Fragment, useEffect, useRef, useState, type ReactNode} from 'react'
import Button from '~/components/ui/button'

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
  compact?: boolean
  leadingActions?: ReactNode
  trailingActions?: ReactNode
}

function getToolbarButtons(toolbar: HTMLElement) {
  return Array.from(
    toolbar.querySelectorAll<HTMLButtonElement>('button'),
  ).filter(
    (button) =>
      !button.disabled &&
      !button.closest('[inert]') &&
      button.getClientRects().length > 0,
  )
}

export default function RTECommands({
  className = '',
  editor,
  menuType,
  compact = false,
  leadingActions,
  trailingActions,
}: RTECommandsProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState({left: false, right: false})

  useEffect(() => {
    const strip = stripRef.current
    if (!compact || !strip) return

    const updateOverflow = () => {
      const left = strip.scrollLeft > 1
      const right = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1
      setOverflow((previous) =>
        previous.left === left && previous.right === right
          ? previous
          : {left, right},
      )
    }
    const observer = new ResizeObserver(updateOverflow)
    observer.observe(strip)
    strip.addEventListener('scroll', updateOverflow, {passive: true})
    return () => {
      observer.disconnect()
      strip.removeEventListener('scroll', updateOverflow)
    }
  }, [compact, editor])

  useEffect(() => {
    const toolbar = toolbarRef.current
    if (!compact || !toolbar) return

    const buttons = getToolbarButtons(toolbar)
    const current =
      buttons.find((button) => button === document.activeElement) ??
      buttons.find((button) => button.tabIndex === 0) ??
      buttons[0]
    for (const button of buttons) {
      button.tabIndex = button === current ? 0 : -1
    }
  }, [
    compact,
    editor,
    leadingActions,
    trailingActions,
    overflow.left,
    overflow.right,
  ])

  if (!editor) {
    return <></>
  }

  const modifierKey = navigator.userAgent.includes('Mac OS') ? 'Cmd' : 'Ctrl'
  const iconSize = '1.2rem'
  const Divider = (
    <div
      aria-hidden="true"
      className={cn(
        'bg-hairline-strong mx-0.5 h-4 w-0.5 shrink-0',
        compact && 'mx-1 w-px',
      )}
    />
  )

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
      ref={toolbarRef}
      className={cn(
        'flex flex-wrap items-center gap-2',
        (leadingActions || trailingActions) &&
          'flex-nowrap items-start sm:items-center',
        className,
      )}
      role={compact ? 'toolbar' : 'menubar'}
      aria-label={compact ? 'Note editing tools' : undefined}
      aria-orientation={compact ? 'horizontal' : undefined}
      data-editor-toolbar={menuType}
      onFocusCapture={
        compact
          ? (event) => {
              if (!(event.target instanceof HTMLButtonElement)) return
              for (const button of getToolbarButtons(event.currentTarget)) {
                button.tabIndex = button === event.target ? 0 : -1
              }
            }
          : undefined
      }
      onKeyDown={
        compact
          ? (event) => {
              if (event.altKey || event.ctrlKey || event.metaKey) return
              if (
                !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
              )
                return
              const buttons = getToolbarButtons(event.currentTarget)
              const index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              )
              if (index < 0 || buttons.length === 0) return

              event.preventDefault()
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? buttons.length - 1
                    : (index +
                        (event.key === 'ArrowRight' ? 1 : -1) +
                        buttons.length) %
                      buttons.length
              buttons[next]?.focus()
            }
          : undefined
      }
    >
      {leadingActions}
      <div
        ref={stripRef}
        className={cn(
          'flex flex-wrap items-center gap-2',
          compact &&
            'scrollbar-hidden -mx-1 -my-1 flex-nowrap gap-1 overflow-x-auto overscroll-x-contain px-1 py-1 sm:flex-wrap sm:overflow-visible',
          (leadingActions || trailingActions) && 'min-w-0 flex-1',
        )}
      >
        {renderMenu().map(
          (
            {Icon, title, shortcut = '', action, actived, disabled, customItem},
            index,
          ) =>
            customItem ? (
              <Fragment key={index.toString()}>{customItem}</Fragment>
            ) : (
              <Button
                key={title}
                variant="ghost"
                size="sm"
                iconOnly={!!Icon}
                className={cn(
                  actived && 'bg-ink-tint-strong',
                  compact && 'h-10 w-10 shrink-0 rounded-md sm:h-8 sm:w-8',
                  compact && actived && 'bg-accent/10 text-accent',
                )}
                aria-pressed={
                  typeof actived === 'boolean' ? actived : undefined
                }
                aria-label={`${title}${shortcut ? ` ${shortcut}` : ''}`}
                title={`${title} ${shortcut}`}
                role={compact ? undefined : 'menuitem'}
                onClick={action}
                disabled={disabled}
              >
                {Icon || title}
              </Button>
            ),
        )}
      </div>
      {compact && (overflow.left || overflow.right) && (
        <span
          className="text-ink-muted pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 sm:hidden"
          aria-hidden="true"
        >
          {overflow.right ? (
            <IconChevronRight size={10} />
          ) : (
            <IconChevronLeft size={10} />
          )}
        </span>
      )}
      {trailingActions}
    </div>
  )
}
