# Evidence Index — TASK-20260723-006-order-entry-unification

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-23T20:55:07Z | CEO-Orchestrator |
| E-002 | implementation | 统一 URL 构造、解析与清理 | `src/features/orders/model/order-workspace-intent.ts` | implemented | 2026-07-23T23:16:00+02:00 | IntegrationLead |
| E-003 | implementation | 工单列表恢复共享新建和详情弹窗 | `src/features/orders/screens/order-list-screen.tsx` | implemented | 2026-07-23T23:16:00+02:00 | IntegrationLead |
| E-004 | audit | 跨模块入口与保留例外矩阵 | `REPORT.md` | recorded | 2026-07-23T23:16:00+02:00 | IntegrationLead |
| E-005 | unit | 工作区意图及关联入口测试 | targeted Vitest | 73 passed, later 51 passed after expectation sync | 2026-07-23T23:16:00+02:00 | IntegrationLead |
| E-006 | regression | 最终全量 Vitest | `npm run test` | 343 files / 2292 tests passed | 2026-07-23T23:19:00+02:00 | IntegrationLead |
| E-007 | static | 最终 lint 与 typecheck | `npm run lint`; `npm run typecheck` | passed | 2026-07-23T23:19:00+02:00 | IntegrationLead |
| E-008 | build | Next.js production build | `npm run build` | passed | 2026-07-23T23:16:00+02:00 | IntegrationLead |
| E-009 | e2e | 双视口工作区恢复、关闭和溢出 | `tests/e2e/order-workspace-entry-unification.spec.ts` | 2 passed | 2026-07-23T23:16:00+02:00 | IntegrationLead |
| E-010 | visual | 新建与详情手机/桌面截图 | `screenshots/TASK-20260723-006-order-entry-unification/` | 4 inspected | 2026-07-23T23:16:00+02:00 | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-23T21:19:42Z` `b7f2797107` — .ai-company/memory/tasks/TASK-20260723-006-order-entry-unification/REPORT.md; screenshots/TASK-20260723-006-order-entry-unification/; npm run lint/typecheck/test/build; Playwright 2 passed
- `2026-07-23T21:21:01Z` `a9250680f0` — .ai-company/memory/tasks/TASK-20260723-006-order-entry-unification/EVIDENCE.md; REPORT.md; MEMORY_DELTA.md
