'use client'

import {cn} from 'cn'
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBold,
  IconItalic,
  IconUnderline,
  IconHighlight,
  IconChevronDown,
  IconTypography,
  IconList,
  IconListNumbers,
  IconBlockquote,
  IconCode,
  IconStrikethrough,
  IconClearFormatting,
  IconClearAll,
  IconSeparator,
  IconDots,
} from '@tabler/icons-react'
import {useEditorState, type Editor} from '@tiptap/react'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'
import Button, {buttonClass} from './button'
import PopoverBase from './popover'

type Props = {
  editor: Editor | null
  disabled?: boolean
  target?: string
  leadingActions?: ReactNode
  viewAction?: ReactNode
  layout?: 'dialog' | 'document'
  docked?: boolean
}

type Tool = {
  label: string
  icon: ReactNode
  active?: boolean
  action: () => unknown
}
function ToolButton({
  label,
  icon,
  active,
  action,
  disabled,
  expanded = false,
}: Tool & {disabled?: boolean; expanded?: boolean}) {
  return (
    <Button
      variant="ghost"
      iconOnly={!expanded}
      disabled={disabled}
      className={cn(
        'shrink-0 rounded-md',
        expanded &&
          'h-auto min-h-10 justify-start px-2 py-2 text-xs whitespace-normal',
        active && 'bg-accent/10 text-accent',
      )}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >
      {icon}
      {expanded && <span className="text-left">{label}</span>}
    </Button>
  )
}

