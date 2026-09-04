---
schema_version: 1
task_id: "TASK-20260904-001-mobile-overflow-audit-fix"
title: "修复移动端首页概览文字溢出并有界排查页面布局"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "Hexiang Huang / Owner"
departments: ["DOC", "FE", "INT", "QA", "UX"]
created_at: "2026-09-04T11:38:31Z"
updated_at: "2026-09-04T11:53:01Z"
closed_at: "2026-09-04T11:53:01Z"
---
# Task — 修复移动端首页概览文字溢出并有界排查页面布局

## Owner request

修复移动端首页“概览”附近文字溢出，然后对现有网站做一次有界的文字/布局溢出排查，修复当前验收范围内的问题并交付中文报告。

## Business value

保证维修店员工在小屏设备上查看首页概览及代表性页面时文字、控件和布局完整可用

## Scope in

- Canonical root 中现有网站的移动端文本横向溢出、非预期截断或与控件重叠。
- 第一批：首页 `/` 的移动端“概览”及相邻快捷操作、交接指标、优先筛选区。
- 第二至四批：按页面族选取最多 3–4 组代表页面，检查 320px 与 375px 并记录通过/发现/修复。
- 仅修改能直接证明为本轮移动端验收所需的现有 UI、响应式类和配套定向测试。
- 输出任务记忆下的中文排查与验证报告。

## Scope out

- 业务逻辑、权限、API、数据模型、schema/migration、语言文案内容、桌面端视觉风格和无关重构。
- 非本轮复现证据直接支持的 P2/P3 相邻问题；只在报告登记。
- commit、push、deploy、远程 SQL、生产迁移、外部写入或破坏性操作。
- 未经证实的全站无界扩展扫描。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- 单一主线写入者；不删除、回滚或纳入现有无关 untracked 目录。
- Chromium 单 worker、无重试；不做 WebKit 批量、trace/video 或手工截图循环。
- 首页关键视觉证据最多修复前/后各一次，且使用脱敏/安全测试状态。
- 连续两组代表页无需源码修改时停止扩展排查。

## Acceptance criteria

- [x] 320px 与 375px 首页概览无页面级横向溢出、文字截断异常或控件重叠
- [x] 其它代表性页面族按最多 3-4 组记录通过、发现与修复结果
- [x] 仅执行本地最小 UI/样式改动，不改业务逻辑、数据、权限、翻译文案且不 commit/push/deploy
- [x] 完成定向 lint/type/test 与 Chromium 单 worker 移动端检查并提供关键截图和中文报告

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| 上一 i18n 任务已关闭，Registry 无开放 task/run | observed | `orchestrator doctor/status` | 可建立独立任务 |
| 当前分支为 `main` 且与 `origin/main` 同步 | observed | `git status --short --branch` | 保留无关 untracked 项 |
| 首页具体溢出元素 | observed / fixed | 320px 意大利语几何与前后截图 | 三个快捷操作标题限制在卡片内并单行省略 |

## Decision and approval points

- 决策：T2 / R2 / L2，仅限可逆的本地响应式 UI 修复。
- 外部资料不是本轮必需；以项目响应式合同和现有实现为事实源。
- 不使用子代理：老板未要求多代理，当前工作包需单一共享工作树写入者，且开发者指令禁止未经明确要求的主动分派。UX/FE/QA 由主线顺序执行。

## Work packages

1. WP-01 首页基线与最小修复：320/375px 复现，定位概览相关 DOM/class，修复并定向验证。
2. WP-02 代表页组 A：工单列表/详情，检查并仅修当前验收的溢出。
3. WP-03 代表页组 B：客户/库存列表，记录通过或最小修复。
4. WP-04 代表页组 C：消息/设置，若前两组均无源码变更则不执行扩展。
5. WP-05 定向静态/测试/浏览器门禁、中文报告、任务记忆与当地关闭。

## Verification matrix

| Acceptance | Verification | Evidence target |
|---|---|---|
| 首页 320/375 无溢出/重叠 | Chromium 单 worker + `scrollWidth <= innerWidth` + 关键元素几何检查 | 定向 E2E 输出与修复后截图 |
| 代表页排查 | 每组 320/375 断言，记录通过/发现/修复 | `REPORT.md` + E2E 摘要 |
| 最小代码边界 | `git diff --check` + scoped diff review + 相关 lint/type/test | `EVIDENCE.md` |
| 无发布/外部写入 | Git/Registry 最终状态 | `CHECKPOINTS.md` |

## Rollback and pause conditions

- 回滚方式：仅撤回本任务明确列出的样式/测试/报告变更，不碰触其他 untracked 目录。
- 暂停：发现需改业务逻辑、公共 API、数据、权限、依赖或生产状态；或工作树中目标文件存在归属不明的其他修改。
- 软/硬边界：45 分钟输出一次可验证进度；90 分钟停止扩展并交付当前报告。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
