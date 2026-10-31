'use client'

import {useEffect, type ReactNode} from 'react'
import {useSession} from 'next-auth/react'
import {useRouter} from 'next/navigation'
import {DialogFlowProvider} from '~/components/ui/dialog-flow'

export default function AccountDialogFlow({
  ownerId,
  children,
}: {
  ownerId: string
  children: ReactNode
}) {
  const {data: session, status} = useSession()
  const router = useRouter()
  const scope = status === 'loading' ? ownerId : session?.user?.id
  const accountChanged = status !== 'loading' && scope !== ownerId
  useEffect(() => {
    if (accountChanged) router.refresh()
  }, [accountChanged, router])
  if (accountChanged) return null
  return <DialogFlowProvider key={scope}>{children}</DialogFlowProvider>
}
