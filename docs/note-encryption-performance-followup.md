# Desktop replacement profiling follow-up

Measured November 16–17, 2026 (Asia/Saigon), against application source `209ae968c720f63bcc5075ee43782bcb6ff0557a`, production build `TW1Axqn5MoWv9bjgLTFW7`, desktop Chromium `158.0.8127.18`. Application source was unchanged; this follow-up adds opt-in measurement instrumentation and a trace report utility. The release manifest anchors the previously built application. No encryption protocol, KDF profile, rollout flag default, editor behavior, or performance budget changed.

The prior release measurement's 66 ms task remains **unattributed**: it had no renderer trace. This follow-up can attribute only its newly captured events. Desktop profiling does not close the physical-device, browser-engine, incremental typing, or maximum-record gates in the [release ledger](note-encryption-release-readiness.md).

## Method and reproducibility

The existing `loaded editor replacements` test runs 30 approximately 32 KiB UTF-8 whole-body `fill` replacements per editor and waits for each IndexedDB transaction to complete. It includes input, rendering, serialization, encryption where applicable, and durable checkpointing. It excludes fixture construction/mounting. This workload represents bulk replacement, not single-key typing. Both measured phases run offline; the debounce contributes to checkpoint latency.

Set `NOTE_ENCRYPTION_PROFILE_DIR` to a fresh output directory to retain `result.json` and `renderer-trace.json`. Set `NOTE_ENCRYPTION_PROFILE_ORDER=ordinary-first` to reverse the **measured replacement order**. Both orders first provision/unlock a vault and mount an empty encrypted editor, so the reversed run is not an untouched-browser ordinary-editor baseline. Client-side navigation preserves the observer and IndexedDB instrumentation. Any initial encrypted checkpoint is a different database from the ordinary phase's awaited commit. Trace attribution must inspect the actual task instead of assuming its phase label proves its cause.

The opt-in trace includes main-thread timeline events, user timing anchors, stack information and V8 CPU sampling. Sampling adds overhead to both editors. The normal benchmark path keeps its original output destination and does not enable CDP tracing or performance marks. The 2,500 ms p95 checkpoint assertion is unchanged.

Run the existing focused test against an already running loopback production preview and a disposable loopback database, with matching `DATABASE_URL`, auth secret and `NOTES_TEST_ORIGIN`. For example, after loading those fixture variables:

```powershell
$env:NOTE_ENCRYPTION_PROFILE_DIR='.playwright-mcp/performance-followup/new-run'
$env:NOTE_ENCRYPTION_PROFILE_ORDER='ordinary-first'
node node_modules/@playwright/test/cli.js test scripts/browser/note-encryption-release.spec.ts --grep 'loaded editor replacements'
node scripts/note-encryption-profile-report.mjs .playwright-mcp/performance-followup/new-run
```

The report aligns the renderer thread with a user timing anchor and includes `RunTask` events of at least 40 ms overlapping the measured interval, including tasks crossing its boundaries. It associates tasks with replacement windows and retains the largest nested events. Nested event durations overlap and must not be summed. The separate Long Tasks observer retains its original browser-specific reporting semantics; it is not a universal responsiveness measure. Raw traces remain available for checking CPU samples and causality beyond this compact summary.

## Results

Two completed pairs passed all 120 replacements and the unchanged checkpoint budget, with no reported trace loss:

| Pair and measured order                | Encrypted checkpoint p50 / p95 | Ordinary checkpoint p50 / p95 | Observed long tasks                                                              |
| -------------------------------------- | ------------------------------ | ----------------------------- | -------------------------------------------------------------------------------- |
| `run-1`, encrypted first               | 548.2 / 558.4 ms               | 558.0 / 562.4 ms              | Encrypted replacement 0: observer 64 ms, renderer **64.169 ms**. Ordinary: none. |
| `run-5-ordinary-first`, ordinary first | 545.1 / 551.2 ms               | 552.4 / 564.8 ms              | Ordinary replacement 0: observer 68 ms, renderer **68.624 ms**. Encrypted: none. |

