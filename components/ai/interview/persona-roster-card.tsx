'use client'

import {
  IconArchive,
  IconDotsVertical,
  IconEdit,
  IconMessages,
} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useRef, useState, useTransition} from 'react'
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

const MENU_ITEM_CLASS =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800'

export default function PersonaRosterCard({persona}: PersonaRosterCardProps) {
  const t = useTranslations('ai.interview')
  const tGender = useTranslations('ai.interview.form.options.gender')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click and Escape while the menu is open.
  useEffect(() => {
    if (!menuOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

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

  const closeMenuAnd = (action: () => void) => {
    setMenuOpen(false)
    action()
  }

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
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[persona.status]}`}
          >
            {t(`status.${persona.status}`)}
          </span>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="button-secondary px-1.5 py-1"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t('roster.menu')}
              onClick={() => setMenuOpen((open) => !open)}
              disabled={isPending}
            >
              <IconDotsVertical size="18" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="bg-default absolute top-full right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-zinc-200 py-1 shadow-lg dark:border-zinc-700"
              >
                <Link
                  role="menuitem"
                  href={`/ai/interview/${persona.id}/edit`}
                  className={MENU_ITEM_CLASS}
                  onClick={() => setMenuOpen(false)}
                >
                  <IconEdit size="16" /> {t('roster.edit')}
                </Link>
                {persona.status === 'draft' && (
                  <button
                    type="button"
                    role="menuitem"
                    className={MENU_ITEM_CLASS}
                    disabled={isPending}
                    onClick={() =>
                      closeMenuAnd(() => handleStatusChange('active'))
                    }
                  >
                    {t('roster.activate')}
                  </button>
                )}
                {persona.status === 'active' && (
                  <button
                    type="button"
                    role="menuitem"
                    className={`${MENU_ITEM_CLASS} text-danger`}
                    disabled={isPending}
                    onClick={() =>
                      closeMenuAnd(() =>
                        handleStatusChange(
                          'archived',
                          t('roster.confirmArchive'),
                        ),
                      )
                    }
                  >
                    <IconArchive size="16" /> {t('roster.archive')}
                  </button>
                )}
              </div>
            )}
          </div>
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
    </div>
  )
}
