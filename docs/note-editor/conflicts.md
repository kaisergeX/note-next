# Concurrent edits and conflict recovery

Status: proposed design. No user-visible version history is included.

## Revision tokens are not version history

A revision token identifies the current server state for conditional writes. It can advance without retaining any older document. Local baseline/current snapshots support reconciliation; they are not a permanent historical archive.

Prefer an explicit revision counter/token over client timestamps. Exact representation and migration need detailed design. Every mutation that could invalidate an editing baseline, including content written during Trash and lifecycle transitions, must follow a consistent revision policy. A stale session must not silently write through a trash/restore cycle.

## Save sequence

1. Load a note and its revision; retain the acknowledged baseline locally.
2. Send changed fields/snapshot with the expected revision and retry identity as designed in [autosave](autosave.md).
3. Atomically check owner, active state, and expected revision while applying the update and advancing revision.
4. On mismatch, preserve the local draft. Read only a still-authorized active version for comparison; unavailable/trashed notes are not ordinary content conflicts.
5. Reconcile using **base**, **local**, and **current server** values. Apply the result only with another conditional write against the fetched server revision.

If the server changes again during review, preserve the proposed resolution and review against the newer state. Never silently force an overwrite. Revision metadata can remain outside a future encrypted body; comparison must work on the client.

## Proposed automatic reconciliation

Treat title, body, and theme as independent fields:

- Changed on one side only: retain that side.
- Both sides produce the same field value: accept it.
- Both sides change the field differently: unresolved conflict.

Rich-text title and HTML body are each indivisible fields initially. No generic text merge of HTML and no CRDT. Distinct paragraphs within one body still require review. Define normalization/equality carefully so editor serialization changes do not cause spurious conflicts.

This algorithm requires the baseline, not just local/server snapshots. For future encrypted bodies, decrypt and compare on the client; do not build server-side content merging as a dependency.

## Proposed resolution UX

On conflict, keep typing/local persistence available and pause server autosave for that note. Show a persistent review action, not a blocking surprise dialog during composition.

- Desktop: formatted **Your version** and **Saved version** side by side.
- Mobile: an accessible version switcher.
- **Keep both:** retain the server original and create a separate note from the local version; use idempotent creation. Exact naming/copy behavior needs design.
- **Use saved version:** adopt it only after preserving an explicitly bounded recovery copy or obtaining informed discard. Retention needs a decision.
- **Use my version:** explicit replacement, still guarded by the server revision shown during review.

A dedicated manual-combination editor and detailed inline diffs are optional later work. Keep-both provides a safe initial path to edit/compose normally. Do not imply an automatic body merge or a revision-history browser is included.

## Acceptance checklist

- [ ] Two tabs/devices editing the same field cannot silently overwrite one another.
- [ ] Independent field changes combine without dropping either side.
- [ ] Repeated conflicts during resolution retain all current local work.
- [ ] Lost acknowledgements reconcile correctly with the retry protocol.
- [ ] Keep-both retries create one copy, not many.
- [ ] Trash, restore, permanent deletion, and account deletion preserve lifecycle protections.
- [ ] Recovery buffers cannot cross account boundaries or be cleared by older acknowledgements.
- [ ] Comparison safely renders legacy HTML and is usable on mobile/keyboard in EN/VI.
