import type {Metadata} from 'next'
import {getTranslations} from 'next-intl/server'
import BulkDraftWorkbench from '~/components/ai/interview/bulk-draft-workbench'
import {listPersonasByStatuses} from '~/db/helper/personas'
import {requireAuth} from '~/server-utils'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ai.interview.bulk')

  return {title: t('title')}
}

export default async function BulkDraftPage() {
  await requireAuth()
  const t = await getTranslations('ai.interview.bulk')
  const drafts = await listPersonasByStatuses(['draft'])

  return (
    <section className="p-4">
      <h1 className="mb-4 text-2xl font-bold">{t('title')}</h1>
      <BulkDraftWorkbench
        drafts={drafts.map((persona) => ({
          id: persona.id,
          name: persona.name,
          region: persona.region,
          occupation: persona.occupation,
          backgroundTags: persona.backgroundTags,
          personalitySliders: persona.personalitySliders,
          bio: persona.generatedBio,
        }))}
      />
    </section>
  )
}