export default function RTECommands({
  editor,
  disabled,
  target,
  leadingActions,
  viewAction,
  layout = 'dialog',
  docked = false,
}: Props) {
  const t = useTranslations('note.editor.tools')
  useEditorState({
    editor,
    selector: ({editor}) =>
      editor
        ? {
            selection:
              editor.state.selection.from + ':' + editor.state.selection.to,
            marks: editor.state.storedMarks?.map((mark) => mark.type.name),
            active: [
              'bold',
              'italic',
              'underline',
              'highlight',
              'strike',
              'code',
              'paragraph',
              'heading',
              'bulletList',
              'orderedList',
              'blockquote',
              'codeBlock',
            ].map((name) => editor.isActive(name)),
            heading: editor.getAttributes('heading').level,
            undo: editor.can().undo(),
            redo: editor.can().redo(),
          }
        : null,
  })
  // Session pending state owns read-only behavior. Child editor options update
  // in an effect; reading isEditable here can stay stale after a failed save
  // until another transaction, leaving the toolbar incorrectly disabled.
  const blocked = disabled || !editor
  const emphasis: Tool[] = [
    {
      label: t('bold'),
      icon: <IconBold size={20} />,
      active: editor?.isActive('bold'),
      action: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: t('italic'),
      icon: <IconItalic size={20} />,
      active: editor?.isActive('italic'),
      action: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: t('underline'),
      icon: <IconUnderline size={20} />,
      active: editor?.isActive('underline'),
      action: () => editor?.chain().focus().toggleUnderline().run(),
    },
    {
      label: t('highlight'),
      icon: <IconHighlight size={20} />,
      active: editor?.isActive('highlight'),
      action: () => editor?.chain().focus().toggleHighlight().run(),
    },
  ]
  const blocks: Tool[] = [
    {
      label: t('bulletList'),
      icon: <IconList size={20} />,
      active: editor?.isActive('bulletList'),
      action: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: t('orderedList'),
      icon: <IconListNumbers size={20} />,
      active: editor?.isActive('orderedList'),
      action: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: t('quote'),
      icon: <IconBlockquote size={20} />,
      active: editor?.isActive('blockquote'),
      action: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      label: t('codeBlock'),
      icon: <IconCode size={20} />,
      active: editor?.isActive('codeBlock'),
      action: () => editor?.chain().focus().toggleCodeBlock().run(),
    },
  ]
  const extra: Tool[] = [
    {
      label: t('strike'),
      icon: <IconStrikethrough size={20} />,
      active: editor?.isActive('strike'),
      action: () => editor?.chain().focus().toggleStrike().run(),
    },
    {
      label: t('inlineCode'),
      icon: <IconCode size={20} />,
      active: editor?.isActive('code'),
      action: () => editor?.chain().focus().toggleCode().run(),
    },
    {
      label: t('rule'),
      icon: <IconSeparator size={20} />,
      action: () => editor?.chain().focus().setHorizontalRule().run(),
    },
  ]
  const styles = (
    <div className="grid grid-cols-3 gap-1">
      <Button
        variant="ghost"
        className={cn(
          'col-span-3 justify-start',
          editor?.isActive('paragraph') && 'bg-accent/10 text-accent',
        )}
        aria-pressed={editor?.isActive('paragraph') ?? false}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor?.chain().focus().setParagraph().run()}
      >
        {t('paragraph')}
      </Button>
      {([1, 2, 3, 4, 5, 6] as const).map((level) => (
        <Button
          key={level}
          variant="ghost"
          aria-label={t('heading', {level})}
          aria-pressed={editor?.isActive('heading', {level}) ?? false}
          className={cn(
            'font-semibold',
            editor?.isActive('heading', {level}) && 'bg-accent/10 text-accent',
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().focus().toggleHeading({level}).run()}
        >
          H{level}
        </Button>
      ))}
    </div>
  )
  const popoverClass =
    'bg-paper-raised text-ink border-hairline shadow-sheet w-72 max-w-full rounded-lg border p-2 font-sans'
  const groupClass =
    'border-hairline flex shrink-0 items-center lg:ml-1 lg:border-l lg:pl-1'
  return (
    <div
      className={cn(
        'bg-paper/50 text-ink border-hairline @container/note-toolbar sticky top-0 z-30 flex shrink-0 flex-wrap items-center gap-0 py-2 font-sans backdrop-blur-sm',
        layout === 'document'
          ? '-mx-4 mb-4 px-4 transition-[box-shadow,border-radius] duration-200 ease-out motion-reduce:transition-none'
          : 'border-b px-0 max-sm:grid max-sm:grid-cols-[1fr_auto] sm:px-2 lg:px-3',
        layout === 'document' &&
          (docked ? 'shadow-sheet rounded-b-xl' : 'sm:rounded-t-xl'),
      )}
      role="group"
      aria-label={t('label', {target: target || ''})}
      data-editor-toolbar="fixed"
    >
      {leadingActions}
      <div
        className={
          layout === 'dialog'
            ? 'contents max-sm:col-span-2 max-sm:row-start-2 max-sm:flex max-sm:items-center'
            : 'contents'
        }
      >
        <div className="hidden shrink-0 lg:block">
          <PopoverBase
            trigger={
              <>
                <span className="text-sm font-semibold">
                  {editor?.isActive('heading') ? (
                    `H${editor.getAttributes('heading').level}`
                  ) : (
                    <IconTypography size={20} />
                  )}
                </span>
                <IconChevronDown size={12} />
              </>
            }
            triggerAriaLabel={t('textStyle')}
            triggerClassName={buttonClass({variant: 'ghost'})}
            disabled={blocked}
            anchor="bottom-start"
            keyboardNavigation
            className={popoverClass}
          >
            <p className="text-ink-muted px-2 pt-1 pb-2 text-xs font-medium">
              {t('textStyle')}
            </p>
            {styles}
          </PopoverBase>
        </div>
        <div className={groupClass} role="group" aria-label={t('emphasis')}>
          {emphasis.map((tool) => (
            <ToolButton key={tool.label} {...tool} disabled={blocked} />
          ))}
        </div>
        <div
          className={cn(groupClass, 'hidden lg:flex')}
          role="group"
          aria-label={t('blocks')}
        >
          {blocks.map((tool) => (
            <ToolButton key={tool.label} {...tool} disabled={blocked} />
          ))}
        </div>
        <div
          className={cn(groupClass, 'hidden @5xl/note-toolbar:flex')}
          role="group"
          aria-label={t('more')}
        >
          {extra.map((tool) => (
            <ToolButton key={tool.label} {...tool} disabled={blocked} />
          ))}
          <ToolButton
            label={t('clearMarks')}
            icon={<IconClearFormatting size={20} />}
            disabled={blocked}
            action={() => editor?.chain().focus().unsetAllMarks().run()}
          />
          <ToolButton
            label={t('clearBlocks')}
            icon={<IconClearAll size={20} />}
            disabled={blocked}
            action={() => editor?.chain().focus().clearNodes().run()}
          />
        </div>
        <div className={groupClass} role="group" aria-label={t('history')}>
          <ToolButton
            label={t('undo')}
            icon={<IconArrowBackUp size={20} />}
            disabled={blocked || !editor?.can().undo()}
            action={() => editor?.chain().focus().undo().run()}
          />
          <ToolButton
            label={t('redo')}
            icon={<IconArrowForwardUp size={20} />}
            disabled={blocked || !editor?.can().redo()}
            action={() => editor?.chain().focus().redo().run()}
          />
        </div>
        <PopoverBase
          trigger={<IconDots size={20} />}
          triggerAriaLabel={t('format')}
          triggerClassName={cn(
            buttonClass({variant: 'ghost', iconOnly: true}),
            'shrink-0 rounded-md @5xl/note-toolbar:hidden',
          )}
          disabled={blocked}
          anchor="bottom-end"
          keyboardNavigation
          className={popoverClass}
        >
          <section
            className="border-hairline mb-2 border-b pb-2 lg:hidden"
            aria-label={t('textStyle')}
          >
            <p className="text-ink-muted px-2 pt-1 pb-2 text-xs font-medium">
              {t('textStyle')}
            </p>
            {styles}
          </section>
          <section
            className="border-hairline mb-2 border-b pb-2 lg:hidden"
            aria-label={t('blocks')}
          >
            <p className="text-ink-muted px-2 pb-2 text-xs font-medium">
              {t('blocks')}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {blocks.map((tool) => (
                <ToolButton
                  key={tool.label}
                  {...tool}
                  expanded
                  disabled={blocked}
                />
              ))}
            </div>
          </section>
          <section aria-label={t('more')}>
            <p className="text-ink-muted px-2 pt-1 pb-2 text-xs font-medium">
              {t('more')}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {extra.map((tool) => (
                <ToolButton
                  key={tool.label}
                  {...tool}
                  expanded
                  disabled={blocked}
                />
              ))}
            </div>
          </section>
          <div className="border-hairline mt-2 grid grid-cols-2 gap-1 border-t pt-2">
            <ToolButton
              label={t('clearMarks')}
              icon={<IconClearFormatting size={20} />}
              expanded
              disabled={blocked}
              action={() => editor?.chain().focus().unsetAllMarks().run()}
            />
            <ToolButton
              label={t('clearBlocks')}
              icon={<IconClearAll size={20} />}
              expanded
              disabled={blocked}
              action={() => editor?.chain().focus().clearNodes().run()}
            />
          </div>
        </PopoverBase>
      </div>
      {viewAction && (
        <div
          className={cn(
            'ml-auto flex shrink-0',
            layout === 'dialog' && 'max-sm:col-start-2 max-sm:row-start-1',
          )}
        >
          {viewAction}
        </div>
      )}
    </div>
  )
}
