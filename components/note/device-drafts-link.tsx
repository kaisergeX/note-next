'use client'

import {IconCircleX, IconFiles} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {Link} from '~/i18n/navigation'
import {useRecoveryDrafts} from '~/lib/notes/use-recovery-drafts'
import {buttonClass} from '~/components/ui/button'
import {cn} from 'cn'

export default function DeviceDraftsLink({ownerId}: {ownerId: string}) {
  const t = useTranslations('note.recovery')
  const {groups, error, loaded} = useRecoveryDrafts(ownerId)
  return (
    <Link
      href="/eton#browser-work"
      className={cn(
        buttonClass({variant: 'ghost', size: 'sm'}),
        'h-10 gap-1.5 px-2 font-normal',
        error && 'text-destructive',
      )}
    >
      {error ? (
        <IconCircleX size={18} aria-hidden />
      ) : (
        <IconFiles size={18} aria-hidden />
      )}
      <span>{t('draftsTitle')}</span>
      {loaded && groups.length > 0 && (
        <span className="text-ink-muted tabular-nums">· {groups.length}</span>
      )}
      {error && <span className="sr-only">{t('recoveryFailed')}</span>}
    </Link>
  )
}
