import {
  IconCheck,
  IconFingerprint,
  IconKey,
  IconLock,
  IconPassword,
} from '@tabler/icons-react'
import {useId} from 'react'

export type SetupStage = 'setup' | 'backup' | 'verify'

// The gutters break each symbol into pieces, like a print across the note grid.
const tiles = [
  {
    x: 12,
    y: 80,
    w: 70,
    h: 76,
    color: 'fill-emerald-200/80 dark:fill-emerald-800',
  },
  {x: 12, y: 164, w: 70, h: 48, color: 'fill-cyan-100 dark:fill-cyan-900'},
  {x: 90, y: 36, w: 98, h: 110, color: 'fill-sky-200 dark:fill-sky-800'},
  {
    x: 90,
    y: 154,
    w: 98,
    h: 108,
    color: 'fill-violet-200/80 dark:fill-violet-900',
  },
  {
    x: 196,
    y: 61,
    w: 112,
    h: 135,
    color: 'fill-emerald-200 dark:fill-emerald-800',
  },
  {
    x: 196,
    y: 204,
    w: 112,
    h: 41,
    color: 'fill-yellow-100 dark:fill-yellow-900',
  },
  {x: 316, y: 100, w: 49, h: 60, color: 'fill-rose-100 dark:fill-rose-900'},
  {x: 316, y: 168, w: 49, h: 42, color: 'fill-sky-100 dark:fill-sky-900'},
]

/**
 * Setup artwork approved with the Collections preview. It reuses the pastel
 * palette and staggered proportions of the note grid on every setup step.
 */
export default function SetupScene({
  stage,
  method = 'passkey',
  primaryChecked = false,
  recoveryChecked = false,
}: {
  stage: SetupStage
  method?: 'passkey' | 'passphrase'
  primaryChecked?: boolean
  recoveryChecked?: boolean
}) {
  const clip = useId()

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none order-first grid place-items-center select-none md:col-start-1 md:row-span-2 md:row-start-1 md:min-h-96"
    >
      <svg
        viewBox="0 0 380 292"
        className="w-full max-w-64 sm:max-w-80 md:max-w-100"
      >
        <defs>
          <clipPath id={clip}>
            {tiles.map(({x, y, w, h}) => (
              <rect key={x + '-' + y} x={x} y={y} width={w} height={h} rx="7" />
            ))}
          </clipPath>
        </defs>
        {tiles.map(({x, y, w, h, color}) => (
          <rect
            key={x + '-' + y}
            x={x}
            y={y}
            width={w}
            height={h}
            rx="7"
            className={color}
          />
        ))}
        <g clipPath={`url(#${clip})`} className="text-ink/65">
          {stage === 'setup' && (
            <IconLock x={105} y={54} size={174} stroke={1.15} />
          )}
          {stage === 'backup' && (
            <IconKey x={97} y={51} size={191} stroke={1.15} />
          )}
          {stage === 'verify' && (
            <>
              {method === 'passkey' ? (
                <IconFingerprint x={107} y={59} size={64} stroke={1.3} />
              ) : (
                <IconPassword x={107} y={59} size={64} stroke={1.3} />
              )}
              <IconKey x={220} y={97} size={64} stroke={1.3} />
            </>
          )}
        </g>
        {stage === 'verify' && primaryChecked && (
          <g className="text-success">
            <circle cx={184} cy={44} r={15} fill="currentColor" />
            <IconCheck
              x={174}
              y={34}
              size={20}
              stroke={2.5}
              className="text-paper"
            />
          </g>
        )}
        {stage === 'verify' && recoveryChecked && (
          <g className="text-success">
            <circle cx={304} cy={69} r={15} fill="currentColor" />
            <IconCheck
              x={294}
              y={59}
              size={20}
              stroke={2.5}
              className="text-paper"
            />
          </g>
        )}
      </svg>
    </div>
  )
}
