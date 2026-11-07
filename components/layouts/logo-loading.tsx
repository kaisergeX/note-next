'use client'

import {cn} from 'cn'
import Image from 'next/image'
import {useEffect, useState} from 'react'
import {LoadingSpark} from '~/components/ui/loading-indicator'

type LogoLoadingProps = {
  className?: string
  label: string
  captions: string[]
}

export default function LogoLoading({
  className,
  label,
  captions,
}: LogoLoadingProps) {
  const [captionIndex, setCaptionIndex] = useState(0)
  useEffect(() => {
    // Pick after hydration, once per appearance, without changing server HTML.
    const frame = requestAnimationFrame(() => {
      setCaptionIndex(Math.floor(Math.random() * captions.length))
    })
    return () => cancelAnimationFrame(frame)
  }, [captions.length])

  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('flex-center flex-col gap-4 p-6', className)}
    >
      <Image
        className="dark:invert"
        src="/web-app-manifest-144x144.png"
        width={48}
        height={48}
        alt=""
      />
      <span className="sr-only">{label}</span>
      <p
        aria-hidden="true"
        className="text-ink-muted inline-flex max-w-full items-center justify-center gap-2 text-center text-sm"
      >
        <LoadingSpark />
        <span className="loading-caption min-w-0">
          {captions[captionIndex]}
        </span>
      </p>
    </div>
  )
}
