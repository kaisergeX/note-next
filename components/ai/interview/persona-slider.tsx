'use client'

import {useId} from 'react'

type PersonaSliderProps = {
  axisKey: string
  value: number
  onChange: (value: number) => void
  poleStartLabel: string
  poleEndLabel: string
  ariaLabel: string
  disabled?: boolean
}

export default function PersonaSlider({
  axisKey,
  value,
  onChange,
  poleStartLabel,
  poleEndLabel,
  ariaLabel,
  disabled,
}: PersonaSliderProps) {
  const id = useId()

  return (
    <div>
      <div className="flex-center-between mb-1 text-sm">
        <span className="font-medium">{poleStartLabel}</span>
        <span className="text-zinc-500 tabular-nums">{value}</span>
        <span className="font-medium">{poleEndLabel}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        data-axis={axisKey}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-zinc-900 disabled:opacity-50 dark:accent-zinc-300"
      />
    </div>
  )
}
