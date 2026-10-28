'use client'

import {IconDeviceDesktop, IconAlertTriangle} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {buttonClass} from '~/components/ui/button'
import PopoverBase from '~/components/ui/popover'

export default function RecoveryStatus({review = false}: {review?: boolean}) {
  const t = useTranslations('note.recovery')
  const Icon = review ? IconAlertTriangle : IconDeviceDesktop
  return (
    <PopoverBase
      trigger={<Icon size={18} aria-hidden />}
      triggerAriaLabel={t(review ? 'conflict' : 'browserOnly')}
      triggerClassName={buttonClass({variant: 'ghost', iconOnly: true})}
      className="border-hairline bg-paper-raised text-ink shadow-sheet max-w-64 rounded-lg border p-3 text-sm"
    >
      {t(review ? 'versionsHelp' : 'browserOnlyHelp')}
    </PopoverBase>
  )
}
