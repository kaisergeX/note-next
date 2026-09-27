import type {Metadata} from 'next'
import {getTranslations} from 'next-intl/server'
import RunNewForm, {
  type RunPersonaOption,
} from '~/components/ai/interview/run-new-form'
import {listPersonasByStatuses} from '~/db/helper/personas'
import {requireAuth} from '~/server-utils'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ai.interview.run')

  return {title: t('new')}
}

export default async function NewRunPage() {
  await requireAuth()
  const personas = await listPersonasByStatuses(['active'])

  const options: RunPersonaOption[] = personas.map((persona) => ({
    id: persona.id,
    name: persona.name,
    region: persona.region,
    age: persona.age,
    hasSystemPrompt: Boolean(
      persona.systemPrompt && persona.systemPrompt.trim().length > 0,
    ),
  }))

  return <RunNewForm personas={options} />
}
