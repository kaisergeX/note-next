import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {redirect} from 'next/navigation'
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

  const contentType = res.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    if (res.status === 404) {
      throw new Error(res.statusText)
    }

    if (res.redirected) {
      redirect(res.url)
    }

    throw new Error('Response data is not supported')
  }

  if (!res.ok) {
    if (res.status === 429) {
      redirect('/denied/rate-limit')
    }

    const serverErr = (await res.json()) as ServerError
    throw serverErr
  }

  return res.json() as ResponseData
}

/**
 * Extract text contents of HTML string that returns from Rich text editor.
 * ___
 * DO NOT use this function on Server component/Server Actions
 * since it uses DOM API such as
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/DOMParser/parseFromString DOMParser().parseFromString()}.
 */
export function extractRawContentsHTML(
  html: string,
  keepNodesSpace?: boolean,
): string | null {
  const parsedDoc = new DOMParser().parseFromString(html, 'text/html')

  if (keepNodesSpace) {
    // add a space between content of each and only block elements from Rich text editor.

    // @todo since list (ol, ul, li) are nested block elements.
    // check if its contents be duplicated with below logic
    const nodes = parsedDoc.body.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, hr, blockquote, pre, li',
    )
    // Elements in HTML string that return from Rich text editor component won't
    // and shouldn't have any styles. Can't use below selector for now.
    // const nodes = parsedDoc.body.querySelectorAll("*[style*=display\\:block]")

    let content = ''
    for (const node of nodes) {
      if (!node.textContent) {
        continue
      }

      content += node.textContent + ' '
    }

    return content.trim()
  }

  return parsedDoc.documentElement.textContent
}
