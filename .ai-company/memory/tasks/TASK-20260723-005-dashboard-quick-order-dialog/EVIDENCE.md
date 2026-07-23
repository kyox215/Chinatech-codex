# Evidence Index — TASK-20260723-005-dashboard-quick-order-dialog

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-23T20:20:59Z | CEO-Orchestrator |
| E-002 | implementation | 概览与工单列表复用同一弹窗 | `src/features/orders/components/new-order-dialog.tsx`; dashboard/order list screens | implemented | 2026-07-23T22:55:00Z | IntegrationLead |
| E-003 | unit test | 共享入口及修饰键回退行为 | `npm run test -- dashboard-quick-start.test.tsx new-order-intent.test.ts cache-sync.test.ts` | 11 passed | 2026-07-23T22:55:00Z | IntegrationLead |
| E-004 | full test | 全量 Vitest 回归 | `npm run test` | 342 files / 2283 tests passed | 2026-07-23T22:55:00Z | IntegrationLead |
| E-005 | build | Next.js 生产构建 | `npm run build` | passed | 2026-07-23T22:55:00Z | IntegrationLead |
| E-006 | browser | 双视口弹窗行为及无溢出 | `tests/e2e/dashboard-quick-start.spec.ts` dedicated dialog test | 2 passed | 2026-07-23T22:55:00Z | IntegrationLead |
| E-007 | visual | 手机最终页面 | `screenshots/TASK-20260723-005-dashboard-quick-order-dialog/dashboard-quick-order-dialog-390.png` | inspected | 2026-07-23T22:55:00Z | IntegrationLead |
| E-008 | visual | 桌面最终页面 | `screenshots/TASK-20260723-005-dashboard-quick-order-dialog/dashboard-quick-order-dialog-1440.png` | inspected | 2026-07-23T22:55:00Z | IntegrationLead |
| E-009 | report | 关联逻辑问题及后续建议 | `REPORT.md` | recorded | 2026-07-23T22:55:00Z | IntegrationLead |
| E-010 | quality gate | 最终 lint、typecheck 与空白错误检查 | `npm run lint`; `npm run typecheck`; `git diff --check` | passed | 2026-07-23T20:59:00Z | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-23T20:44:10Z` `6db9b85f87` — .ai-company/memory/tasks/TASK-20260723-005-dashboard-quick-order-dialog/REPORT.md; screenshots/TASK-20260723-005-dashboard-quick-order-dialog/
- `2026-07-23T20:44:56Z` `2531470f58` — .ai-company/memory/tasks/TASK-20260723-005-dashboard-quick-order-dialog/EVIDENCE.md
