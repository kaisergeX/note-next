import type {Metadata} from 'next'
import {IconArrowLeft} from '@tabler/icons-react'
import Link from 'next/link'
import {getFormatter, getTranslations} from 'next-intl/server'
import {Badge} from '~/components/ui/badge'
import LinkButton from '~/components/ui/link-button'
import {RUN_STATUS_BADGE} from '~/components/ai/interview/run-status'
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
          className="focus-visible:outline-accent inline-flex min-h-11 items-center gap-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <IconArrowLeft size="18" /> {t('backToRoster')}
        </Link>
      </div>

      <div className="flex-center-between gap-2">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <LinkButton href="/ai/interview/runs/new" className="min-h-11">
          {t('new')}
        </LinkButton>
      </div>

      {runs.length === 0 ? (
        <div className="flex-center mt-24 flex-col gap-2">
          <h3 className="opacity-80">{t('runsEmpty')}</h3>
          <p className="text-ink-muted text-sm">{t('runsEmptyHint')}</p>
          <LinkButton
            href="/ai/interview/runs/new"
            variant="secondary"
            className="mt-2 min-h-11"
          >
            {t('new')}
          </LinkButton>
        </div>
      ) : (
        <ul className="space-y-2">
          {runs.map(({run, progress}) => (
            <li key={run.id}>
              <Link
                href={`/ai/interview/runs/${run.id}`}
                className="flex-center-between border-hairline bg-paper-raised text-ink hover:bg-raised-hover rounded-lg border p-4 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {format.dateTime(run.createdAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                  <p className="text-ink-muted text-xs">
                    {t('questions', {count: run.questionScript.length})}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-ink-muted hidden text-sm tabular-nums sm:inline">
                    {t('progress', {
                      done: progress.done,
                      total: progress.total,
                    })}
                  </span>
                  <Badge status={RUN_STATUS_BADGE[run.status]}>
                    {t(`status.${run.status}`)}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
