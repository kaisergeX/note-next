import {NextResponse} from 'next/server'
import {getPersonaById} from '~/db/helper/personas'
import {getCachedUser} from '~/db/helper/users'
import {getTranscriptById} from '~/db/helper/transcripts'
import {
  asciiSlug,
  buildSessionExportJson,
  buildSessionExportMarkdown,
} from '~/lib/ai/export'
import {FeatureAccessError, requireFeatureAccess} from '~/lib/ai/feature-access'
import {isShapedUuid} from '~/lib/ai/id-shape'
import {buildReportLabels} from '~/lib/ai/report-labels'
import {defineAuthRoute} from '~/server-utils'

export const maxDuration = 60

export const GET = defineAuthRoute<
  RouteContext<'/api/ai/interview/export/session/[transcriptId]'>['params']
>(async ({request, session, params}) => {
  const {transcriptId} = await params

  // Cheap arg shape check first (house convention, mirrors server actions).
  if (!isShapedUuid(transcriptId)) {
    return NextResponse.json({error: 'Invalid transcript id'}, {status: 400})
  }

  // Gate order (ground rule): auth → feature access → resource.
  const userInfo = await getCachedUser(session.user.email)
  if (!userInfo) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }
  try {
    await requireFeatureAccess(userInfo.id, 'persona-interview')
  } catch (err) {
    if (err instanceof FeatureAccessError) {
      return NextResponse.json({reason: 'no-access'}, {status: 403})
    }
    throw err
  }

  // Single-session export supports md/json only — a lone session has nothing
  // to compare across personas, so CSV is deliberately unsupported here.
  const format = request.nextUrl.searchParams.get('format') ?? 'md'
  if (format !== 'md' && format !== 'json') {
    return NextResponse.json({error: 'Invalid format'}, {status: 400})
  }

  const transcript = await getTranscriptById(transcriptId)
  if (!transcript) {
    return NextResponse.json({error: 'Transcript not found'}, {status: 404})
  }
  // The report leads with the persona profile, so the persona must resolve
  // too — an orphaned transcript (persona gone) is a 404, not a partial file.
  const persona = await getPersonaById(transcript.personaId)
  if (!persona) {
    return NextResponse.json({error: 'Persona not found'}, {status: 404})
  }

  const isJson = format === 'json'
  // Markdown labels are localized via `?locale=` (validated, fallback 'en');
  // the JSON backup stays locale-free by design.
  const body = isJson
    ? buildSessionExportJson(persona, transcript)
    : buildSessionExportMarkdown(
        persona,
        transcript,
        await buildReportLabels(request.nextUrl.searchParams.get('locale')),
      )
  // Download name: persona slug + UTC date (createdAt is a Date; compact
  // yyyymmdd) + the 8-char id prefix, same base for every format.
  const yyyymmdd = transcript.createdAt
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '')
  const filename = `session-${asciiSlug(persona.name)}-${yyyymmdd}-${transcriptId.slice(0, 8)}.${format}`

  return new NextResponse(body, {
    headers: {
      'Content-Type': isJson
        ? // Plain UTF-8, NO BOM — a BOM breaks strict JSON parsers.
          'application/json; charset=utf-8'
        : 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
