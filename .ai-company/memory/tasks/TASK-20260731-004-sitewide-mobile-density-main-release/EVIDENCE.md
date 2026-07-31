# Evidence Index — TASK-20260731-004-sitewide-mobile-density-main-release

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-31T08:21:48Z | IntegrationLead |
| E-002 | registry | 当前窗口持有有效 integration lease | Registry status: `WINDOW-019FB58E-SITEWIDE-MAIN-RELEASE` v1, expires `2026-07-31T09:25:07Z` | PASS | 2026-07-31T08:34:00Z | IntegrationLead |
| E-003 | integration | `origin/main@a9e6db44` 并入 feature 工作树且无文本冲突 | `git merge --no-ff --no-commit origin/main`; `git diff --cached --check` | PASS | 2026-07-31T08:25:00Z | IntegrationLead |
| E-004 | reviewer | 发布拓扑、回滚与观测方案独立复核 | Release Reviewer：CONDITIONAL GO；正确回滚为 `git revert -m 2 <merge_sha>` | PASS with gates pending | 2026-07-31T08:26:00Z | Release Reviewer |
| E-005 | static | 合并树 lint、typecheck、Vitest | `npm run lint`; `npm run typecheck`; `npm run test` | PASS，376 files / 2465 tests | 2026-07-31T08:28:00Z | IntegrationLead |
| E-006 | build | 合并树 production build | `npm run build`（允许 Google Fonts 网络） | PASS，28/28 static pages | 2026-07-31T08:29:00Z | IntegrationLead |
| E-007 | browser | 主线新订单故障选项与触控滚动组合回归 | Chromium `new-order-mobile-dropdown-scroll.spec.ts`，390×844 | PASS，1/1 | 2026-07-31T08:33:00Z | IntegrationLead |
| E-008 | hygiene | Next 构建生成的 `next-env.d.ts` 漂移已排除 | 恢复为 `./.next/types/routes.d.ts`; `git status --short` | PASS | 2026-07-31T08:33:00Z | IntegrationLead |
| E-009 | qa | 独立 QA 合并前风险矩阵 | lint/type/build、376/2462、Chromium 13/13、WebKit 8 PASS/1 intentional skip；最终 merge SHA 仍需门禁 | CONDITIONAL PASS | 2026-07-31T08:34:00Z | QA Reviewer |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
