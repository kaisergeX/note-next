import type {NextRequest} from 'next/server'
import {encryptedMutation} from '~/lib/notes/encryption/server-http'
import {passkeyCeremony} from '~/lib/notes/encryption/server-passkeys'
export const POST = (request: NextRequest) =>
  encryptedMutation(
    request,
    (owner, input) => passkeyCeremony(owner, request.nextUrl.origin, input),
    100000,
  )
