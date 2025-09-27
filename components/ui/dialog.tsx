import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from '@headlessui/react'
import {classNames} from '@kaiverse/k/utils'
import {IconX} from '@tabler/icons-react'
import {Fragment, useRef, type PropsWithChildren, type ReactNode} from 'react'
import type {NoteTheme} from '~/db/schema/notes'

type DialogProps = {
  theme?: NoteTheme | null
  className?: string
  backdropClassName?: string
  headerClassName?: string

  header?: ReactNode
  loading?: boolean
  open: boolean
  onClose: () => void
  closeButton?: ReactNode

  disableAnimation?: 'open' | 'close' | true
  hideCloseButton?: boolean
  fullScreen?: boolean
}

export default function DialogCustom({
  theme,
  className = '',
  backdropClassName = '',
  headerClassName = '',

  header,
  loading,
  open,
  onClose,
  closeButton,

  disableAnimation,
  hideCloseButton,
  fullScreen,
  children,
}: PropsWithChildren<DialogProps>) {
  const dialogRef = useRef<HTMLElement>(null)
  const isDialogScrollable = dialogRef.current
    ? dialogRef.current.scrollHeight > dialogRef.current.clientHeight
    : false

  const dialogEnterAnimation =
    disableAnimation && disableAnimation !== 'close'
      ? 'transition-none'
      : 'ease-out duration-300'

  const dialogLeaveAnimation =
    disableAnimation && disableAnimation !== 'open'
      ? 'transition-none'
      : 'ease-in duration-200'

  const renderCloseButton = hideCloseButton ? (
    <></>
  ) : (
    closeButton || (
      <button className="ml-auto h-fit" type="button" onClick={onClose}>
        {<IconX />}
      </button>
    )
  )

  const renderLoadingPanel = (
    <div className="flex h-full flex-col gap-4 sm:h-80">
      <div className={classNames('flex gap-4', headerClassName)}>
        <div className="h-6 flex-1 animate-pulse rounded-sm bg-zinc-200 dark:bg-zinc-800" />
        {renderCloseButton}
      </div>

      <div className="w-full flex-1 animate-pulse rounded-sm bg-zinc-200 dark:bg-zinc-800" />
    </div>
  )

  return (
    <Transition show={open}>
      <Dialog
        onClose={onClose}
        className="max-sm:prevent-body-scroll relative z-30"
      >
        {/* The backdrop, rendered as a fixed sibling to the panel container */}
        <TransitionChild
          as={Fragment}
          enter={dialogEnterAnimation}
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave={dialogLeaveAnimation}
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className={classNames(
              'glass fixed inset-0 backdrop-blur',
              backdropClassName,
            )}
            aria-hidden="true"
          />
        </TransitionChild>

        {/* Full-screen scrollable container */}
        <div className="fixed inset-0">
          {/* Container to center the panel */}
          <div
            className={classNames(
              'flex-center h-full',
              fullScreen ? '' : 'sm:p-4',
            )}
          >
            {/* The actual dialog panel  */}
            <TransitionChild
              as={Fragment}
              enter={dialogEnterAnimation}
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave={dialogLeaveAnimation}
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel
                ref={dialogRef}
                className={classNames(
                  `ring-theme overflow-y-auto shadow-xl max-sm:h-dvh max-sm:w-[100dvw] sm:min-w-lg sm:rounded-lg`,
                  fullScreen
                    ? 'h-dvh w-dvw'
                    : 'min-h-80 sm:max-h-full sm:w-1/2 sm:max-w-(--breakpoint-sm) 2xl:max-w-(--breakpoint-lg)',
                  theme ? `dialog-${theme}` : 'bg-zinc-50 dark:bg-zinc-900',
                  className,
                )}
              >
                {loading ? (
                  renderLoadingPanel
                ) : (
                  <>
                    <div
                      className={classNames(
                        'sticky top-0 z-40 flex gap-4 bg-inherit *:wrap-anywhere',
                        isDialogScrollable
                          ? 'animate-scroll-shadow shadow-zinc-600/10 transition-shadow [animation-range-end:8rem] dark:shadow-zinc-400/10'
                          : '',
                        headerClassName,
                      )}
                    >
                      {renderCloseButton}
                      {header}
                    </div>

                    {children}
                  </>
                )}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
