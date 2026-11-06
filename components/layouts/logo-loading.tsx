import {cn} from 'cn'
import Image from 'next/image'

type LogoLoadingProps = {
  className?: string
  label: string
  pulse?: boolean
}

export default function LogoLoading({
  className,
  label,
  pulse = false,
}: LogoLoadingProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('flex-center flex-col gap-4 p-6', className)}
    >
      <Image
        className={cn('dark:invert', pulse && 'motion-safe:animate-pulse')}
        src="/web-app-manifest-144x144.png"
        width={48}
        height={48}
        alt=""
      />
      <p className="text-ink-muted text-sm">{label}</p>
    </div>
  )
}
