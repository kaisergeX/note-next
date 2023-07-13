import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

export function classNames(...classes: string[]): string {
  return classes.filter(Boolean).join(' ')
}

export const sleep = (millis = 0) => {
  return new Promise((resolve) => setTimeout(resolve, millis))
}

export const timeAgo = (
  timestamp: Date | string | null,
  timeOnly?: boolean,
): string => {
  if (!timestamp) {
    return 'never'
  }

  return dayjs(timestamp).fromNow(timeOnly)
}