In run 1 the long task included `textInput` dispatch (39.580 ms, containing 38.597 ms layout) and input dispatch (24.145 ms, containing mutation-observer processing and 14.196 ms layout). The ordinary phase had several 40–43 ms tasks with the same input/layout signature. In run 5 the ordinary long task included `textInput` dispatch (40.021 ms, containing 38.432 ms layout), then input dispatch (27.298 ms, containing a 21.589 ms observer callback and 15.217 ms layout). Those are nested inclusive times. The measured built chunk `0kjmyr1rbsd-a.js` contains the `window.MutationObserver` callback with the view/DOM-change queue and flush machinery of the shared ProseMirror editor. No source map was used to assign finer-grained minified functions.

The task therefore follows the **first measured replacement**, including when ordinary notes go first. This supports a shared first-input/layout cost under this fixture and browser, rather than a reproducible encryption-specific regression. Neither newly traced task establishes a cause for the older untraced 66 ms event. CPU tracing overhead, prior empty-editor mounting, fixed phases within each pair and the small number of pairs limit generalization. A different engine, phone, supported input method or first/cold condition still needs its own measurements.

Retained artifacts are `.playwright-mcp/performance-followup/{run-1,run-5-ordinary-first}/{result,renderer-trace,attribution}.json`. Run 1 completed at `2026-11-16T12:49:30.094Z`; run 5 at `2026-11-16T17:44:48.526Z`. Run 5 records Windows, Node `v26.12.1`, Intel Core i5-12400, 12 logical CPUs and approximately 31.75 GiB RAM. Its measured runner SHA-256 is `3a8015d481cbb92b348866954cdee5c17a7461aeb1a4511318a6e72f7891110e`; its release-source manifest file SHA-256 is `1d991f9c8b844f92d517700da22a5707637b17cc0f115d8aa0274b99fca9e476` (this is a file hash, not the manifest's internal source digest). Run 1 predates these added host/hash metadata fields; its result still records source revision, production build ID, browser version and trace loss status. Artifact hashes are retained separately in `artifact-hashes.json`.

Three reversed-order attempts are retained as **runner navigation** failures, not performance results: `run-2-ordinary-first/playwright/` timed out while an ordinary editor modal was still open; `run-3-ordinary-first/playwright/` raced asynchronous Save/back navigation with the next collection navigation; `run-4-ordinary-first/playwright/` was interrupted after its trace showed a modal intercepting the Notes link. The final runner reuses the existing close-test sequence: Save and go back, explicitly wait for the collection URL and hidden dialog, then open the encrypted collection. Failed/interrupted attempts do not count toward completed pairs; their Playwright artifacts were preserved.

The exact measured run-5 runner bytes are retained as `run-5-ordinary-first/measured-runner.spec.ts`, reconstructed and saved only after matching the recorded SHA-256 above. The final runner differs solely by a protocol-correct optional trace-stream type and explicit missing-stream guard, plus Prettier line wrapping of the Save/back call and runner-hash read. These changes do not alter the measured replacement/checkpoint path; no timing rerun is claimed for them.

## Scope and handoff

The fixture database had a generated `eton_test_perf_` name, was loopback-only, and was migrated independently of the shared development database. A synthetic QA user was added only there. Local test processes temporarily enabled enrollment/creation through their own environment file; repository defaults remain disabled. After the coordinator's two passing keyboard checks, the profiling agent stopped its owned production preview through its process session. The coordinator dropped the exact disposable database and verified its absence, then removed its environment and setup script. Retained traces contain only synthetic fixtures. Shared database data and pre-existing evidence were preserved.

No app-source remedy is proposed without evidence of a reproducible encryption-specific regression. Both traced pairs demonstrate a real blocking input/layout task, so the main-thread gate remains open even though checkpoint latency meets its budget.
