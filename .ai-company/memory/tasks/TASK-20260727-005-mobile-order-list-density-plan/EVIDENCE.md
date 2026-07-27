# Evidence Index — TASK-20260727-005-mobile-order-list-density-plan

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-27T02:14:34Z | CEO-Orchestrator |
| E-002 | code | 有界流体密度 token 与四列两行队列已实现 | `src/features/orders/components/order-list-layout.ts`, `order-list-mobile-header.tsx` | reviewed | 2026-07-27T04:33:15Z | IntegrationLead |
| E-003 | code | 分组标题、订单卡和骨架屏已压缩且保留风险语义 | `order-result-group-header.tsx`, `order-list-items.tsx`, `order-list-skeleton.tsx` | reviewed | 2026-07-27T04:33:15Z | IntegrationLead |
| E-004 | unit | 全量 Vitest | 361 files / 2,405 tests | passed | 2026-07-27T04:33:15Z | IntegrationLead |
| E-005 | static | ESLint、TypeScript、production build | full repository | passed | 2026-07-27T04:33:15Z | IntegrationLead |
| E-006 | e2e | Chromium 与 WebKit 移动端专项 | `tests/e2e/orders-mobile-queue-loading.spec.ts` | 3/3 each passed | 2026-07-27T04:33:15Z | IntegrationLead |
| E-007 | visual | 320/375/390/393/402/430/440px 最终页面与 390px loading | `screenshots/TASK-20260727-005-mobile-order-list-density/` | inspected | 2026-07-27T04:33:15Z | IntegrationLead |
| E-008 | git | 独立分支发布且本地/远端 SHA 一致 | `agent/mobile-order-list-fluid-density`, `git ls-remote` | `b73be2cab6c869d7830f709d6a7fdc7cb67c9504` | 2026-07-27T04:38:30Z | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-27T02:33:06Z` `6b1b8139b4` — Owner 截图；order-list-mobile-header.tsx；order-list-layout.ts；order-list-items.tsx；order-result-group-header.tsx；order-list-skeleton.tsx；orders-mobile-queue-loading.spec.ts；UX 与产品只读复核。

## Documentation impact matrix

| Audience | Impact | Result |
|---|---|---|
| Mobile shop staff | 工单列表同屏可见更多条目 | 由最终截图和 E2E 覆盖 |
| Developers | 响应式实现继续遵循既有 RepairOS compact / responsive declarations | 无新增公共 API、配置、依赖或运行命令，权威文档无需改写 |
| QA/support | 增加 7 档宽度、加载/离线/失败和触控尺寸自动验收 | 测试文件即稳定可执行规范 |

## Acceptance matrix

| Gate | Result | Evidence |
|---|---|---|
| UI/UX contract | PASS | E-002, E-003, E-007 |
| Accessibility and finance redaction | PASS | E-003, E-004, E-006 |
| Responsive/browser matrix | PASS | E-006, E-007 |
| Full regression/build | PASS | E-004, E-005 |
| Branch isolation/publication | PASS | E-008 |
| Security/data/migration | N/A | no auth, API, database, permission, dependency, secret or production changes |
- `2026-07-27T04:34:13Z` `8f570304cc` — EVIDENCE.md；src/features/orders/components/order-list-layout.ts；order-list-mobile-header.tsx；order-list-items.tsx；tests/e2e/orders-mobile-queue-loading.spec.ts；screenshots/TASK-20260727-005-mobile-order-list-density/
- `2026-07-27T04:37:23Z` `45d9aefd71` — 远端分支 agent/mobile-order-list-fluid-density；commit b73be2cab6c869d7830f709d6a7fdc7cb67c9504；EVIDENCE.md；screenshots/TASK-20260727-005-mobile-order-list-density/
