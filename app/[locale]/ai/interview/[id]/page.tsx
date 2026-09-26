import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'
import PersonaForm, {
  type PersonaFormInitial,
} from '~/components/ai/interview/persona-form'
import {getPersonaById} from '~/db/helper/personas'
import {requireAuth} from '~/server-utils'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/ai/interview/[id]'>): Promise<Metadata> {
  const {id} = await params
  const persona = await getPersonaById(id)
  const t = await getTranslations('ai.interview.form')

  return {title: persona ? persona.name : t('editTitle')}
}

export default async function EditPersonaPage({
  params,
}: PageProps<'/[locale]/ai/interview/[id]'>) {
  await requireAuth()
  const {id} = await params
  const persona = await getPersonaById(id)
  if (!persona) notFound()

  const initial: PersonaFormInitial = {
    id: persona.id,
    name: persona.name,
    gender: persona.gender,
    age: persona.age,
    region: persona.region,
    incomeBracket: persona.incomeBracket,
    occupation: persona.occupation,
    backgroundTags: persona.backgroundTags,
    personalitySliders: persona.personalitySliders,
    interviewStance: persona.interviewStance,
    quirksFreetext: persona.quirksFreetext,
    generatedBio: persona.generatedBio,
    systemPrompt: persona.systemPrompt,
    status: persona.status,
  }

  return <PersonaForm mode="edit" initial={initial} />
}
