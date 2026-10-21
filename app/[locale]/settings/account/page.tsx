import {IconNoteOff, IconUserCircle, IconUserOff} from '@tabler/icons-react'
import Image from 'next/image'
import {getLocale, getTranslations} from 'next-intl/server'
import {Badge} from '~/components/ui/badge'
import Button from '~/components/ui/button'
import {requireAuth} from '~/server-utils'

export default async function AccountPage() {
  const locale = await getLocale()
  const {userInfo} = await requireAuth(`/${locale}/login`)
  const t = await getTranslations('user.settings')
  return (
    <section aria-labelledby="account-title" className="max-w-3xl">
      <h2 id="account-title">{t('account')}</h2>
      <p className="text-ink-muted mt-1 text-sm">{t('accountDescription')}</p>
      <div className="border-hairline mt-6 flex flex-wrap items-center gap-4 border-b pb-6">
        {userInfo.image ? (
          <Image
            className="border-hairline rounded-full border"
            src={userInfo.image}
            alt={t('avatar')}
            width={64}
            height={64}
          />
        ) : (
          <IconUserCircle className="text-ink-muted size-16" aria-hidden />
        )}
        <dl className="min-w-0 space-y-3 break-words">
          <div>
            <dt className="text-ink-muted text-xs">{t('name')}</dt>
            <dd className="mt-1 font-medium">{userInfo.name}</dd>
          </div>
          <div>
            <dt className="text-ink-muted text-xs">{t('email')}</dt>
            <dd className="mt-1 text-sm">{userInfo.email}</dd>
          </div>
        </dl>
        <Badge className="capitalize">{t(`roles.${userInfo.role}`)}</Badge>
      </div>
      <section aria-labelledby="account-actions-title" className="mt-8">
        <h3 id="account-actions-title" className="text-destructive">
          {t('accountActions')}
        </h3>
        <p className="text-ink-muted mt-2 text-sm">{t('actionsUnavailable')}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="danger" disabled>
            <IconNoteOff aria-hidden />
            {t('removeNotes')}
          </Button>
          <Button variant="danger" disabled>
            <IconUserOff aria-hidden />
            {t('deleteAccount')}
          </Button>
        </div>
      </section>
    </section>
  )
}
