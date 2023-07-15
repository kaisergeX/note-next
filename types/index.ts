export type ServerError = {
  digest: string
} & Error

export function enumFromArray<T extends string>(
  inputArr: Array<T>,
): {[K in T]: K} {
  const result = {} as {[K in T]: K}
  for (const key of inputArr) {
    result[key] = key
  }
  return result
}

/**
 * @example
 * type Test = UnionFromArray<['a', 'b', 1]> // 'a' | 'b' | 1
 * const a: Test = 'a' // ok
 * const b: Test = 2   // error
 */
export type UnionFromArray<T extends unknown[]> = T[number]
