'use client'

import {useDisclosure} from '@kaiverse/k/hooks'
import {Dialog} from '@kaiverse/k/ui'
import {
  IconArchive,
  IconDotsVertical,
  IconEdit,
  IconMessages,
} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useState, useTransition} from 'react'
import {setPersonaStatusAction} from '~/app/[locale]/ai/interview/actions'
import type {PersonaStatus} from '~/db/schema/personas'
import MenuCustom, {type MenuCustomItem} from '~/components/ui/menu'
import type {PersonaFormInitial} from './persona-form'

type PersonaRosterCardProps = {
  persona: PersonaFormInitial
}

const STATUS_BADGE_CLASS: Record<PersonaStatus, string> = {
  draft: 'border-amber-500 text-amber-600 dark:text-amber-400',
  active: 'border-green-600 text-green-600 dark:text-green-400',
  archived: 'border-zinc-400 text-zinc-500',
}

export default function PersonaRosterCard({persona}: PersonaRosterCardProps) {
  const t = useTranslations('ai.interview')
  const tGender = useTranslations('ai.interview.form.options.gender')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState(false)
  const [
    confirmArchiveOpen,
    {open: openArchiveConfirm, close: closeArchiveConfirm},
  ] = useDisclosure()

  const handleStatusChange = (nextStatus: PersonaStatus) => {
    setActionError(false)
    startTransition(async () => {
      const result = await setPersonaStatusAction(persona.id, nextStatus)
      if (result.ok) router.refresh()
      else setActionError(true)
    })
  }

  const menuItems: MenuCustomItem[] = [
    {
      type: 'link',
      url: `/ai/interview/${persona.id}/edit`,
      label: (
        <>
          <IconEdit size="18" /> {t('roster.edit')}
        </>
      ),
    },
    ...(persona.status === 'draft'
      ? [
          {
            component: (
              <button
                type="button"
                className="hover:bg-reverse data-active:bg-reverse data-disabled:disabled flex w-full items-center gap-2 p-4 text-left transition-colors"
                disabled={isPending}
                onClick={() => handleStatusChange('active')}
              >
                {t('roster.activate')}
              </button>
            ),
          },
        ]
      : []),
    ...(persona.status === 'active'
      ? [
          {
            component: (
              <button
                type="button"
                className="text-danger hover:bg-reverse data-active:bg-reverse data-disabled:disabled flex w-full items-center gap-2 p-4 text-left transition-colors"
                disabled={isPending}
                onClick={openArchiveConfirm}
              >
                <IconArchive size="18" /> {t('roster.archive')}
              </button>
            ),
          },
        ]
      : []),
  ]

  // Canonical EN keys (`male`/`female`) get localized labels; custom/legacy
  // values fall back verbatim.
  const gender = persona.gender
  const genderLabel =
    gender === 'male' || gender === 'female' ? tGender(gender) : gender

  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex-center-between gap-2">
        <Link
          href={`/ai/interview/${persona.id}`}
          className="font-semibold wrap-anywhere hover:underline"
        >
          {persona.name}
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[persona.status]}`}
          >
            {t(`status.${persona.status}`)}
          </span>
          <MenuCustom
            className="button-secondary button-icon rounded-full p-1"
            itemsClassName="w-44 [--anchor-gap:0.5rem]"
            items={menuItems}
          >
            <span className="sr-only">{t('roster.menu')}</span>
            <IconDotsVertical size="18" />
          </MenuCustom>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        {[persona.age, genderLabel, persona.region, persona.occupation]
          .filter((part) => part !== undefined && part !== '')
          .join(' · ')}
      </p>

      {persona.backgroundTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {persona.backgroundTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {persona.quirksFreetext && (
        <p className="text-muted-foreground truncate text-sm">
          {persona.quirksFreetext}
        </p>
      )}

      {actionError && (
        <p className="text-danger text-xs">{t('roster.archiveFailed')}</p>
      )}

      {persona.systemPrompt && (
        <div className="mt-auto pt-2">
          <Link
            href={`/ai/interview/${persona.id}/chat`}
            className="button-secondary flex-1 text-center text-sm"
          >
            <IconMessages size="18" /> {t('chat.openChat')}
          </Link>
        </div>
      )}

      <Dialog
        className="max-w-lg"
        open={confirmArchiveOpen}
        onClose={closeArchiveConfirm}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Dialog.Header>
          <Dialog.Title>{t('roster.confirmArchive')}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Content>{t('roster.confirmArchiveBody')}</Dialog.Content>
        <Dialog.Footer className="justify-end">
          <button
            type="button"
            className="button-secondary"
            onClick={closeArchiveConfirm}
          >
            {t('chat.cancel')}
          </button>
          <button
            type="button"
            className="button-danger"
            disabled={isPending}
            onClick={() => {
              closeArchiveConfirm()
              handleStatusChange('archived')
            }}
          >
            <IconArchive size="16" /> {t('roster.archive')}
          </button>
        </Dialog.Footer>
      </Dialog>
    </div>
  )
}
