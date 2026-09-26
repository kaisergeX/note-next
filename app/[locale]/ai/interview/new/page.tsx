import type {Metadata} from 'next'
import {getTranslations} from 'next-intl/server'
import PersonaForm from '~/components/ai/interview/persona-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ai.interview.form')

  return {title: t('newTitle')}
}

export default function NewPersonaPage() {
  return <PersonaForm mode="create" />
}
