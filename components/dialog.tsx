import {Dialog, Transition} from '@headlessui/react'
import {IconX} from '@tabler/icons-react'
import {
  Fragment,
  useRef,
  type PropsWithChildren,
  type ReactNode,
  useState,
} from 'react'
import {classNames} from '~/util'

type DialogProps = {
  className?: string
  backdropClassName?: string
  titleClassName?: string

  title?: ReactNode
  loading?: boolean
  open: boolean
  onClose: () => void
  closeIcon?: ReactNode

  disableAnimation?: 'open' | 'close' | true
  hideCloseIcon?: boolean
  fullScreen?: boolean
}

export default function DialogCustom({
  className = '',
  backdropClassName = '',

  title,
  loading,
  open,
  onClose,
  closeIcon,

  disableAnimation,
  hideCloseIcon,
  fullScreen,
  children,
}: PropsWithChildren<DialogProps>) {
  const inputRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  const dialogEnterAnimation =
    disableAnimation && disableAnimation !== 'close'
      ? 'transition-none'
      : 'ease-out duration-300'

  const dialogLeaveAnimation =
    disableAnimation && disableAnimation !== 'open'
      ? 'transition-none'
      : 'ease-in duration-200'

  const renderLoadingPanel = (
    <div className="flex h-full flex-col gap-4 sm:h-[20rem]">
      <div className="flex gap-4">
        <div className="h-6 flex-1 animate-pulse rounded-sm bg-zinc-200 dark:bg-zinc-800" />
        {!hideCloseIcon && (
          <button className="ml-auto h-fit" type="button" onClick={onClose}>
            {closeIcon || <IconX />}
          </button>
        )}
      </div>

      <div className="w-full flex-1 animate-pulse rounded-sm bg-zinc-200 dark:bg-zinc-800" />
    </div>
  )

  return (
    <Transition show={open} as={Fragment}>
      <Dialog
        onClose={onClose}
        className="sm-only:prevent-body-scroll relative z-50"
      >
        {/* The backdrop, rendered as a fixed sibling to the panel container */}
        <Transition.Child
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
        </Transition.Child>

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
            <Transition.Child
              as={Fragment}
              enter={dialogEnterAnimation}
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave={dialogLeaveAnimation}
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={classNames(
                  `ring-theme overflow-y-auto rounded-lg bg-zinc-50 shadow-xl sm-only:h-[100dvh] sm-only:w-[100dvw]
                    dark:bg-zinc-900 sm:min-w-[32rem] [&>div]:p-4`,
                  fullScreen
                    ? 'h-[100dvh] w-[100dvw]'
                    : 'min-h-[20rem] sm:max-h-full sm:w-1/2 sm:max-w-screen-sm 2xl:max-w-screen-lg',
                  className,
                )}
                onScroll={() => {
                  const stickyOffSetTop = inputRef.current?.offsetTop ?? 0
                  if (stickyOffSetTop <= 24) {
                    setScrolled(false)
                    return
                  }

                  if (!scrolled) {
                    setScrolled(true)
                  }
                }}
              >
                {loading ? (
                  renderLoadingPanel
                ) : (
                  <>
                    <div
                      ref={inputRef}
                      className={classNames(
                        'sticky top-0 flex gap-4 bg-inherit transition-shadow',
                        scrolled
                          ? 'shadow-[0_8px_5px_-5px] shadow-zinc-600/10 dark:shadow-zinc-400/10'
                          : '',
                      )}
                    >
                      {typeof title === 'string' ? (
                        <Dialog.Title>{title}</Dialog.Title>
                      ) : (
                        title
                      )}
                      {!hideCloseIcon && (
                        <button
                          className="ml-auto h-fit"
                          type="button"
                          onClick={onClose}
                        >
                          {closeIcon || <IconX />}
                        </button>
                      )}
                    </div>

                    {children}
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
