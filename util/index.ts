import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

export function classNames(...classes: string[]): string {
  return classes.filter(Boolean).join(' ')
}

export function sleep(millis = 0) {
  return new Promise((resolve) => setTimeout(resolve, millis))
}

export function timeAgo(
  timestamp: Date | string | null,
  timeOnly?: boolean,
): string {
  if (!timestamp) {
    return 'never'
  }

  return dayjs(timestamp).fromNow(timeOnly)
}

export async function fetcher(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, init)
  return res.json()
}
