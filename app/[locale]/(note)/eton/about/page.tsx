import {useTranslations} from 'next-intl'
import FancyHeading from '~/components/ui/fancy-heading'

export default function About() {
  const t = useTranslations('note')

  return (
    <main className="flex-center h-full flex-col p-4">
      <FancyHeading className="mb-4" title={t('about.title')} />
    </main>
  )
}
