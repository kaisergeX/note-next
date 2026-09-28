import {NextResponse} from 'next/server'
import {listPersonasByIds} from '~/db/helper/personas'
import {getRunById, listRunItems} from '~/db/helper/runs'
import {listRunTranscripts} from '~/db/helper/transcripts'
import {getCachedUser} from '~/db/helper/users'
import {
  buildRunComparisonCsv,
  buildRunExportCsv,
  buildRunExportJson,
  buildRunExportMarkdown,
  type RunExportItem,
} from '~/lib/ai/export'
import {FeatureAccessError, requireFeatureAccess} from '~/lib/ai/feature-access'
import {isShapedUuid} from '~/lib/ai/id-shape'
import {defineAuthRoute} from '~/server-utils'

export const maxDuration = 60

export const GET = defineAuthRoute<
  RouteContext<'/api/ai/interview/export/run/[runId]'>['params']
>(async ({request, session, params}) => {
  const {runId} = await params

  // Cheap arg shape check first (house convention, mirrors server actions).
  if (!isShapedUuid(runId)) {
    return NextResponse.json({error: 'Invalid run id'}, {status: 400})
  }

  // Gate order (ground rule): auth → feature access → run.
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
  if (
    format !== 'md' &&
    format !== 'csv' &&
    format !== 'csv-wide' &&
    format !== 'json'
  ) {
    return NextResponse.json({error: 'Invalid format'}, {status: 400})
  }

  const run = await getRunById(runId)
  if (!run) {
    return NextResponse.json({error: 'Run not found'}, {status: 404})
  }

  const [items, transcripts] = await Promise.all([
    listRunItems(run.id),
    listRunTranscripts(run.id),
  ])
  // listRunItems carries only personaName — full rows are needed for the
  // export, fetched in one inArray query (items cap is 100).
  const personas = await listPersonasByIds([
    ...new Set(items.map((item) => item.personaId)),
  ])
  const personaById = new Map(personas.map((persona) => [persona.id, persona]))
  // Transcripts are created lazily on the first claimed step, so
  // pending/failed items legitimately have none yet.
  const transcriptByPersona = new Map(
    transcripts.map((transcript) => [transcript.personaId, transcript]),
  )

  const exportItems: RunExportItem[] = items.flatMap((item) => {
    const persona = personaById.get(item.personaId)
    if (!persona) return []
    return [
      {
        item,
        persona,
        transcript: transcriptByPersona.get(item.personaId) ?? null,
      },
    ]
  })

  const short8 = run.id.slice(0, 8)
  let body: string
  let contentType: string
  let filename: string
  if (format === 'csv') {
    body = buildRunExportCsv(run, exportItems)
    contentType = 'text/csv; charset=utf-8'
    filename = `run-${short8}.csv`
  } else if (format === 'csv-wide') {
    body = buildRunComparisonCsv(run, exportItems)
    contentType = 'text/csv; charset=utf-8'
    filename = `run-${short8}-comparison.csv`
  } else if (format === 'json') {
    // Versioned, import-ready backup: keeps the run script/context and the
    // per-session system-prompt snapshots (provenance excluded from MD).
    body = buildRunExportJson(run, exportItems, run.questionScript)
    contentType = 'application/json; charset=utf-8'
    filename = `run-${short8}-backup.json`
  } else {
    body = buildRunExportMarkdown(run, exportItems, run.questionScript)
    contentType = 'text/markdown; charset=utf-8'
    filename = `run-${short8}-report.md`
  }

  // Excel landmine (PERSONA-SCHEMA.md "Export shape"): both CSV flavors must
  // be UTF-8 WITH BOM or Vietnamese opens as mojibake — the renderers stay
  // BOM-free, the route owns the prepend. JSON stays BOM-free (breaks
  // parsers). Markdown: plain UTF-8, no BOM.
  const payload =
    format === 'csv' || format === 'csv-wide' ? '\uFEFF' + body : body

  return new NextResponse(payload, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
