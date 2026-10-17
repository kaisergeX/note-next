import type {Metadata} from 'next'
import {getTranslations} from 'next-intl/server'
import PersonaRosterCard from '~/components/ai/interview/persona-roster-card'
import type {PersonaFormInitial} from '~/components/ai/interview/persona-form'
import {listPersonasByStatuses} from '~/db/helper/personas'
import {requireAuth} from '~/server-utils'
import {IconMan, IconSparkles, IconUsersGroup} from '@tabler/icons-react'
import LinkButton from '~/components/ui/link-button'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: `${t('ai.interview.title')} | ${
      process.env.SERVICE_NAME ?? t('common.app')
    }`,
  }
}

export default async function InterviewPage() {
  await requireAuth()
  const personas = await listPersonasByStatuses(['draft', 'active'])
  const t = await getTranslations('ai.interview')

  const serializedPersonas: PersonaFormInitial[] = personas.map((persona) => ({
    id: persona.id,
    name: persona.name,
    gender: persona.gender ?? undefined,
    age: persona.age ?? undefined,
    region: persona.region,
    incomeBracket: persona.incomeBracket ?? undefined,
    occupation: persona.occupation ?? undefined,
    backgroundTags: persona.backgroundTags,
    personalitySliders: persona.personalitySliders,
    interviewStance: persona.interviewStance ?? undefined,
    quirksFreetext: persona.quirksFreetext ?? undefined,
    generatedBio: persona.generatedBio,
    systemPrompt: persona.systemPrompt,
    status: persona.status,
  }))

  return (
    <section className="p-4">
      <div className="flex-center-between mb-4">
        <h1 className="text-2xl font-bold">{t('roster.title')}</h1>
        <div className="flex items-center gap-2">
          <LinkButton href="/ai/interview/bulk" size="sm">
            <IconSparkles /> {t('bulk.title')}
          </LinkButton>
          <LinkButton href="/ai/interview/runs" size="sm">
            <IconUsersGroup /> {t('run.title')}
          </LinkButton>
          <LinkButton href="/ai/interview/new" variant="primary" size="sm">
            <IconMan /> {t('roster.newPersona')}
          </LinkButton>
        </div>
      </div>

      {serializedPersonas.length === 0 ? (
        <div className="flex-center mt-24 flex-col gap-2">
          <h3 className="opacity-80">{t('roster.empty')}</h3>
          <p className="text-ink-muted text-sm">{t('roster.emptyHint')}</p>
          <LinkButton href="/ai/interview/new" className="mt-2" size="sm">
            {t('roster.newPersona')}
          </LinkButton>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-4 pb-16">
          {serializedPersonas.map((persona) => (
            <PersonaRosterCard key={persona.id} persona={persona} />
          ))}
        </div>
      )}
    </section>
  )
}
