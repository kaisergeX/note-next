import {decode, encode} from 'next-auth/jwt'
import {DELETE_VERIFICATION_SECONDS} from './policy'
export {DELETE_VERIFICATION_SECONDS, hasFreshDeleteVerification} from './policy'

export const DELETE_INTENT_COOKIE = 'account-delete-intent'
const salt = 'account-delete-verification'

export type DeleteIntent = {
  userId: string
  email: string
  locale: 'en' | 'vi'
}

function secret() {
  const value = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!value) throw new Error('Authentication secret is required')
  return value
}

export async function encodeDeleteIntent(intent: DeleteIntent) {
  return encode({
    secret: secret(),
    salt,
    maxAge: DELETE_VERIFICATION_SECONDS,
    token: {...intent, purpose: salt},
  })
}

export async function decodeDeleteIntent(
  value: string,
): Promise<DeleteIntent | null> {
  try {
    const token = await decode({token: value, secret: secret(), salt})
    if (
      token?.purpose !== salt ||
      typeof token.userId !== 'string' ||
      typeof token.email !== 'string' ||
      (token.locale !== 'en' && token.locale !== 'vi') ||
      !token.exp ||
      token.exp * 1000 <= Date.now()
    )
      return null
    return {userId: token.userId, email: token.email, locale: token.locale}
  } catch {
    return null
  }
}
