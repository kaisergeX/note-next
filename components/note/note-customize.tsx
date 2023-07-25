'use client'

import {IconLoader2, IconCheck} from '@tabler/icons-react'
import {classNames} from '~/util'

type NoteCustomizeProps = {
  loading?: boolean
  className?: string
}

export default function NoteCustomize({
  className = '',
  loading,
}: NoteCustomizeProps) {
  return (
    <div
      className={classNames(
        'bg-default flex-center-between sticky inset-x-0 bottom-0 w-full gap-4 p-4 transition-all',
        className,
      )}
    >
      <div>Note customize menu</div>
      <div className="flex items-center gap-1 text-xs font-medium">
        {loading ? (
          <>
            <IconLoader2 className="animate-spin" size="1.2rem" /> Syncing
          </>
        ) : (
          <>
            <IconCheck className="text-green-600" size="1.2rem" /> Synced
          </>
        )}
      </div>
    </div>
  )
}
