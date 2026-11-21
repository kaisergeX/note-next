# Encrypted notes UI handoff

The owner approved the Collections preview on November 21, 2026. The next change is to implement its interaction design in the authenticated encrypted workspace. The preview runs on synthetic data in memory. Release readiness and permission to accept real notes are tracked separately. [Release evidence](note-encryption-release-readiness.md)

## Walk through the approved design

Run `pnpm dev` and open [Set up](http://localhost:3000/en/preview/encrypted-notes?screen=setup). The preview is development-only and needs no sign-in. The **Screen** picker is a shortcut for reviewing individual states.

| Step | What the user sees and does |
| --- | --- |
| Set up | Choose a passkey or a generated passphrase. **What stays private?** opens an anchored popover so the form stays in place. |
| Save recovery kit | Save the recovery material. The copy icon sits at the vertical center of the recovery-key row. It shows a check on success and gives a manual-copy instruction if clipboard access fails. |
| Verify | Verify both the primary method and recovery key. Each check updates the illustration. **Activate encrypted notes** leads directly to the encrypted collection. |
| Collection | Switch between Notes and Encrypted using the desktop sidebar or the mobile collection picker. Both use the familiar note grid and editor dialog. A small lock indicator identifies encrypted notes. Locked cards conceal their titles and offer unlock in context. |

The setup illustrations borrow the staggered proportions and pastel colors of the actual note grid. Use this artwork on the three setup steps. The collection and editor use the app's usual UI. Keep Tailwind, shared controls, short copy, and the writing and UI fonts from the active appearance. The approved design has one Collections option, with no first-unlock or completion page. [Preview source](../app/%5Blocale%5D/preview/encrypted-notes/) · [Design system](../DESIGN.md)

## Implement the real flow

1. Start at the authenticated collection route and trace the existing vault controls. Connect the three setup views to the existing passkey, passphrase, recovery verification and submission operations. Preserve their pending, retry, cancellation and reconciliation states. Replace demo copy and controls with localized production strings. [Collection entry](../app/%5Blocale%5D/(note)/collection/encrypted/page.tsx) · [Vault controls](../components/note/encryption/vault-controls.tsx)
2. Pay particular attention to activation. The preview opens its sample list immediately. Production verifies the server acknowledgement, refreshes the vault and clears the setup candidate. Render the collection according to the actual runtime lock state. If credentials are still needed, use the existing unlock action in the collection. [Encrypted workspace](../components/note/encryption/encrypted-workspace.tsx)
3. Reuse the existing sidebar, masonry, note card and dialog presentation where they fit. Keep encrypted reads, writes, recovery, offline checkpoints and lock cleanup on the encrypted data path. The ordinary search and save paths expect plaintext. The sample editor demonstrates the interaction and focus behavior only. [Sidebar](../components/note/note-sidebar.tsx) · [Note grid](../components/note/note-masonry.tsx) · [Encrypted editor](../components/note/encryption/encrypted-editor.tsx)
4. Verify both enrollment methods and clipboard failure with synthetic data. Cover keyboard access, mobile navigation, locked title privacy, opening a note after unlock, relocking with an editor open, and ordinary-note navigation. Run the existing lint, build and affected encryption/browser suites. Keep the enrollment and creation defaults closed. [Browser coverage](../scripts/browser/note-encryption.spec.ts) · [Operator handoff](note-encryption-operator-handoff.md)

## Checks at handoff

TypeScript and ESLint passed with `pnpm lint`. Both the Next.js and Serwist production builds passed with `pnpm build`. All 26 tests in `pnpm test:notes:encryption` passed. During design iteration, a desktop browser check confirmed the centered copy icon, a stable heading position when opening the privacy popover, and navigation from activation to the collection. The owner stopped the subsequent preview review before a verdict.
