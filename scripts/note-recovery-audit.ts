import postgres from 'postgres'

// Read only. Load the chosen environment explicitly; never dump connection strings.
if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL is required for the read-only audit')
const client = postgres(process.env.DATABASE_URL, {max: 1, onnotice: () => {}})
try {
  await client.begin('read only', async (tx) => {
    const [counts] = await tx`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE pending_deleted_at IS NOT NULL)::int AS non_null_deadlines,
        count(*) FILTER (WHERE pending_deleted_at <= now())::int AS due,
        count(*) FILTER (WHERE pending_deleted_at > now())::int AS future,
        min(pending_deleted_at) AS earliest_deadline,
        max(pending_deleted_at) AS latest_deadline,
        pg_size_pretty(pg_total_relation_size('public.notes')) AS total_relation_size
      FROM public.notes`
    const indexes =
      await tx`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'notes'`
    const triggers =
      await tx`SELECT trigger_name FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'notes'`
    const [qa] =
      await tx`SELECT EXISTS(SELECT 1 FROM public.users WHERE email = 'qa@test.dev') AS qa_available`
    console.log(JSON.stringify({counts, indexes, triggers, qa}, null, 2))
  })
} catch {
  console.error(
    'Note recovery audit failed; check database access. No data changed.',
  )
  process.exitCode = 1
} finally {
  await client.end()
}
