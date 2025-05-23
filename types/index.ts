import type {localeRouting} from '~/config/localization'

export type ServerError = {
  digest: string | number
} & Error

export type Locales = (typeof localeRouting.locales)[number]

export type PropsWithLocale<T = unknown, TParams = unknown> = T & {
  params: Promise<TParams & {locale: Locales}>
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
