'use client'

import {useId, useRef, useState, type KeyboardEvent} from 'react'

export type PersonaComboboxOption = {value: string; label: string}

type PersonaComboboxProps = {
  value: string
  onChange: (value: string) => void
  options: PersonaComboboxOption[]
  /** Resolves the stored value to a display label; free-solo values fall back to the raw value. */
  labelFor?: (value: string) => string
  label: string
  hint?: string
  placeholder?: string
  disabled?: boolean
}

export default function PersonaCombobox({
  value,
  onChange,
  options,
  labelFor,
  label,
  hint,
  placeholder,
  disabled,
}: PersonaComboboxProps) {
  const id = useId()
  const listId = `${id}-listbox`
  const inputRef = useRef<HTMLInputElement>(null)
  // Committed value when the input gained focus: Escape restores this instead
  // of the raw text typed so far (typing already commits via onChange).
  const focusValueRef = useRef(value)
  const [open, setOpen] = useState(false)
  // Non-null while the user is mid-typing: the input then shows raw text
  // instead of the resolved label of the current value.
  const [draft, setDraft] = useState<string | null>(null)
  const [highlight, setHighlight] = useState(0)

  const display = draft ?? labelFor?.(value) ?? value
  const query = draft?.trim().toLowerCase()
  const matches =
    draft === null || !query
      ? options
      : options.filter(
          (option) =>
            option.label.toLowerCase().includes(query) ||
            option.value.toLowerCase().includes(query),
        )
  const activeIndex =
    matches.length > 0 ? Math.min(highlight, matches.length - 1) : -1

  const close = () => {
    // Restore the resolved label for the current value.
    setDraft(null)
    setOpen(false)
  }

  const select = (option: PersonaComboboxOption) => {
    setDraft(null)
    setHighlight(0)
    setOpen(false)
    onChange(option.value)
    inputRef.current?.blur()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onChange(focusValueRef.current)
      close()
      return
    }
    if (event.key === 'Enter') {
      // Keep Enter from submitting the surrounding form.
      event.preventDefault()
      const active = matches[activeIndex]
      if (open && active) select(active)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open || matches.length === 0) {
        setOpen(true)
        return
      }
      setHighlight((prev) =>
        event.key === 'ArrowDown'
          ? Math.min(prev + 1, matches.length - 1)
          : Math.max(prev - 1, 0),
      )
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {hint && <p className="text-muted-foreground mb-2 text-xs">{hint}</p>}
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => {
          focusValueRef.current = value
          setDraft(null)
          setHighlight(0)
          setOpen(true)
        }}
        onBlur={close}
        onChange={(e) => {
          setDraft(e.target.value)
          setHighlight(0)
          setOpen(true)
          onChange(e.target.value)
        }}
        onKeyDown={handleKeyDown}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-300 bg-zinc-50 py-1 shadow-md dark:border-zinc-700 dark:bg-zinc-900"
        >
          {matches.map((option, index) => (
            <li
              key={`${option.value}-${index}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === activeIndex
                  ? 'bg-zinc-200 dark:bg-zinc-700'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              onMouseDown={(event) => {
                // Prevent the input's blur from closing the list first.
                event.preventDefault()
                select(option)
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
