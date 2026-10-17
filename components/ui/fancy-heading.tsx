import {cn} from 'cn'

export default function FancyHeading({
  title,
  className,
}: {
  title: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <h1 className="text-2xl font-bold md:text-3xl xl:text-4xl">{title}</h1>
    </div>
  )
}
