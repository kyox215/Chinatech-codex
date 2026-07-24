# Evidence Index — TASK-20260724-007-in-page-pdf-print

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-24T11:22:54Z | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-24T11:38:48Z` `215961a41f` — 11 related unit tests passed；Chromium four-mode E2E passed with popupCount=0；local Chrome only retained the original /orders tab；lint/typecheck/webpack build passed；screenshot screenshots/TASK-20260724-007-in-page-pdf-print/current-page-progress.png。
- `2026-07-24T11:41:13Z` `e274dbee28` — Chromium E2E 1 passed: popupCount=0，四种 PDF MediaBox 均匹配；unit 11 passed；lint/typecheck/build passed；local Chrome only one /orders tab；progress screenshot available。
- `2026-07-24T11:42:31Z` `da0cedcb47` — git diff --check passed；final E2E/unit/lint/typecheck/build results recorded in prior checkpoint。
- `2026-07-24T11:53:00Z` `5a47ba82d0` — lint、typecheck、fixed-order-pdf unit tests、webpack build 均通过；Chromium 四模式 E2E 19.0s 通过且无可见 popup；optimized-a5.pdf 为单页 A5 landscape 595.276x419.528pt，渲染 PNG 人工检查无裁切/模糊，文件 186697 bytes。
- `2026-07-24T12:00:58Z` `aed771cde7` — 最终 lint/typecheck/2 unit tests/webpack build 通过；Chromium 与 WebKit 四模式 E2E 均通过且无可见 popup；最终 A5 PDF 单页 595.276x419.528pt、164832 bytes，180dpi PNG 人工检查文字、边界、二维码均清晰且无裁切。
- `2026-07-24T12:01:44Z` `59827ab560` — git diff --check passed；最终 A5 PDF 为单页 595.276x419.528pt、175042 bytes；Chromium/WebKit 四模式 E2E、lint、typecheck、unit、webpack build 均通过。
- `2026-07-24T12:54:53Z` `0db1164669` — Chromium 390/430 mobile E2E 2 passed；WebKit 390/430 mobile E2E 2 passed；Chromium desktop four-mode E2E passed；最终 A5 PDF 595.276x419.528pt、263771 bytes，300dpi 渲染人工检查小字和二维码清晰无裁切；lint/typecheck/related unit passed。
