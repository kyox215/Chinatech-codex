# Evidence — TASK-20260719-004-ai-processing-mode-usage

## Conclusion

The Owner approved the scoped production release. The combined candidate is implementation-complete and quality-gated; inline chat usage is now included. Push/deployment and production smoke are the remaining release steps. No production configuration, secret, schema, migration, or production data change is part of this release.

## Acceptance matrix

| Acceptance item                                  | Result | Evidence                                                                                                        |
| ------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------- |
| Explicit local/model choice                      | PASS   | `ai-assistant-sheet.tsx`; component tests; 390px and 1280px screenshots                                         |
| Local mode never silently upgrades               | PASS   | service tests prove supported local queries use no provider/budget and unknown text returns clarification       |
| Model mode uses controlled provider path         | PASS   | service tests prove deterministic shortcut is bypassed and provider/budget/audit receive `processingMode=model` |
| Strict request contract and legacy compatibility | PASS   | contract tests accept `local/model`, reject unknown values, and preserve omitted mode                           |
| Store-scoped usage permission                    | PASS   | route/repository tests enforce `finance:aggregate_read` and derive `storeId` from the actor                     |
| Aggregate-only usage response                    | PASS   | today/30-day request, Token, cost and category metrics; no prompt, response, customer or order content          |
| UI states                                        | PASS   | normal, loading, error/retry, zero usage and in-flight reservation states covered by component tests            |
| Inline chat usage                                | PASS   | current-store `order_text` request/limit, total Token and settled estimate share the settings query/cache       |
| Unauthorized usage suppression                   | PASS   | provider test proves no usage request without `finance:aggregate_read`; server permission remains authoritative |
| Refresh and failure isolation                    | PASS   | model success invalidates the current-store usage key; local success does not; usage failure leaves chat usable |
| Responsive and visible result                    | PASS   | no horizontal overflow at 390px or 1280px; compact chat usage screenshots verified visually                     |

## Verification results

- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- Targeted Vitest — PASS, 4 files and 23 tests for chat usage, provider permission/cache behavior, settings and query keys.
- `npm run test` — PASS, 309 test files and 1,972 tests.
- `npx next build --webpack` — PASS, production compilation, TypeScript, 26 static pages and route collection completed.
- `npm run build` with Turbopack — environment-only FAIL because the isolated worktree intentionally symlinks `node_modules` outside the Turbopack filesystem root; the Webpack production build above is green.
- Targeted Playwright — PASS, 2/2: processing-mode payload/visual flow and current-store usage/settings flow.
- AI assistant Playwright regression — PASS, 10/10 scenarios with explicit test feature flags, including Apple 15 relevance, processing payload, usage refresh and 390/430px overflow.
- Manual in-app browser verification — model selection submitted successfully, usage page returned mock aggregate data, and browser error logs were empty.

## Visual evidence

- `screenshots/TASK-20260719-004-ai-processing-mode-usage/ai-mode-mobile-390.png` — mobile composer, model selected.
- `screenshots/TASK-20260719-004-ai-processing-mode-usage/ai-mode-desktop-1280.png` — desktop composer, model selected.
- `screenshots/TASK-20260719-004-ai-processing-mode-usage/ai-chat-usage-mobile-390.png` — inline current-store usage at 390px.
- `screenshots/TASK-20260719-004-ai-processing-mode-usage/ai-chat-usage-desktop-1280.png` — inline current-store usage in the desktop sheet.
- `screenshots/TASK-20260719-004-ai-processing-mode-usage/ai-usage-settings-mobile-390.png` — current-store AI usage dashboard.

All screenshot data is synthetic E2E data; no production PII or secrets are present.

## Security and data review

- The client sends only `processing_mode`; it cannot send a store ID, model, price, budget, key, or Safety ID.
- The usage API requires `finance:aggregate_read`, scopes service-role reads to `actor.storeId`, and returns private `no-store` responses.
- The chat usage query is disabled until the sheet is open, a current store exists, and `canReadAggregateFinance === true`; it never adds a client-controlled store parameter.
- Usage data comes from existing `ai_assistant_usage_buckets` `store_day` rows and contains aggregates only.
- Local mode does not call the provider or reserve paid quota. Model mode retains all existing outbound-data, quota, budget and audit gates.
- The existing local OpenAI key was not displayed, copied, changed, or written to task evidence.
- No migration is required.

## Documentation impact matrix

| Reader              | Authoritative document                 | Result                                                                                      |
| ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| Product/support     | AI composer and Settings copy          | Updated in code; local is default and both inline/settings usage are read-only              |
| Developers/security | `docs/AI_ASSISTANT_COST_GOVERNANCE.md` | Updated with mode semantics, API permission/scope and estimate caveat                       |
| Database/operations | Existing cost-governance document      | No schema/runbook change; existing ledger is reused                                         |
| Release owner       | This task evidence and checkpoint      | Owner approved the scoped push/deploy; exact-SHA production evidence remains to be appended |

No other public API, migration, environment template, installation guide, or operational runbook requires an update for this candidate.

## Rollback

Revert the scoped candidate commit. Because there is no migration or production mutation, rollback is code-only; existing usage ledger data remains untouched.

- `2026-07-19T10:10:23Z` `541e1aea4b` — lint 与 typecheck 通过；Vitest 308 文件、1966 项通过。
- `2026-07-19T10:10:23Z` `ae278e42e9` — Webpack 生产构建通过；Turbopack 仅因隔离 worktree 的 node_modules 外部软链接受限。
- `2026-07-19T10:10:23Z` `a09be85e2b` — 核心 Playwright 2/2 通过，AI 10 个场景均逐项通过；390px/1280px/设置用量截图已保存。
- `2026-07-19T10:10:23Z` `a62a4c5812` — 未新增 migration，未修改密钥、生产配置或生产数据。
- `2026-07-19T11:00:59Z` `4cee7f3efe` — lint/typecheck/build 通过；Vitest 309 文件 1972 项；AI Playwright 10/10；390px/1280px 对话用量截图已视觉复核。
