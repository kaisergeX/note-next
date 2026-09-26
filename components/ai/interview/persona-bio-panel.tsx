'use client'

import {IconLoader2, IconSparkles} from '@tabler/icons-react'
import {useId} from 'react'

type PersonaBioPanelProps = {
  bio: string
  systemPrompt: string
  onBioChange: (bio: string) => void
  onSystemPromptChange: (systemPrompt: string) => void
  onDraft: () => void
  drafting: boolean
  offline: boolean
  error: boolean
  labels: {
    bio: string
    systemPrompt: string
    advanced: string
    draftBio: string
    regenerate: string
    drafting: string
    offlineError: string
    error: string
  }
}

export default function PersonaBioPanel({
  bio,
  systemPrompt,
  onBioChange,
  onSystemPromptChange,
  onDraft,
  drafting,
  offline,
  error,
  labels,
}: PersonaBioPanelProps) {
  const bioId = useId()
  const promptId = useId()

  const showDraftButton = !bio

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={bioId} className="mb-1 block text-sm font-medium">
          {labels.bio}
        </label>
        <textarea
          id={bioId}
          rows={4}
          value={bio}
          disabled={drafting}
          onChange={(e) => onBioChange(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <button
        type="button"
        className="button-secondary"
        onClick={onDraft}
        disabled={drafting}
      >
        {drafting ? (
          <IconLoader2 className="animate-spin" size="1rem" />
        ) : (
          <IconSparkles size="1rem" />
        )}
        {drafting
          ? labels.drafting
          : showDraftButton
            ? labels.draftBio
            : labels.regenerate}
      </button>

      {(offline || error) && (
        <p role="alert" className="text-danger text-sm">
          {offline ? labels.offlineError : labels.error}
        </p>
      )}

      <details>
        <summary className="cursor-pointer text-sm font-medium">
          {labels.advanced}
        </summary>
        <div className="mt-3">
          <label htmlFor={promptId} className="mb-1 block text-sm font-medium">
            {labels.systemPrompt}
          </label>
          <textarea
            id={promptId}
            rows={4}
            value={systemPrompt}
            disabled={drafting}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </details>
    </div>
  )
}
