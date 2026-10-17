'use client'

import {useId, type KeyboardEvent} from 'react'
import {Input} from '~/components/ui/input'
import Button from '~/components/ui/button'

const MAX_TAGS = 20
const MAX_TAG_LENGTH = 100

type PersonaTagsProps = {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  label: string
  hint?: string
  addPlaceholder?: string
  disabled?: boolean
}

export default function PersonaTags({
  value,
  onChange,
  suggestions = [],
  label,
  hint,
  addPlaceholder,
  disabled,
}: PersonaTagsProps) {
  const id = useId()
  const listId = `${id}-suggestions`

  const commitTag = (raw: string) => {
    const tag = raw.trim().slice(0, MAX_TAG_LENGTH)
    if (!tag) return
    if (value.includes(tag) || value.length >= MAX_TAGS) return
    onChange([...value, tag])
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      const input = event.currentTarget
      commitTag(input.value)
      input.value = ''
    }
  }

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    if (input.value.trim()) {
      commitTag(input.value)
      input.value = ''
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {hint && <p className="text-ink-muted mb-2 text-xs">{hint}</p>}

      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="border-hairline bg-paper-raised text-ink inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs"
            >
              {tag}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${tag}`}
                disabled={disabled}
                onClick={() => removeTag(tag)}
                className="text-ink-muted h-6 w-6 p-0"
              >
                ×
              </Button>
            </span>
          ))}
        </div>
      )}

      <Input
        id={id}
        type="text"
        list={listId}
        placeholder={addPlaceholder}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      <datalist id={listId}>
        {suggestions
          .filter((suggestion) => !value.includes(suggestion))
          .map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
      </datalist>
    </div>
  )
}

export {MAX_TAGS, MAX_TAG_LENGTH}
export type {PersonaTagsProps}
