---
schema_version: 1
task_id: "TASK-20260719-007-fast-app-recovery"
title: "RepairDesk 网络恢复后 2–3 秒自动进入或受控刷新"
status: "release_in_progress"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
departments: ["INT", "ARCH", "FE", "UX", "QA"]
created_at: "2026-07-19T18:01:27Z"
updated_at: "2026-07-19T20:14:26Z"
---
# Task — RepairDesk 快速网络恢复

## Owner request

> 恢复机制改为更快,不要十秒内,更快,尽量在两三秒内就是直接进去,或者是如果没有进去就尝试刷新来进去。

## Objective and business value

手机浏览器长时间断网或进入后台后，网络真实恢复时无需下拉刷新：优先原地补载资源并进入；无法直接进入时，在 3 秒硬截止内开始一次受控刷新。

## Scope in

- 全局样式保护层、恢复状态文案和手动重试操作。
- 不依赖 React hydration 的内联恢复控制器。
- 同源固定正文探针、单飞、超时和可见页面轮询。
- CSS marker 与 React runtime handshake 双就绪门。
- 自动刷新上限、Service Worker 导航超时和离线壳版本更新。
- 不依赖 Next.js 资源的独立 Service Worker 离线恢复页。
- 单元测试、Chromium/WebKit production E2E、手机与电脑视觉证据。

## Scope out

- 数据库、Supabase migration、权限、客户数据和业务写入。
- React Query、Realtime、离线 outbox 或静态资源缓存策略重构。
- 新依赖、数据库 DDL/DML、历史 migration 重放和业务数据变更。
- 根 checkout 的既有未提交内容。

## Acceptance criteria

- [x] 样式与 React runtime 正常时直接显示可交互应用，不触发恢复刷新。
- [x] 网络真实恢复且资源仍缺失时，即使没有 `online` 事件，也在 3 秒内开始原地恢复或一次受控刷新。
- [x] `online`、`pageshow`、`visibilitychange`、`focus` 和 `resume` 会加速探测，但不被当作站点可达证明。
- [x] 每个 60 秒恢复窗口自动刷新不超过 1 次；达到上限后显示“立即重试”。
- [x] `sessionStorage` 不可用时最多自动刷新一次，不形成循环。
- [x] CSS 已恢复但 React 未启动时不会暴露不可交互的假就绪 shell。
- [x] 未完成恢复时始终隐藏无样式业务 DOM。
- [x] 390x844 与 1440x900 无横向溢出，按钮高度至少 44px，支持 reduced motion。
- [x] lint、typecheck、311 个测试文件/2022 项测试和 build 通过。
- [x] 原恢复矩阵 Chromium 8/8、WebKit 8/8，以及真实 Service Worker v4 矩阵 Chromium 3/3、WebKit 3/3 通过。

## Architecture decision

- HTML 内联控制器是唯一自动恢复协调器；`AppStyleRecovery` 只提供 React runtime handshake。
- 探针使用未加入 Service Worker 缓存的 `/recovery-probe.txt`，必须返回固定正文 `repairdesk-recovery-v1`。
- 可见页面以 750ms 间隔、750ms 单次超时探测；样式重试预算 500ms；runtime 宽限 1200ms。
- 先补载现有 stylesheet；只有应用仍未双就绪时才刷新。
- Service Worker 壳升级为 v4，GET 导航网络等待最多 3 秒后回退 `/offline-fallback-v1.html`；POST 等非 GET 导航不使用离线页。
- 通用离线 fallback 完全独立于 Next.js，不加载任何业务 JS/CSS/font；它只负责固定探针、前台唤醒、一次/60 秒受控刷新和人工重试。
- SW 仅删除旧 `repairdesk-shell-*` 缓存，保留认证、本地存储、IndexedDB、outbox 和其他业务缓存。
- 自动刷新采用 60 秒窗口一次上限；恢复成功后清除状态。

## Risk and approval boundaries

- 风险 R4：本阶段包含 `main` 推送、生产 Web 部署和 Supabase 迁移闸门；候选本身仍无数据模型变化。
- 自动刷新可能影响未保存页面。最新 Owner 指令明确要求无法进入时尝试刷新；实现仅在全局恢复层/运行时未就绪时执行，先尝试原地恢复、最多一次，且不清理登录、IndexedDB、业务缓存或 outbox。
- Owner 于当前指令明确批准：按计划执行、推送 `main`，并应用 Supabase/migration。
- 发布按 L1 串行控制：只允许精确快进候选、非强制推送、exact linked migration history/dry-run，以及存在已核验 pending migration 时的应用。
- 生产远端已与本地 91 条 migration 完全同步；不得为满足措辞而重放已应用 SQL，正式数据库步骤只能是安全 no-op。

## Multi-agent record

- `/root/fast_recovery_arch_review`：ARCH + Frontend Reliability，只读；发现并复核关闭 CSS-ready/JS-missing 假就绪窗口，最终结论 PASS，适合本地候选提交。
- `/root/fast_recovery_qa_review`：QA + UX，只读；定义 3 秒硬截止与移动端矩阵，复核 JS-only 修正和修正后门禁，最终结论 PASS。
- 主线程：唯一 integration writer；独立复核者均未写文件。

## Active context handling

`.ai-company/memory/ACTIVE_CONTEXT.md` 仍由 `TASK-20260719-001-ai-inventory-live-provider` 的 24 小时观察门占用。本任务不得覆盖该定时任务；恢复记录完整保存在本目录。

## Rollback

代码级回滚本任务候选提交；无数据库或数据回滚。生产发布后若出现刷新循环、错误隐藏业务 shell、正常页面持续闪现恢复层或登录/草稿异常，应立即回滚 Web 提交。

## Current state and next action

Owner 已批准发布。最新已核验 `origin/main@25752bd1` 是原候选父提交；当前隔离 worktree 在 `94243401` 之上新增了 WebKit 真实 SW 阻塞修正、契约/E2E 与发布检查点，仍不含 migration。生产 linked history 与本地 91 条记录一致，dry-run 为 up to date。最终代码门已通过，下一步：独立 QA/ARCH 复核、精确提交、再次 fetch 检查无漂移、非强制推送 exact HEAD、确认部署与生产恢复流程，然后写入关闭证据。
