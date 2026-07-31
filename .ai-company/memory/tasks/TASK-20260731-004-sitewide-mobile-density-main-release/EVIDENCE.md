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
| E-010 | git | 精确发布候选与父提交拓扑 | merge `481f6b301aec3bbff6a4cf9b5986704bdb01ae2c`; parents `cf594862`, `a9e6db44` | PASS | 2026-07-31T08:35:00Z | IntegrationLead |
| E-011 | quality | 精确 merge SHA 完整静态门禁 | lint、typecheck、376/2465 Vitest、production build 28/28 | PASS | 2026-07-31T08:36:00Z | IntegrationLead |
| E-012 | browser | 精确 merge SHA Chromium 完整响应式与订单组合回归 | `visual-overflow.spec.ts` + `new-order-mobile-dropdown-scroll.spec.ts` | PASS，14/14 | 2026-07-31T08:42:00Z | IntegrationLead |
| E-013 | browser | 精确 merge SHA WebKit 320/390/430 手机矩阵 | `visual-overflow.spec.ts`, mobile interactions | PASS，8 passed / 1 intentional skip；开发服务器快速导航有既知非阻断 ECONNRESET | 2026-07-31T08:41:00Z | IntegrationLead |
| E-014 | preview | exact-SHA Vercel Preview | `dpl_CC3cZAHBwYwQR7QbCNFdLv1QhCq5`; logs: branch `codex/sitewide-mobile-density-20260731`, commit `481f6b3`; HTTP `/login` 200 | READY | 2026-07-31T08:44:48Z | IntegrationLead |
| E-015 | release | 非强制更新远端 main 且源分支一致 | `git push origin HEAD:main`; `ls-remote` 两分支均 `481f6b301aec...` | PASS | 2026-07-31T08:46:00Z | IntegrationLead |
| E-016 | production | exact-SHA Vercel Production | `dpl_EkmWkyxPjuuur4TPktSPZeyyy9Sa`; logs: branch `main`, commit `481f6b3`; `chinatech.in` alias verified | READY | 2026-07-31T08:49:00Z | IntegrationLead |
| E-017 | production-smoke | 390×844 生产登录页 | `https://www.chinatech.in/login`; title `登录 — RepairDesk`; `innerWidth=390`, `scrollWidth=390`, console errors `[]` | PASS | 2026-07-31T08:49:00Z | IntegrationLead |
| E-018 | screenshot | 生产视觉证据 | `/Users/kyox215/.codex/visualizations/2026/07/31/019fb58e-87bc-7631-bae9-3e337c5ea8e9/vercel-production-main-login-390x844.png` | PASS | 2026-07-31T08:49:00Z | IntegrationLead |
| E-019 | observability | 新 Production runtime error/500 检查 | `vercel logs dpl_Ekm... --since 15m --level error`; `--status-code 500` | 无日志命中 | 2026-07-31T08:50:00Z | IntegrationLead |
| E-020 | rollback | 发布前恢复点 | Git `a9e6db44`; Production `dpl_Bh3cfwETZNUD7ZHV752nPicta1Cy`; release revert `git revert -m 2 481f6b30` | VERIFIED | 2026-07-31T08:50:00Z | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-31T08:51:27Z` `b12802a457` — E-010至E-020
