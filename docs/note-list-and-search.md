# All notes and search

## 1. Paginate All notes

Use TanStack Query to fetch owner-scoped cursor pages in the existing newest-first order, with note ID breaking ties on creation time. Fetch bounded card previews on the list and the full document when opened. Fetch the next page near the end of the list and provide an accessible load-more action with retry.

Verify page boundaries with identical timestamps and failed requests. A browser draft can belong to a saved note on a later page. Resolve its identity independently of which pages are loaded so the draft opens the correct editor, contributes to the review filter, and appears once when its page arrives.

## 2. Render long masonry lists

Use native CSS masonry wherever supported. Align the stylesheet and the feature check with the supported syntax, including `display: grid-lanes`. Replace or adapt the existing masonry hook as needed. Use TanStack Virtual's measured lanes as the JavaScript fallback.

Prototype native windowing with measured page spacers. Compare against continuous native masonry on a long list before adopting page-level windowing, since a tall final card in one page can leave gaps above the next. Verify mounted card count, keyboard focus across page boundaries, resizing, and scroll restoration after closing a desktop dialog or returning from the mobile editor.

## 3. Search the collection

Search titles for all active notes owned by the user, plus visible body text for unencrypted notes. Titles remain plaintext. Encrypted bodies are searchable by title only in this plan. A complete on-device body index would require downloading and decrypting the collection on each new device and protecting any persistent index. Revisit that cost if title search proves insufficient.

Search across unloaded pages and reconcile results with browser drafts using the same version shown on the card. Benchmark PostgreSQL trigram indexing on representative long notes. Test mixed scripts, text without spaces, short queries, symbols, and words split by inline formatting. When a body becomes encrypted, remove derived plaintext search data and snippets. Reconcile the public privacy description with the intended encryption behavior before shipping search.
