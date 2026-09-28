import {NextResponse} from 'next/server'
import {getPersonaById} from '~/db/helper/personas'
import {getCachedUser} from '~/db/helper/users'
import {listAllTranscriptsByPersona} from '~/db/helper/transcripts'
import {
  asciiSlug,
  buildPersonaExportCsv,
  buildPersonaExportJson,
  buildPersonaExportMarkdown,
} from '~/lib/ai/export'
import {FeatureAccessError, requireFeatureAccess} from '~/lib/ai/feature-access'
import {isShapedUuid} from '~/lib/ai/id-shape'
import {buildReportLabels} from '~/lib/ai/report-labels'
import {defineAuthRoute} from '~/server-utils'

export const maxDuration = 60

export const GET = defineAuthRoute<
  RouteContext<'/api/ai/interview/export/persona/[id]'>['params']
>(async ({request, session, params}) => {
  const {id} = await params

  // Cheap arg shape check first (house convention, mirrors server actions).
  if (!isShapedUuid(id)) {
    return NextResponse.json({error: 'Invalid persona id'}, {status: 400})
  }

  // Gate order (ground rule): auth → feature access → persona.
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

  const format = request.nextUrl.searchParams.get('format') ?? 'md'
  if (format !== 'md' && format !== 'csv' && format !== 'json') {
    return NextResponse.json({error: 'Invalid format'}, {status: 400})
  }

  const persona = await getPersonaById(id)
  if (!persona) {
    return NextResponse.json({error: 'Persona not found'}, {status: 404})
  }

  // Single sessions AND run sessions both carry Q&A worth exporting;
  // oldest first so the file reads chronologically.
  const transcripts = await listAllTranscriptsByPersona(persona.id)

  let body: string
  let contentType: string
  let filename: string
  // Markdown AND CSV are localized via `?locale=` (validated, fallback 'en');
  // the JSON backup stays locale-free by design.
  const localeParam = request.nextUrl.searchParams.get('locale')
  if (format === 'csv') {
    body = buildPersonaExportCsv(
      persona,
      transcripts,
      await buildReportLabels(localeParam),
    )
    contentType = 'text/csv; charset=utf-8'
    filename = `persona-${asciiSlug(persona.name)}.csv`
  } else if (format === 'json') {
    // Versioned, import-ready backup: keeps the persona + per-session
    // system-prompt snapshots (provenance excluded from the MD report).
    body = buildPersonaExportJson(persona, transcripts)
    contentType = 'application/json; charset=utf-8'
    filename = `persona-${asciiSlug(persona.name)}-backup.json`
  } else {
    body = buildPersonaExportMarkdown(
      persona,
      transcripts,
      await buildReportLabels(localeParam),
    )
    contentType = 'text/markdown; charset=utf-8'
    filename = `persona-${asciiSlug(persona.name)}-report.md`
  }

  // Excel landmine (PERSONA-SCHEMA.md "Export shape"): CSV must be UTF-8
  // WITH BOM or Vietnamese opens as mojibake — the renderers stay BOM-free,
  // the route owns the prepend. JSON stays BOM-free (breaks parsers).
  const payload = format === 'csv' ? '\uFEFF' + body : body

  return new NextResponse(payload, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
