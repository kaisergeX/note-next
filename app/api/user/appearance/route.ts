import {eq} from 'drizzle-orm'
import {db} from '~/db'
import {userAppearanceTable} from '~/db/schema/user-appearance'
import {isAppearancePreference} from '~/lib/appearance'
import {defineAuthRoute} from '~/server-utils'

const privateHeaders = {'Cache-Control': 'private, no-store'}

export const GET = defineAuthRoute(async ({request, session}) => {
  const account = session.user.email
  if (request.nextUrl.searchParams.get('account') !== account) {
    return Response.json({error: 'Account changed'}, {status: 409})
  }
  const [preference] = await db
    .select({
      appearance: userAppearanceTable.appearance,
      mode: userAppearanceTable.mode,
    })
    .from(userAppearanceTable)
    .where(eq(userAppearanceTable.userId, session.user.id))
  return Response.json(
    {account, preference: preference ?? null},
    {headers: privateHeaders},
  )
})

export const PUT = defineAuthRoute(async ({request, session}) => {
  // JSON plus a same-origin check protects this cookie-authenticated write.
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return Response.json({error: 'Invalid origin'}, {status: 403})
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({error: 'Invalid JSON'}, {status: 400})
  }
  if (
    !isAppearancePreference(body) ||
    !('account' in body) ||
    typeof body.account !== 'string' ||
    !('initialize' in body) ||
    typeof body.initialize !== 'boolean'
  ) {
    return Response.json(
      {error: 'Invalid appearance preference'},
      {status: 400},
    )
  }
  const account = session.user.email
  if (body.account !== account) {
    return Response.json({error: 'Account changed'}, {status: 409})
  }
  const values = {
    userId: session.user.id,
    appearance: body.appearance,
    mode: body.mode,
  }
  if (body.initialize) {
    // A second device signing in must never replace an existing preference.
    await db.insert(userAppearanceTable).values(values).onConflictDoNothing()
  } else {
    await db
      .insert(userAppearanceTable)
      .values(values)
      .onConflictDoUpdate({
        target: userAppearanceTable.userId,
        set: {
          appearance: body.appearance,
          mode: body.mode,
          updatedAt: new Date(),
        },
      })
  }
  const [preference] = await db
    .select({
      appearance: userAppearanceTable.appearance,
      mode: userAppearanceTable.mode,
    })
    .from(userAppearanceTable)
    .where(eq(userAppearanceTable.userId, session.user.id))
  return Response.json({account, preference}, {headers: privateHeaders})
})
