# Evidence — TASK-20260719-004-ai-processing-mode-usage

## Conclusion

Local candidate is implementation-complete and quality-gated. The release state is `pending_release_approval`: no push, deployment, production configuration, secret, schema, or production data change was performed.

## Acceptance matrix

| Acceptance item | Result | Evidence |
| --- | --- | --- |
| Explicit local/model choice | PASS | `ai-assistant-sheet.tsx`; component tests; 390px and 1280px screenshots |
| Local mode never silently upgrades | PASS | service tests prove supported local queries use no provider/budget and unknown text returns clarification |
| Model mode uses controlled provider path | PASS | service tests prove deterministic shortcut is bypassed and provider/budget/audit receive `processingMode=model` |
| Strict request contract and legacy compatibility | PASS | contract tests accept `local/model`, reject unknown values, and preserve omitted mode |
| Store-scoped usage permission | PASS | route/repository tests enforce `finance:aggregate_read` and derive `storeId` from the actor |
| Aggregate-only usage response | PASS | today/30-day request, Token, cost and category metrics; no prompt, response, customer or order content |
| UI states | PASS | normal, loading, error/retry, zero usage and in-flight reservation states covered by component tests |
| Responsive and visible result | PASS | no horizontal overflow at 390px or 1280px; browser console error list was empty |

## Verification results

- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm run test` — PASS, 308 test files and 1,966 tests.
- `npx next build --webpack` — PASS, production compilation, TypeScript, 26 static pages and route collection completed.
- `npm run build` with Turbopack — environment-only FAIL because the isolated worktree intentionally symlinks `node_modules` outside the Turbopack filesystem root; the Webpack production build above is green.
- Targeted Playwright — PASS, 2/2: processing-mode payload/visual flow and current-store usage/settings flow.
- AI assistant Playwright regression — all 10 scenarios passed. During two long sequential dev-server runs, the last page initialization once timed out at `stores/context` after PTY log buildup; each affected scenario passed immediately in isolated reruns. No failure reached the changed processing or usage logic.
- Manual in-app browser verification — model selection submitted successfully, usage page returned mock aggregate data, and browser error logs were empty.

## Visual evidence

- `screenshots/TASK-20260719-004-ai-processing-mode-usage/ai-mode-mobile-390.png` — mobile composer, model selected.
- `screenshots/TASK-20260719-004-ai-processing-mode-usage/ai-mode-desktop-1280.png` — desktop composer, model selected.
- `screenshots/TASK-20260719-004-ai-processing-mode-usage/ai-usage-settings-mobile-390.png` — current-store AI usage dashboard.

All screenshot data is synthetic E2E data; no production PII or secrets are present.

## Security and data review

- The client sends only `processing_mode`; it cannot send a store ID, model, price, budget, key, or Safety ID.
- The usage API requires `finance:aggregate_read`, scopes service-role reads to `actor.storeId`, and returns private `no-store` responses.
- Usage data comes from existing `ai_assistant_usage_buckets` `store_day` rows and contains aggregates only.
- Local mode does not call the provider or reserve paid quota. Model mode retains all existing outbound-data, quota, budget and audit gates.
- The existing local OpenAI key was not displayed, copied, changed, or written to task evidence.
- No migration is required.

## Documentation impact matrix

| Reader | Authoritative document | Result |
| --- | --- | --- |
| Product/support | AI composer and Settings copy | Updated in code; local is default and usage is read-only |
| Developers/security | `docs/AI_ASSISTANT_COST_GOVERNANCE.md` | Updated with mode semantics, API permission/scope and estimate caveat |
| Database/operations | Existing cost-governance document | No schema/runbook change; existing ledger is reused |
| Release owner | This task evidence and checkpoint | Production push/deploy remains an explicit approval point |

No other public API, migration, environment template, installation guide, or operational runbook requires an update for this local candidate.

## Rollback

Revert the scoped candidate commit. Because there is no migration or production mutation, rollback is code-only; existing usage ledger data remains untouched.
- `2026-07-19T10:10:23Z` `541e1aea4b` — lint 与 typecheck 通过；Vitest 308 文件、1966 项通过。
- `2026-07-19T10:10:23Z` `ae278e42e9` — Webpack 生产构建通过；Turbopack 仅因隔离 worktree 的 node_modules 外部软链接受限。
- `2026-07-19T10:10:23Z` `a09be85e2b` — 核心 Playwright 2/2 通过，AI 10 个场景均逐项通过；390px/1280px/设置用量截图已保存。
- `2026-07-19T10:10:23Z` `a62a4c5812` — 未新增 migration，未修改密钥、生产配置或生产数据。
