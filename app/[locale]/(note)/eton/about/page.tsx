import {useTranslations} from 'next-intl'
import FancyHeading from '~/components/fancy-heading'

export default function About() {
  const t = useTranslations('common')

  return (
    <main className="flex h-full flex-col p-4">
      <FancyHeading className="mb-4" title={t('app')} />
    </main>
  )
}
