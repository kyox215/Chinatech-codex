---
schema_version: 1
task_id: "TASK-20260719-007-fast-app-recovery"
title: "RepairDesk 网络恢复后 2–3 秒自动进入或受控刷新"
status: "closed"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
departments: ["INT", "ARCH", "FE", "UX", "QA"]
created_at: "2026-07-19T18:01:27Z"
updated_at: "2026-07-19T20:42:11Z"
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
- [x] 候选非强制快进到 `main@1119ef5d`，对应 Vercel 生产部署 `dpl_3RmTx8EKHszdMvMpbeNYG57B21H9` 为 `READY`。
- [x] `www.chinatech.in` 与 `chinatech.in` 指向该生产部署；恢复探针、SW v4、独立离线页和受保护路由均通过 HTTP 验收。
- [x] Supabase 本地/远端 91/91 migration 对齐，发布后 dry-run 仍为 `Remote database is up to date`；未重放任何已应用 SQL。
- [x] 已登录生产会话在 390x844 与 1440x900 正常进入概览，控制台及 Vercel 范围内运行时错误/告警为空。

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

本任务从未写入 `.ai-company/memory/ACTIVE_CONTEXT.md`。实施期间它最初用于独立 Vision 观察，随后并发发布将其更新为已关闭的 `TASK-20260719-007-ai-natural-language-query-v3`；本任务只使用自己的任务目录，不覆盖任何外部任务状态。Vision 24 小时复核仍是独立事项，但不再被描述为当前文件所有者。

## Rollback

代码级在最新 `main` 上前向回退本任务的恢复提交；无数据库或数据回滚。生产发布后若出现刷新循环、错误隐藏业务 shell、正常页面持续闪现恢复层或登录/草稿异常，应立即回退 Web 变更。由于后续 AI 发布已建立在本任务之上，不得直接提升旧的 pre-recovery 部署而连带撤销后续功能。

## Current state and next action

任务已关闭。快速恢复主提交 `94243401`、WebKit/SW v4 阻塞关闭提交 `8fa5b172` 和发布候选记录提交共同组成运行时发布源 `1119ef5d`；对应生产部署 `dpl_3RmTx8EKHszdMvMpbeNYG57B21H9` 已于 `2026-07-19T20:19:14.432Z` 进入 `READY`。随后并发 `main@5c67d451` 仍以该提交为祖先，未修改任何恢复路径，对应当前生产部署 `dpl_BAKzwYuQisiDChY6MN69wRCB2uVH` 也为 `READY`，正式域名仍返回 probe/SW v4。生产数据库发布结果为安全 no-op：91/91 migration 对齐且 dry-run up to date，没有可应用 SQL。正式域名静态资源、已登录手机/电脑概览、浏览器控制台和 Vercel 运行时错误检查均通过。

唯一非阻塞后续是使用真实 iPhone 在下一次自然断网/后台恢复场景观察 BFCache/网络切换；该事项转入 `OPS-BACKLOG-20260719-002`，不扩大为完整 offline-first 承诺。出现刷新循环、会话/草稿丢失、假就绪或恢复后仍卡住时，按 `docs/APP_RECOVERY_RUNBOOK.md` 立即回滚 Web 部署。本任务未修改 `ACTIVE_CONTEXT.md`，也不对其中的并发任务状态主张所有权。
