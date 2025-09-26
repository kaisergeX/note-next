import {useRef} from 'react'
import {genRandom} from '..'

export function useRandomString(
  pool: string[] | Record<string, string>,
): string {
  return useRef(genRandom(pool)).current
}
