import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type {ServerError} from '~/types'
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

export function genRandom<T>(pool: Array<T>): T | string {
  if (pool.length === 0) {
    return ''
  }

  return pool[Math.floor(Math.random() * pool.length)]
}

export async function fetcher<ResponseData>(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const res = await fetch(input, init)
  if (!res.ok) {
    const error = new Error()
    error.message = ((await res.json()) as ServerError).message
    throw error
  }

  return res.json() as ResponseData
}
