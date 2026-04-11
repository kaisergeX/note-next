'use client'

import {useMemo} from 'react'
import {genRandom} from '..'

export function useRandomString(
  pool: string[] | Record<string, string>,
): string {
  return useMemo(() => genRandom(pool), [pool])
}
