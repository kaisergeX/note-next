import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'
import PersonaForm, {
  type PersonaFormInitial,
} from '~/components/ai/interview/persona-form'
import {getPersonaById} from '~/db/helper/personas'
import {isShapedUuid} from '~/lib/ai/id-shape'
import {requireAuth} from '~/server-utils'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/ai/interview/[id]/edit'>): Promise<Metadata> {
  const {id} = await params
  if (!isShapedUuid(id)) notFound()
  const persona = await getPersonaById(id)
  const t = await getTranslations('ai.interview.form')

  return {title: persona ? persona.name : t('editTitle')}
}

export default async function EditPersonaPage({
  params,
}: PageProps<'/[locale]/ai/interview/[id]/edit'>) {
  await requireAuth()
  const {id} = await params
  if (!isShapedUuid(id)) notFound()
  const persona = await getPersonaById(id)
  if (!persona) notFound()

  const initial: PersonaFormInitial = {
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
  }

  return <PersonaForm mode="edit" initial={initial} />
}
