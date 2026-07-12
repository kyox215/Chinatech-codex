---
schema_version: 1
task_id: "TASK-20260712-002-mobile-interaction-click-reliability"
title: "移动端点击失效与全项目同类交互修复"
status: "closed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["INT", "UX", "FE", "QA"]
created_at: "2026-07-12T01:03:34Z"
updated_at: "2026-07-12T07:56:21Z"
---

# Task — 移动端点击失效与全项目同类交互修复

## Owner request

账号中心页面很多区域点击没有反应，例如左上角菜单键；检查所有相关逻辑并修复，确保项目没有类似问题。

## Business value

恢复门店人员在手机上可靠打开导航和操作账号页面的能力，并通过共享外壳审计与回归测试防止相同的点击拦截问题出现在其它业务页面。

## Scope in

- 在 390px 和 430px 移动视口复现账号中心的菜单及页面交互问题。
- 追踪 `AppBar` 菜单触发器、`SidebarProvider`、移动侧栏 Sheet/overlay 和账号中心交互状态。
- 检查共享应用外壳、overlay、z-index、`pointer-events`、disabled/pending 状态、触控目标和语义按钮是否会拦截点击。
- 对账号中心和共享壳的根因做最小修复，并补充能防止回归的自动测试。
- 在代表性高频页面验证共享菜单与基础交互没有同类问题。

## Scope out

- 不改变账号权限、密码策略、Supabase Auth 行为、数据库结构或生产数据。
- 不自动部署、提交或推送。
- 不顺便重构无关页面或修复与点击可靠性无关的视觉问题。

## Hard constraints

- 当前工作区包含多项既有未提交改动；只修改本任务所需文件，不覆盖或回滚无关变化。
- 子代理保持只读；主线程是唯一写入者和最终集成负责人。
- 不发送真实密码重置邮件，不在截图或日志中暴露账号、凭据或客户 PII。
- 若根因涉及生产配置、认证权限或不可逆动作，暂停并重新分级。

## Acceptance criteria

- [x] 账号中心在 390x844、430x932 下点击左上菜单能稳定打开和关闭移动侧栏。
- [x] 账号中心可交互控件按设计响应；disabled/pending 状态有可解释条件，不出现透明层或错误层级吞掉点击。
- [x] 共享 AppBar/Sidebar/overlay 逻辑在代表性页面通过移动交互回归。
- [x] 全局相关静态扫描完成，高风险同类模式已修复或明确记录为不适用/后续项。
- [x] 新增或更新自动化测试覆盖本次根因，并通过 lint、typecheck、完整单 worker test、build。
- [x] 保存脱敏移动端截图和实际浏览器交互证据。

## Facts, assumptions, and unknowns

| Item                                                                                                | Type     | Evidence                                                                                                     | Status / next action                                                                      |
| --------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Screenshot route is the account center                                                              | observed | owner screenshot; `src/features/account/screens/account-center-screen.tsx`                                   | verify route and shell at runtime                                                         |
| Account screen already has uncommitted changes from TASK-20260710-011                               | observed | `git status`; predecessor task memory                                                                        | preserve and build on current file                                                        |
| Shared worktree is dirty and main is behind origin                                                  | observed | `git status --short --branch`                                                                                | do not stage, pull, reset, or overwrite                                                   |
| Nested Radix modal layers leave `body.style.pointerEvents = "none"` after mobile sidebar navigation | verified | pre-fix Playwright reproduction; `AppSidebar` Sheet + footer `DropdownMenu`; post-fix Chromium/WebKit checks | fixed by assigning mobile modality to the outer Sheet only                                |
| Direct main release                                                                                 | verified | Owner said `推送main`; remote hash verification                                                              | feature commit `74f83285` is confirmed on `origin/main`; deployment status is not claimed |

## Risk and autonomy

- **R3:** direct `main` release can trigger external CI or Git-connected deployment; no data, permission, payment, secret, dependency, or migration change is included.
- **L2:** local, reversible code/test/documentation changes and non-destructive verification are allowed.
- **Reserved decisions:** deployment, production auth/data changes, destructive cleanup, dependency or architecture change.

## Agent plan

- UX/FE reviewer, read-only: trace menu/sidebar/account hit-testing and interaction state.
- Project explorer, read-only: audit shared/static click-risk patterns across the repository.
- QA reviewer, read-only: map regression coverage, reproduce representative paths, and define verification matrix.
- Integration Lead, integration-write: arbitrate findings, apply the only code changes, run final gates, record screenshots.

## Work packages

1. Rehydrate related mobile/account context and freeze the dirty-worktree baseline.
2. Reproduce and isolate the event/hit-testing root cause.
3. Audit related shared interaction patterns and existing tests.
4. Apply the smallest compatible fix and regression tests.
5. Run targeted browser checks, representative-route checks, full quality gates, and visual evidence capture.
6. Review the scoped diff, synchronize task memory, and close or conditionally close.

## Rollback

Revert only the task-owned hunks/files identified in `EVIDENCE.md`; do not reset the shared worktree or predecessor account-center changes.

## Definition of done

Acceptance criteria have direct code, test, browser, and screenshot evidence; residual risk and any untested environment are explicit.

## Release state

The Owner-authorized release is complete. Commit `74f832852739929014fe2edfd0543558ad4f5cbe` was pushed fast-forward to `origin/main` and independently confirmed with `git ls-remote`; rollback point is `c48aef21`. CI or external deployment completion was not verified in this run.
