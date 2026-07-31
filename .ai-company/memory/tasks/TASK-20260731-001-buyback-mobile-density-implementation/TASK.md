---
schema_version: 1
task_id: "TASK-20260731-001-buyback-mobile-density-implementation"
title: "回收功能移动端高密度一页式优化"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["FLOW", "UX", "FE", "QA", "INT"]
created_at: "2026-07-31T00:05:07Z"
updated_at: "2026-07-31T01:35:45Z"
---
# Task — 回收功能移动端高密度一页式优化

## Owner request

使用真实子代理继续完善回收功能；把手机端优化为紧凑、高密度、一目了然、尽量在一页显示；先形成完整计划，再设定目标并执行，完成后推送和部署。

## Business value

让门店员工在手机上以更少滚动快速看清设备、报价依据、风险、客户答复和下一动作，减少面对客户协商时的上下文切换，同时保持报价审计和敏感流程边界。

## Scope in

- `/buyback` 列表摘要、报价卡、透明报价详情、创建/改价 Sheet 的移动密度和响应式优化。
- 现有回收 E2E 的六宽度、双浏览器、触控/字号/overflow/副作用断言。
- 修正与当前透明报价 UI 漂移的桌面 E2E 和 quote-only metadata。
- 完整计划、截图、发布、回滚和任务记忆。

## Scope out

- API、DTO、RPC、数据库、迁移、权限和状态机变化。
- 付款、证件、签名、成交、所有权转移、商品库存创建或自动联动。
- 完整检测 DTO、客户关联、可配置有效期和分析埋点。
- 非活跃旧回收 screen 的清理。

## Hard constraints

- 回收与商品库存独立；`accepted` 不等于成交或入库。
- 无 Stepper、progressbar、横向状态/分类轨道或页面级横向滚动。
- 移动触控区至少 44px；真实输入字号至少 16px。
- IMEI/电话在普通页面、ARIA、Toast 和截图中必须脱敏。
- 单一业务代码写入者为主线程；子代理只读。
- 根工作区用户改动不被覆盖；任务在隔离 worktree 实施。

## Acceptance criteria

- [x] 390px 列表首屏出现工具、三列摘要、安全边界和至少一张完整记录卡。
- [x] 常规 390/430px 详情无需滚动即可看见报价决策、三种答复和保存动作。
- [x] 创建/改价为单工作面，必要字段紧凑，补充资料和长历史渐进展开。
- [x] 360/390/430/768/1024/1440 的列表、工作台和详情无横向溢出。
- [x] 移动主要触控区 ≥44px；输入 computed font-size ≥16px；footer 不遮挡内容。
- [x] 接受/暂缓/拒绝、权限、离线、错误、409、锁定和幂等语义不变。
- [x] 无付款、签名、证件、finalize、库存 transition 或商品创建/更新副作用。
- [x] lint、typecheck、全量 test、production build、Chromium/WebKit 门禁通过。
- [x] 分支推送、Vercel Ready/promote、生产桌面/移动 smoke 和截图完成。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 当前生产透明报价基线为 `bb88cb09` | verified | Git + previous release evidence | new branch created from exact SHA |
| 活跃 screen 为 `transparent-buyback-screen.tsx` | verified | route/export chain | modify only active path |
| 当前任务可 app-only 完成 | verified | code explorer | no API/DB/migration writes |
| Sheet 误用 `mobileFloatingPage` 产生额外 padding | verified | class composition | remove from SheetContent |
| 完整检测摘要需要新 DTO | verified limitation | product/code review | Later; do not fabricate; existing history DTO already includes revisions and responses |
| 真实 iOS safe-area | unknown | desktop WebKit cannot prove | retain standards + production mobile smoke |

## Risk and autonomy

- R2：客户可见生产 UI 与关键报价操作面变化，但不改变数据合同，且 Vercel 可快速回滚。
- L2：可在明确文件合同内自主实施和测试；Owner 已明确批准推送和部署。
- D3 保留项：生产 promote 前必须取得 integration lease 并完成 release/quality gates。
- 若出现 API/DB/权限/状态机需求，立即升级到 R3/D4 并停止本任务写入。

## Work packages

- WP1：列表摘要和卡片密度。
- WP2：详情首屏决策与渐进历史。
- WP3：创建/改价单页压缩。
- WP4：测试、截图、发布和回滚证据。

## Definition of done

- 计划与验收均有文件和运行证据。
- 四个真实只读子代理输出已审阅并纳入或明确拒绝。
- 最终 diff、质量门禁、多视口截图、远端分支和生产 deployment 可核验。
- 任务文档、Task Memory、Registry 和 integration lease 正式关闭。
