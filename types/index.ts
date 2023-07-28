export type ServerError = {
  digest: string | number
} & Error

/**
 * @example
 * ```ts
 * const themePgEnum = pgEnum('theme', ['red', 'pink', 'orange'])
 * enumFromArray(themeEnum.enumValues) // {red: 'red', pink: 'pink', orange: 'orange'}
 *
 * const themeEnum = ['red', 'pink', 'orange'] as const
 * enumFromArray(themeEnum) // {red: 'red', pink: 'pink', orange: 'orange'}
 * ```
 */
export function enumFromArray<T extends string>(
  inputArr: Readonly<Array<T>>,
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

/**
 * @example
 * type Test = ExcludeFromTuple<['a', 'b', 1], 'a'> // ['b', 1]
 */
export type ExcludeFromTuple<T extends readonly unknown[], E> = T extends [
  infer F,
  ...infer R,
]
  ? [F] extends [E]
    ? ExcludeFromTuple<R, E>
    : [F, ...ExcludeFromTuple<R, E>]
  : []
