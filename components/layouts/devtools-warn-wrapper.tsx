'use client'

import {Dialog} from '@kaiverse/k/ui'
import type {PropsWithChildren, ReactNode} from 'react'
import {useDebounced, useDevtoolsDetect} from '~/util/hooks'

export default function DevtoolsWarnWrapper({
  message,
  children,
}: PropsWithChildren<{message: ReactNode}>) {
  const isOpen = useDevtoolsDetect()
  const [isDevtoolsOpen] = useDebounced(isOpen, 300)

  if (isDevtoolsOpen) {
    return (
      <Dialog
        open
        className="bg-theme z-[9999] h-dvh w-dvw rounded-none text-center select-none"
        role="presentation"
        preventClose
      >
        <Dialog.Content className="flex-center flex-col whitespace-pre-wrap">
          {message}
        </Dialog.Content>
      </Dialog>
    )
  }

  return children
}
