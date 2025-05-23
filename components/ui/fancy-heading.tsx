import {classNames} from '@kaiverse/k/utils'

export default function FancyHeading({
  title,
  className,
}: {
  title: string
  className?: string
}) {
  return (
    <div
      className={classNames(
        'relative place-items-center',
        "before:absolute before:h-[300px] before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-radial before:from-white before:to-transparent before:blur-2xl before:content-['']",
        "after:-z-20 after:h-[180px] after:w-[240px] after:translate-x-1/3 after:bg-conic-180 after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-['']",
        'sm:after:absolute before:lg:h-[360px]',
        'before:dark:bg-linear-to-br before:dark:from-transparent before:dark:to-blue-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40',
        className,
      )}
    >
      <h1 className="relative text-2xl font-bold md:text-3xl xl:text-4xl">
        {title}
      </h1>
    </div>
  )
}
