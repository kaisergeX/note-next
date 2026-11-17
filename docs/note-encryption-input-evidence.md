# Retained input evidence and device discovery

On November 17, 2026, we reviewed the retained traces and measured the first
keyboard edit on the same application build using a disposable database.
The physical-device release gate remains open.

## What the retained renderer events establish

For each completed pair below, select the `profile-start-{phase}` mark, then
events on its exact renderer PID/TID through
`mark.ts + (result[phase].end - result[phase].start) * 1000`. Each phase contains
30 `beforeinput`, 30 `textInput` and 30 `input` dispatches and **zero** `keydown`,
`keypress` or `keyup` dispatches in that interval. These are the retained
whole-body `fill` replacements, not first physical keyboard interactions.

| Pair / phase | First textInput / input | Median textInput / input |
| --- | --- | --- |
| run-1 encrypted | 39.580 / 24.145 ms | 18.379 / 17.810 ms |
| run-1 ordinary | 15.019 / 23.515 ms | 17.244 / 21.788 ms |
| run-5-ordinary-first ordinary | 40.021 / 27.298 ms | 15.259 / 19.446 ms |
| run-5-ordinary-first encrypted | 15.905 / 17.848 ms | 16.892 / 16.922 ms |

Medians here use sorted index 15 of 30 event durations. Event dispatch durations
are inclusive, not input-to-paint latency. They must not be summed with their
nested layout/callback durations. Sources are the unmodified
`.playwright-mcp/performance-followup/{run-1,run-5-ordinary-first}/`
`result.json` and `renderer-trace.json`; their provenance and trace-overhead
limitations are documented in [the prior follow-up](note-encryption-performance-followup.md).

The first `textInput` is also the maximum for that phase when the phase runs
first in its pair. This is consistent with the existing shared first bulk
replacement/layout attribution. It does not establish first-key responsiveness,
identify a particular editor optimization, or attribute the earlier untraced
66 ms task.

## What the incremental artifact excludes

`.playwright-mcp/typing-attribution/incremental.spec.ts` first fills approximately
32 KiB, awaits its IndexedDB checkpoint, and presses `Control+End`. Only then
does it place `audit-start-*`. Its measured loop presses `x` 30 times, awaiting
a checkpoint after every key. `incremental.json` reports no observer long tasks
and encrypted/ordinary p95 checkpoints of 533.1 / 539.5 ms.

That result covers spaced single-character appends to an already populated,
checkpointed editor. It excludes initial bulk input and the first navigation
key. It does not cover sustained typing, IME/composition, input-to-paint latency
or physical hardware. The retained incremental runner reads its CDP trace into
memory, emits attribution only for observer-selected long tasks, and never
writes the raw trace. Consequently the empty attribution arrays cannot answer
whether smaller renderer tasks occurred, whether a task crossed the measured
boundary, or how first-key processing compares with the replacement traces.
The JSON also lacks build/browser/hash provenance fields. Treat it as supporting
local evidence, not an equivalent trace-backed release result.

The follow-up below records the first key in an empty editor separately from
a short typing burst and retains the raw renderer trace for each editor. Actual
presentation timing, sustained typing and mobile input methods still need
device-specific measurements.

## Physical-target discovery

Safe local discovery found no usable mobile target: `adb` and `idevice_id` were
absent from PATH; no adb/usbmuxd process or adb executable in the two checked
locations (`%LOCALAPPDATA%/Android/Sdk/platform-tools` and
`C:/Android/platform-tools`) was found. `pnputil /enum-devices /connected /class
WPD` and the same query for `AndroidUsbDeviceClass` both returned no devices.
The USB-class inventory contained host controllers, hubs and generic composite
devices, none identified there as a phone. CIM inventory was denied, and
`Get-PnpDevice` supplied no matching phone entry.

This is bounded discovery, not proof that no wireless or unconfigured device
exists. No network scanning, installation, pairing, USB mode change or
permission escalation was performed. Physical mobile measurement remains open
until an owner makes an authorized target available. No confirmed application
defect justifies a performance or cryptographic change from this evidence.

## Focused first-key desktop diagnostic

A subsequent focused run passed both tests at `2026-11-16T18:19:53.846Z` and
`18:19:57.330Z` (November 17 locally), using frozen production build
`TW1Axqn5MoWv9bjgLTFW7`, Chromium `158.0.8127.18`, Windows `10.0.26200` and
Intel Core i5-12400. Each test used an independent fresh browser context and
fixture account. The encrypted editor was freshly created after vault setup;
the ordinary counterpart was freshly opened with an empty body stored through
the fixture API. Neither body received `fill` or a navigation key before its
first `page.keyboard.press('x')`. The runner checked visibility, editability,
empty text and focus, then waited two animation frames. Vault setup and title
rendering still warm the application; this is a first body key, not a cold
browser/first-ever interaction measurement.

Both phases ran offline, with renderer tracing but without CPU sampling. Each
recorded `keydown`, `keypress`, `beforeinput`, `input`, `keyup` in order for `x`,
with `isTrusted=true`. This confirms browser-generated automation input; it does
not establish a physical keyboard, OS input method or mobile interaction.

| Observed quantity | Encrypted | Ordinary |
| --- | --- | --- |
| First keypress dispatch, inclusive renderer time | 6.425 ms | 13.270 ms |
| First keydown timestamp to input's next animation-frame callback | 7.9 ms | 15.7 ms |
| First keydown timestamp to generation-1 IDB transaction complete | 524.7 ms | 530.5 ms |
| Largest renderer RunTask overlapping first-key-plus-burst interval | 7.531 ms | 15.050 ms |
| Observer long tasks in retained interval | 0 | 0 |
| Final burst input timestamp to generation-11 IDB transaction complete | 519.5 ms | 508.6 ms |

After the first checkpoint, each test typed ten ASCII characters with a requested
20 ms delay per character and verified the exact final text `xabcdefghij`.
Both phases recorded generation 1 and generation 11 durable transaction
completion. Event Timing reports the first key interaction at quantized duration
16 ms encrypted / 40 ms ordinary; its thresholded entries are retained. The
animation-frame callback is before a rendering opportunity, **not proof of
completed paint**. Event Timing includes presentation delay and quantization;
dispatch duration is inclusive and must not be summed with nested dispatches.
One pair cannot establish a performance distribution or an encrypted/ordinary
difference. This small empty-body test does not replace the loaded-document,
maximum-size, sustained typing, IME, engine or physical-device gates.

Artifacts are under `.playwright-mcp/first-key-diagnostic/`: the exact measured
`first-key.spec.ts`, config and launcher; `{encrypted,ordinary}-result.json`
with raw input timestamps, Event Timing, frame callbacks, IDB commits and host
provenance; both full `*-renderer-trace.json` files; and derived `*-summary.json`.
Both traces report no data loss. Measured runner SHA-256 is
`6c1fc3ccb72eccfacceb4699cf7c94755cb34d77d34bd7ad9c48a4659bc7464d`;
manifest file SHA-256 is
`1d991f9c8b844f92d517700da22a5707637b17cc0f115d8aa0274b99fca9e476`.
The initial sandbox denied loopback PostgreSQL; setup/test/cleanup then ran with
scoped elevated execution. The owned loopback production preview was stopped;
the exact generated `eton_test_vault_rescue_259868431f0f41a7af3fd4e3d2eeb6af`
database and temporary environment file were removed. No shared data or
application source changed. This diagnostic found no blocking first-key task or
confirmed application defect requiring a remedy.
