# Evidence Index — TASK-20260707-010-buyback-series-order

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-07T19:08:43Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-07T19:08:56Z` `6df32e8773` — npx eslint src/features/buyback/components/buyback-quote-workspace.tsx src/features/buyback/model/apple-price-guide.test.ts passed.
- `2026-07-07T19:08:56Z` `23b0c40329` — npx vitest run src/features/buyback/model/apple-price-guide.test.ts passed: 1 file, 10 tests.
- `2026-07-07T19:08:56Z` `8b3153f24e` — git diff --check -- src/features/buyback/components/buyback-quote-workspace.tsx src/features/buyback/model/apple-price-guide.test.ts passed.
- `2026-07-07T19:08:56Z` `a115cbcc4d` — npm run typecheck passed.
- `2026-07-07T19:08:56Z` `f4df2a863a` — npm run test passed: 82 files, 531 tests.
- `2026-07-07T19:08:56Z` `dbe7944501` — npm run build failed inside sandbox due Turbopack port-binding permission, then passed outside sandbox with approval.
- `2026-07-07T19:08:56Z` `c98414c650` — In-app browser at http://localhost:3012/buyback?new=1 verified row1 [17 / Air, 16 / 16e, 15, 14], row2 [13, 12, 11 / SE, X / 8], scrollWidth 1280 equals innerWidth 1280.
- `2026-07-07T19:08:56Z` `5a25ee02f1` — Visual evidence saved at /private/tmp/repairdesk-buyback-series-full-20260707.png.
