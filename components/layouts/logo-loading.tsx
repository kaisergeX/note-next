import {cn} from 'cn'
import Image from 'next/image'

type LogoLoadingProps = {
  className?: string
  pulse?: boolean
}

export default function LogoLoading({
  className,
  pulse = false,
}: LogoLoadingProps) {
  return (
    <div className={cn('flex-center text-3xl dark:invert', className)}>
      <Image
        className={pulse ? 'animate-pulse' : undefined}
        src="/web-app-manifest-144x144.png"
        width={144}
        height={144}
        alt="brand"
      />
    </div>
  )
}
