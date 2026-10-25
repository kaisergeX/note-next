import {IconUserCircle} from '@tabler/icons-react'
import Image from 'next/image'
import {getLocale, getMessages, getTranslations} from 'next-intl/server'
import {NextIntlClientProvider} from 'next-intl'
import {Badge} from '~/components/ui/badge'
import AccountActions from '~/components/settings/account-actions'
import {accountRepository} from '~/db/helper/account'
import {noteRepository} from '~/db/helper/notes'
import {requireAuth} from '~/server-utils'

export default async function AccountPage({
  searchParams,
}: PageProps<'/[locale]/settings/account'>) {
  const locale = await getLocale()
  const {userInfo, session} = await requireAuth(`/${locale}/login`)
  const t = await getTranslations('user.settings')
  const messages = await getMessages()
  const params = await searchParams
  const count = await accountRepository.activeNoteCount(userInfo.id)
  const trash = await noteRepository.getTrashSummary(userInfo.id)
  const serverNow = await noteRepository.getServerTime()
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
      <NextIntlClientProvider messages={{user: messages.user}}>
        <AccountActions
          ownerId={userInfo.id}
          email={userInfo.email}
          activeCount={count}
          trashCount={trash.count}
          nextTrashExpiry={trash.nextExpiry?.toISOString()}
          verifiedAt={session.accountDeleteVerifiedAt}
          serverNow={serverNow}
          returning={params.confirmDelete === '1'}
          verificationFailed={params.deleteVerification === 'failed'}
        />
      </NextIntlClientProvider>
    </section>
  )
}
