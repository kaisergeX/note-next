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
