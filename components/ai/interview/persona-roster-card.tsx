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
import Button from '~/components/ui/button'
import {Badge} from '~/components/ui/badge'
import LinkButton from '~/components/ui/link-button'
import MenuCustom, {type MenuCustomItem} from '~/components/ui/menu'
import type {PersonaFormInitial} from './persona-form'

type PersonaRosterCardProps = {
  persona: PersonaFormInitial
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
            type: 'action' as const,
            label: t('roster.activate'),
            disabled: isPending,
            onSelect: () => handleStatusChange('active'),
          },
        ]
      : []),
    ...(persona.status === 'active'
      ? [
          {
            type: 'action' as const,
            label: (
              <>
                <IconArchive size="18" /> {t('roster.archive')}
              </>
            ),
            destructive: true,
            disabled: isPending,
            onSelect: openArchiveConfirm,
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
    <div className="border-hairline bg-paper-raised text-ink flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex-center-between gap-2">
        <Link
          href={`/ai/interview/${persona.id}`}
          className="font-semibold wrap-anywhere hover:underline"
        >
          {persona.name}
        </Link>
        <div className="flex items-center gap-2">
          <Badge status={persona.status}>{t(`status.${persona.status}`)}</Badge>
          <MenuCustom
            className="border-hairline bg-paper-raised text-ink hover:bg-raised-hover rounded-full border"
            itemsClassName="w-44"
            items={menuItems}
          >
            <span className="sr-only">{t('roster.menu')}</span>
            <IconDotsVertical size="18" />
          </MenuCustom>
        </div>
      </div>

      <p className="text-ink-muted text-sm">
        {[persona.age, genderLabel, persona.region, persona.occupation]
          .filter((part) => part !== undefined && part !== '')
          .join(' · ')}
      </p>

      {persona.backgroundTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {persona.backgroundTags.map((tag) => (
            <span
              key={tag}
              className="border-hairline bg-paper text-ink rounded-full border px-2 py-0.5 text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {persona.quirksFreetext && (
        <p className="text-ink-muted truncate text-sm">
          {persona.quirksFreetext}
        </p>
      )}

      {actionError && (
        <p className="text-destructive text-xs" role="alert">
          {t('roster.archiveFailed')}
        </p>
      )}

      {persona.systemPrompt && persona.status !== 'draft' && (
        <div className="mt-auto pt-2">
          <LinkButton
            href={`/ai/interview/${persona.id}/chat`}
            className="flex-1 text-center"
            size="sm"
          >
            <IconMessages size="18" /> {t('chat.openChat')}
          </LinkButton>
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
          <Button
            type="button"
            variant="secondary"
            onClick={closeArchiveConfirm}
          >
            {t('chat.cancel')}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={isPending}
            onClick={() => {
              closeArchiveConfirm()
              handleStatusChange('archived')
            }}
          >
            <IconArchive size="16" /> {t('roster.archive')}
          </Button>
        </Dialog.Footer>
      </Dialog>
    </div>
  )
}
