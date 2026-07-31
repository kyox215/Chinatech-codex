---
schema_version: 1
task_id: "TASK-20260731-002-sitewide-mobile-density"
title: "全站移动端紧凑高密度布局优化"
status: "closed"
task_class: "T3"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["UX", "FE", "QA", "INT"]
created_at: "2026-07-31T00:25:26Z"
updated_at: "2026-07-31T07:12:32Z"
---
# Task — 全站移动端紧凑高密度布局优化

## Owner request

检查当前项目所有页面功能的手机端 UI，在不改变现有设计与业务行为的前提下，收紧字号、间距、控件和布局，让手机首屏能显示更多完整内容；将工作 fork 到新分支。

## Business outcome

Chinatech 员工在手机上浏览与操作 RepairDesk 时，可以更快扫读更多业务信息，减少无价值留白和滚动，同时保持现有 RepairOS 视觉语言、业务语义与桌面体验。

## Scope in

- 盘点 `src/app` 下所有可视页面及其 feature screen、共享壳、共享 UI primitive 和 overlay。
- 优先在共享 pattern/token/primitive 层建立一致的移动密度，必要时修复页面级离群点。
- 手机端收紧非交互文字、卡片 padding、section gap、列表行、弹层 header/body/footer 与导航壳。
- 保持真实输入字号至少 16px，保持主要触控区至少 44px，避免 iOS 自动缩放与可访问性退化。
- 验证关键页面在 390px、430px 及桌面基线无页面级横向溢出。
- 在分支 `codex/sitewide-mobile-density-20260731` 的独立 worktree 中实施。

## Scope out

- 不改变颜色、圆角、阴影、信息架构、路由、业务流程、字段语义、数据/API、权限或数据库。
- 不为“首屏全部显示”隐藏关键业务信息或缩小必要触控命中区。
- 不部署、不 push、不迁移生产数据，不清理当前主工作区的其他任务改动。
- 不修改打印介质样式，除非移动密度规则意外影响打印且需要隔离修复。

## Hard constraints

- 现有 RepairOS Compact / Floating Card 设计语言保持不变。
- 桌面端布局与字号不得出现可见回归；移动密度规则优先限制在 `<768px`，必要的平板规则必须单独证明。
- 不覆盖其他任务或用户改动；单一业务代码写入者为本窗口主线程。
- `document.documentElement.scrollWidth <= window.innerWidth`。

## Acceptance criteria

- [x] 可视路由清单完整，标出页面类型、共享屏幕、移动实现与离群点。
- [x] 所有共享页面壳、卡片、列表、表单、弹窗/Sheet、AppBar/Sidebar 的手机密度已检查。
- [x] 关键移动页面的首屏信息密度明显提高，且颜色、结构、动作和业务行为不变。
- [x] 真实输入控件保持至少 16px；主要触控目标保持至少 44×44px。
- [x] 320px/390px/430px 的 27 个基线路由无页面级横向溢出，底部动作不遮挡内容，弹层正文可滚动。
- [x] 768px/1024px/1280px/1440px 桌面与平板关键路由未出现密度回归。
- [x] `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` 全部通过。
- [x] 已保存 5 张移动端和 1 张桌面端代表性截图，并区分正常、错误和无权限状态。

## Facts, assumptions, unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 当前根工作区含大量其他任务改动 | observed | `git status --short --branch` | 已使用独立 worktree 隔离 |
| 新分支基线 | observed | `origin/main@dd03f778` | 已在独立 worktree 完成实施 |
| 现有项目已有 RepairOS Compact 与移动详情标准 | verified | `docs/RESPONSIVE_DENSITY_PLAN.md`, `docs/REPAIROS_MOBILE_DETAIL_STANDARD.md` | 复用，不重做设计 |
| “全部内容一眼显示”对任意长数据不可能绝对保证 | assumption | 内容长度与设备高度可变 | 解释为提高首屏密度且不隐藏关键内容 |
| 当前 E2E mock 不提供 Dashboard 正常 API 与 Finance 授权态 | verified | 最终截图分别呈现 error / unauthorized | 已明确标注状态；正常数据密度由 Order Task、Inventory、Settings 截图证明，路由级回归由自动化覆盖 |
| 并行 Buyback / Inventory 新路由任务与本分支基线不同 | verified | 路由盘点与另一 worktree 状态 | 本分支未修改其四个冲突文件；未来集成后须复审新增路由 |

## Risk and autonomy

- R2：跨全站共享样式与多个页面，潜在视觉回归面较大；不触及数据、API、权限、生产或不可逆操作。
- L2：允许可逆本地代码、测试、文档与截图；push、deploy、依赖变更和生产操作不在授权范围。
- D2：共享密度数值与页面离群修复由 Integration Lead 在现有标准内决定。
- D3/D4：若需要改变设计方向、业务信息优先级、依赖或发布，必须另行请求 Owner。

## Work packages

1. WP-01 Route and shared-surface inventory — read-only explorer.
2. WP-02 UX density and accessibility audit — read-only UX reviewer.
3. WP-03 QA viewport and regression matrix — read-only QA reviewer.
4. WP-04 Shared density implementation — Integration Lead single writer.
5. WP-05 Page outlier fixes — Integration Lead single writer after inventory.
6. WP-06 Automated gates, browser evidence, documentation and memory closeout.

## Verification and rollback

- Narrow tests after each shared primitive/pattern slice, then lint/typecheck/test/build.
- Browser overflow and screenshot checks at 390, 430, 768/834, 1024 and 1440 on representative routes.
- Rollback is branch-local reversal of the scoped density commits/files; no schema or production rollback is needed.

## Agent plan

- `project_explorer` / UX inventory / read_only: enumerate routes, screens, shared density control points and outliers.
- `ux_reviewer` / UX / read_only: define compact values within existing design and accessibility constraints.
- `qa_reviewer` / QA / read_only: map page families to representative routes, viewports, states and regression checks.
- Main thread / INT+FE / integration_write: own all code, task memory, integration and final verification.
