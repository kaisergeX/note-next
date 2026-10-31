# Shared dialog flows

Status: implemented for owner visual feedback. Formal checks and independent review are deferred; prior note-editor verification predates this change.

`components/ui/dialog-flow.tsx` supplies a domain-independent dialog host using the existing `ConfirmationDialog` and `@kaiverse/k` Dialog. It does not import application stores, authentication, routing, persistence, or note types.

## Ownership

- Put `DialogFlowProvider` above conditional/loading branches that can replace screens. It owns one native dialog, its backdrop, and the lifetime of registered screen content.
- Render `DialogFlow` for each controlled screen. Pass the existing dialog props plus a stable `step` name. Screen content and callbacks stay with the calling feature.
- Child screens registered from a screen's content share the same shell. Inactive parent content stays mounted and inert, preserving editor instances and undo. Closing the child returns to its parent and restores focus where possible.
- Keep independent confirmations outside that replacement flow when they intentionally need a separate modal. This component does not automatically turn every modal in the app into one sequence.
- Place the host outside route `ViewTransition` boundaries so screen changes do not expose a route snapshot behind a newly opening modal.
- Authentication reset is an app responsibility. `components/layouts/account-dialog-flow.tsx` scopes a host to the live account, hides stale server-owned children, and refreshes the route when the owner changes. The generic primitive has no account logic.

## Async replacement

Call `useDialogFlow().handoff(prepare, renderError)` from the current screen's action. `prepare` returns the destination's `step` name, or `null` when the current screen should close without another replacement. The host keeps the current surface visible and inert while preparing, and waits for a newly registered, attached destination screen before switching. It does not use a fixed animation delay or an extra backdrop.

```tsx
await flow.handoff(
  async () => {
    const prepared = await prepareSelection()
    setPrepared(prepared)
    setStep('confirm')
    return 'confirm'
  },
  ({retry, cancel}) => (
    <>
      <p>{t('preparationFailed')}</p>
      <Button onClick={retry}>{t('retry')}</Button>
      <Button onClick={cancel}>{t('cancel')}</Button>
    </>
  ),
)
```

Both screens must be under the same persistent provider. The caller renders the next screen only after its data is ready:

```tsx
<DialogFlow
  step="confirm"
  open={step === 'confirm'}
  busy={saving}
  labelledBy={titleId}
  describedBy={descriptionId}
  initialFocusId={titleId}
  onRequestClose={close}
>
  {confirmationContent}
</DialogFlow>
```

The error renderer supplies localized recovery content. Unexpected preparation errors leave the modal/backdrop in place with Retry/Cancel available. Cancellation closes the pending screen; it does not undo completed business operations or discard application data. Callers retain their existing authorization, generation, freshness, and persistence safeguards.

## Current integrations

- Note version chooser, conflict review, and desktop note editor share one host under the notes layout. Their business callbacks prepare/resume the chosen session and report whether the destination is review, the modal editor, or the full-page editor. `beginNoteSync` exposes its existing hydration promise so these callbacks can await readiness; its checkpoint/cleanup ordering is unchanged.
- Account-settings Trash and Delete dialogs use the same generic component in a separate account-scoped host. Their mutations, verification requirements, and confirmations are unchanged.
- Logout already uses one existing `ConfirmationDialog` for its choices/discard screens and has no close/reopen sequence between those steps. Its draft-exit confirmation can intentionally appear over an account operation and remains independent.

## Preview evidence and remaining checks

Parent live previews covered full-page and desktop-modal chooser → review, return to the modal editor, Open saved to the full-page editor, mobile review, and opening/cancelling both account-settings dialogs without confirming mutations. In each of two 100-frame handoff captures, the same native dialog remained modal, with dialog/backdrop opacity 1 throughout; no missing-dialog frame occurred. This is targeted development preview evidence, not a completed regression suite.

Before final acceptance, run lint/types, production/Serwist build, relevant persistence/account/browser regressions, and one independent UI review. Add formal coverage for stable dialog identity/backdrop continuity during delayed preparation, error Retry/Cancel, keyboard/focus return, browser navigation and live account changes, plus existing copy preservation and mobile scroll/undo behavior. Keep EN/VI, reduced-motion, and desktop/mobile coverage proportionate to the shared behavior.
