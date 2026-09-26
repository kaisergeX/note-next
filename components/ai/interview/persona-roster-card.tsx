'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'
import {setPersonaStatusAction} from '~/app/[locale]/ai/interview/actions'
import type {PersonaStatus} from '~/db/schema/personas'
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
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState(false)

  const handleStatusChange = (
    nextStatus: PersonaStatus,
    confirmMessage?: string,
  ) => {
    if (confirmMessage && !confirm(confirmMessage)) return
    setActionError(false)
    startTransition(async () => {
      const result = await setPersonaStatusAction(persona.id, nextStatus)
      if (result.ok) router.refresh()
      else setActionError(true)
    })
  }

  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex-center-between">
        <h3 className="font-semibold wrap-anywhere">{persona.name}</h3>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[persona.status]}`}
        >
          {t(`status.${persona.status}`)}
        </span>
      </div>

      <p className="text-muted-foreground text-sm">
        {[persona.age, persona.gender, persona.region, persona.occupation].join(
          ' · ',
        )}
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

      <div className="mt-auto flex gap-2 pt-2">
        <Link
          href={`/ai/interview/${persona.id}`}
          className="button-secondary flex-1 text-center text-sm"
        >
          {t('roster.edit')}
        </Link>
        {persona.status === 'draft' && (
          <button
            type="button"
            className="button-secondary flex-1 text-sm"
            disabled={isPending}
            onClick={() => handleStatusChange('active')}
          >
            {t('roster.activate')}
          </button>
        )}
        {persona.status === 'active' && (
          <button
            type="button"
            className="button-secondary text-danger flex-1 text-sm"
            disabled={isPending}
            onClick={() =>
              handleStatusChange('archived', t('roster.confirmArchive'))
            }
          >
            {t('roster.archive')}
          </button>
        )}
      </div>
    </div>
  )
}
