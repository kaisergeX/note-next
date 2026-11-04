import {Dialog} from '@kaiverse/k/ui'
import {cn} from 'cn'
import {IconArrowLeft, IconMaximize} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {useEffect, useLayoutEffect, useRef} from 'react'
import {Link} from '~/i18n/navigation'
import {usePersistStore} from '~/store'
import Button, {buttonClass} from '~/components/ui/button'
import NoteCustomize, {type NoteCustomizeProps} from './note-customize'
import NoteWriting from './note-writing'
import NoteWorkspace, {type WorkspaceView} from './note-workspace'
import {useSearchParams} from 'next/navigation'
import {withBrowserWorkReturn} from '~/lib/notes/navigation'

type NoteDialogProps = {
  type?: NoteCustomizeProps['type']
  loading?: boolean
  error?: string
  open?: boolean
  onClose: () => void
  onMoveToTrash?: () => unknown
}

export default function NoteDialog(props: NoteDialogProps) {
  return (
    <NoteWorkspace>
      {(workspace) => <NoteDialogSurface {...props} workspace={workspace} />}
    </NoteWorkspace>
  )
}

function NoteDialogSurface({
  type = 'update',
  loading,
  error,
  open = false,
  onClose,
  onMoveToTrash,
  workspace,
}: NoteDialogProps & {workspace: WorkspaceView}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const search = useSearchParams()
  const fromBrowserWork = search.get('from') === 'browser-work'
  const version = search.get('version')
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    // Cached routes disconnect effects without removing their DOM. Close before
    // the browser drops the top layer so the dialog can become modal again.
    return () => dialog?.close()
  }, [])
  const mutateNoteData = usePersistStore((s) => s.mutateNoteData)
  const sessionIdentity = usePersistStore((s) => s.noteSession?.identity)
  const unavailable = usePersistStore(
    (s) => s.noteSession?.syncStatus === 'unavailable',
  )
  const noteTheme = mutateNoteData?.theme
  const t = useTranslations('note')
  const {panel, editors, actions, busy} = workspace
  const focusId = panel?.titleId
  const previousPanel = useRef(false)
  useEffect(() => {
    if (!open) return
    if (focusId) document.getElementById(focusId)?.focus()
    else if (previousPanel.current)
      dialogRef.current
        ?.querySelector<HTMLElement>(
          '[data-editor-toolbar] button:not(:disabled)',
        )
        ?.focus()
    previousPanel.current = Boolean(focusId)
  }, [open, focusId])

  return (
    <Dialog
      ref={dialogRef}
      className={cn(
        'backdrop:bg-paper/50 backdrop:backdrop-blur',
        panel
          ? cn(
              'bg-paper-raised text-ink border-hairline shadow-sheet m-auto h-dvh max-h-dvh w-dvw max-w-none flex-col overflow-hidden rounded-none border-0 p-0 open:flex sm:rounded-lg sm:border',
              panel.kind === 'versions'
                ? 'sm:h-5/6 sm:w-11/12 sm:max-w-6xl'
                : 'sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100dvw-2rem)]',
            )
          : cn(
              'min-h-80 flex-col rounded-lg open:flex max-sm:h-dvh max-sm:rounded-none sm:max-h-[calc(100dvh-2rem)]',
              'w-dvw sm:w-3/4 sm:max-w-(--breakpoint-md) md:w-2/3 2xl:max-w-(--breakpoint-xl)',
              noteTheme
                ? `dialog-${noteTheme} shadow-xl max-sm:shadow-none shadow-theme-${noteTheme}`
                : 'bg-paper-raised shadow-sheet',
            ),
      )}
      open={open}
      preventClose
      onKeyDownCapture={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('dialog') !== event.currentTarget
        )
          return
        if (
          event.key === 'Escape' &&
          !event.currentTarget.querySelector(':popover-open')
        ) {
          event.preventDefault()
          if (!busy && !loading) (panel?.onClose ?? onClose)()
        }
      }}
      onMouseDown={(event) => {
        if (!panel && event.target === event.currentTarget && !loading && !busy)
          onClose()
      }}
      aria-busy={busy}
      aria-labelledby={panel?.titleId}
      aria-describedby={panel?.descriptionId}
      aria-label={
        panel
          ? undefined
          : t(type === 'create' ? 'editor.newNote' : 'editor.editNote')
      }
    >
      {panel?.content ?? (
        <>
          <NoteWriting
            key={sessionIdentity}
            id={`dialog-note-${sessionIdentity}`}
            editors={editors}
            pending={loading || busy}
            leadingActions={
              <Button
                variant="ghost"
                iconOnly
                onClick={onClose}
                disabled={loading || busy}
                aria-label={t('editor.close')}
              >
                <IconArrowLeft />
              </Button>
            }
            viewAction={
              mutateNoteData?.id && !unavailable ? (
                <Link
                  href={withBrowserWorkReturn(
                    `/full/eton/${mutateNoteData.id}${version ? `?version=${encodeURIComponent(version)}` : ''}`,
                    fromBrowserWork,
                  )}
                  className={cn(
                    buttonClass({variant: 'ghost', iconOnly: true}),
                    'max-sm:hidden',
                  )}
                  aria-label={t('editor.fullPage')}
                  aria-disabled={loading || busy}
                  onClick={(event) => {
                    if (loading || busy) event.preventDefault()
                  }}
                  replace
                >
                  <IconMaximize />
                </Link>
              ) : null
            }
          />

          {error && (
            <p role="alert" className="text-destructive px-4">
              {error}
            </p>
          )}

          <NoteCustomize
            syncActions={actions}
            className="shadow-sheet"
            type={type}
            error={!!error}
            onMoveToTrash={onMoveToTrash}
            loading={loading}
            scrollTopCtrl
          />
        </>
      )}
    </Dialog>
  )
}
