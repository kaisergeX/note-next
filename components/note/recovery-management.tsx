'use client'

import {useId, useState} from 'react'
import {IconDotsVertical, IconDownload, IconTrash} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {exportDrafts, type RecoveryDraft} from '~/lib/notes/drafts'
import {discardCapturedDrafts} from '~/lib/notes/session-sync'
import {groupNoteRecovery} from '~/lib/notes/recovery-copies'
import Button, {buttonClass, MenuItemButton} from '~/components/ui/button'
import MenuCustom from '~/components/ui/menu'
import ConfirmationDialog from '~/components/ui/confirmation-dialog'

export default function RecoveryManagement({
  ownerId,
  records,
  all = false,
}: {
  ownerId: string
  records: RecoveryDraft[]
  all?: boolean
}) {
  const t = useTranslations('note.recovery')
  const id = useId()
  const [captured, setCaptured] = useState<RecoveryDraft[]>()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()
  return (
    <>
      <MenuCustom
        ariaLabel={t(all ? 'browserWorkActions' : 'versionActions')}
        anchor={all ? 'bottom-start' : 'bottom-end'}
        className={buttonClass({variant: 'ghost', iconOnly: true})}
        itemsClassName="w-48 max-w-xs [&_button]:h-auto [&_button]:min-h-10 [&_svg]:shrink-0"
        items={[
          {
            component: (
              <div role="group" aria-labelledby={`${id}-scope`}>
                <p
                  id={`${id}-scope`}
                  className="border-hairline text-ink-muted border-b px-3 py-2 text-xs font-normal"
                >
                  {t(all ? 'allLocalChanges' : 'thisVersion')}
                </p>
                <MenuItemButton onClick={() => exportDrafts(records)}>
                  <IconDownload size={18} aria-hidden />
                  <span>{t('exportAction')}</span>
                </MenuItemButton>
                <MenuItemButton
                  destructive
                  onClick={() => {
                    setNotice(undefined)
                    setCaptured(structuredClone(records))
                  }}
                >
                  <IconTrash size={18} aria-hidden />
                  <span>{t('discardAction')}</span>
                </MenuItemButton>
              </div>
            ),
          },
        ]}
      >
        <IconDotsVertical size={18} aria-hidden />
      </MenuCustom>
      {notice && (
        <p role="alert" className="text-warning text-sm">
          {notice}
        </p>
      )}
      <ConfirmationDialog
        open={!!captured}
        busy={busy}
        labelledBy={id}
        describedBy={`${id}-description`}
        onRequestClose={() => setCaptured(undefined)}
      >
        <h2 id={id} className="text-lg font-semibold">
          {t(all ? 'discardAllTitle' : 'discardVersionTitle')}
        </h2>
        <p id={`${id}-description`} className="text-ink-muted my-4 text-sm">
          {all
            ? t('discardAllBody', {
                count: groupNoteRecovery(captured ?? []).size,
              })
            : t('discardVersionBody')}
        </p>
        {notice && (
          <p role="alert" className="text-destructive mb-4 text-sm">
            {notice}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            data-cancel
            disabled={busy}
            onClick={() => setCaptured(undefined)}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              if (!captured) return
              setBusy(true)
              try {
                const result = await discardCapturedDrafts(ownerId, captured)
                setCaptured(undefined)
                if (result.newer) setNotice(t('draftsChanged'))
              } catch {
                setNotice(t('recoveryFailed'))
              } finally {
                setBusy(false)
              }
            }}
          >
            {t('discardAction')}
          </Button>
        </div>
      </ConfirmationDialog>
    </>
  )
}
