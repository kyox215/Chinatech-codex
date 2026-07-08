# Checkpoints — TASK-20260707-010-buyback-series-order

## 2026-07-07T19:08:43Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-07T19:08:56Z — Fixed the buyback quote iPhone series picker so series cards render row-major from newest to oldest. src/features/buyback/components/buyback-quote-workspace.tsx no longer uses column-flow two-row grid; it uses 2 columns on small screens and 4 columns on desktop. src/features/buyback/model/apple-price-guide.test.ts now asserts the canonical newest-to-oldest series labels.

- **Phase:** implemented_verified
- **Completed/current state:** Fixed the buyback quote iPhone series picker so series cards render row-major from newest to oldest. src/features/buyback/components/buyback-quote-workspace.tsx no longer uses column-flow two-row grid; it uses 2 columns on small screens and 4 columns on desktop. src/features/buyback/model/apple-price-guide.test.ts now asserts the canonical newest-to-oldest series labels.
- **Next:** If owner asks to ship this batch, stage only the intended buyback files plus any explicitly approved prior UI files; keep unrelated dirty governance memory and tenant-isolation work out of the commit unless separately approved.
- **Decision:** Fix belongs in layout CSS plus model-order test; no data/model reordering was needed because getAppleIPhoneSeriesGroups already returns newest-to-oldest order.
- **Evidence:**
  - npx eslint src/features/buyback/components/buyback-quote-workspace.tsx src/features/buyback/model/apple-price-guide.test.ts passed.
  - npx vitest run src/features/buyback/model/apple-price-guide.test.ts passed: 1 file, 10 tests.
  - git diff --check -- src/features/buyback/components/buyback-quote-workspace.tsx src/features/buyback/model/apple-price-guide.test.ts passed.
  - npm run typecheck passed.
  - npm run test passed: 82 files, 531 tests.
  - npm run build failed inside sandbox due Turbopack port-binding permission, then passed outside sandbox with approval.
  - In-app browser at http://localhost:3012/buyback?new=1 verified row1 [17 / Air, 16 / 16e, 15, 14], row2 [13, 12, 11 / SE, X / 8], scrollWidth 1280 equals innerWidth 1280.
  - Visual evidence saved at /private/tmp/repairdesk-buyback-series-full-20260707.png.
- **Recorded by:** CEO-Orchestrator
