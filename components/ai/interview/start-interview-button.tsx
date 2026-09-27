'use client'

import {IconLoader2, IconMessages} from '@tabler/icons-react'
import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'
import {startInterviewAction} from '~/app/[locale]/ai/interview/actions'

type StartInterviewButtonProps = {
  personaId: string
}

export default function StartInterviewButton({
  personaId,
}: StartInterviewButtonProps) {
  const t = useTranslations('ai.interview')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [noAccess, setNoAccess] = useState(false)
  const [hasError, setHasError] = useState(false)

  const handleStart = () => {
    setNoAccess(false)
    setHasError(false)
    startTransition(async () => {
      const result = await startInterviewAction(personaId)
      if (result.ok) {
        router.push(
          `/ai/interview/${personaId}/chat?t=${result.data.transcriptId}`,
        )
        return
      }
      if (result.reason === 'no-access') setNoAccess(true)
      else setHasError(true)
    })
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="button text-sm"
        onClick={handleStart}
        disabled={isPending}
      >
        {isPending ? (
          <IconLoader2 className="animate-spin" size="1.2rem" />
        ) : (
          <IconMessages size="1.2rem" />
        )}
        {isPending ? t('chat.starting') : t('chat.startNew')}
      </button>
      {noAccess && (
        <p className="text-danger text-sm">{t('form.noAccessError')}</p>
      )}
      {hasError && (
        <p role="alert" className="text-danger text-sm">
          {t('chat.genericError')}
        </p>
      )}
    </div>
  )
}
