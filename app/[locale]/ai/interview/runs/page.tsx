import type {Metadata} from 'next'
import {IconArrowLeft} from '@tabler/icons-react'
import Link from 'next/link'
import {getFormatter, getTranslations} from 'next-intl/server'
import {RUN_STATUS_BADGE_CLASS} from '~/components/ai/interview/run-status'
import {listRuns} from '~/db/helper/runs'
import {requireAuth} from '~/server-utils'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ai.interview.run')

  return {title: t('title')}
}

export default async function RunsPage() {
  await requireAuth()
  const runs = await listRuns()
  const t = await getTranslations('ai.interview.run')
  const format = await getFormatter()

  return (
    <section className="container mx-auto space-y-4 p-4 pb-16">
      <div>
        <Link
          href="/ai/interview"
          className="inline-flex items-center gap-1 text-sm"
        >
          <IconArrowLeft size="18" /> {t('backToRoster')}
        </Link>
      </div>

      <div className="flex-center-between gap-2">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link href="/ai/interview/runs/new" className="button text-sm">
          {t('new')}
        </Link>
      </div>

      {runs.length === 0 ? (
        <div className="flex-center mt-24 flex-col gap-2">
          <h3 className="opacity-80">{t('runsEmpty')}</h3>
          <p className="text-muted-foreground text-sm">{t('runsEmptyHint')}</p>
          <Link
            href="/ai/interview/runs/new"
            className="button-secondary mt-2 text-sm"
          >
            {t('new')}
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {runs.map(({run, progress}) => (
            <li key={run.id}>
              <Link
                href={`/ai/interview/runs/${run.id}`}
                className="card flex-center-between gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {format.dateTime(run.createdAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t('questions', {count: run.questionScript.length})}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground hidden text-sm tabular-nums sm:inline">
                    {t('progress', {
                      done: progress.done,
                      total: progress.total,
                    })}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${RUN_STATUS_BADGE_CLASS[run.status]}`}
                  >
                    {t(`status.${run.status}`)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
