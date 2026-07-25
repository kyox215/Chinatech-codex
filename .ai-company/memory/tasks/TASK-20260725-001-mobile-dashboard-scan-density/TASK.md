---
schema_version: 1
task_id: "TASK-20260725-001-mobile-dashboard-scan-density"
title: "移动概览扫码入口与高密度适配"
status: "active"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["PRODUCT", "UX", "FRONTEND", "QA", "DOCS", "RELEASE"]
created_at: "2026-07-25T00:27:24Z"
updated_at: "2026-07-25T00:40:20Z"
---
# Task — 移动概览扫码入口与高密度适配

## Owner request

按已确认规划，在移动端概览加入扫码查询订单入口，压缩页面并提高信息密度，适配不同大小手机；完成后部署生产。

## Business value

让门店员工从手机首页直接扫码查单，并在首屏看到更完整的快捷操作、交接指标和优先工单，减少滚动与查找时间。

## Scope in

- 仅调整概览页移动端快捷操作、交接指标、筛选与优先工单卡片布局。
- 复用现有订单扫码查询能力与权限边界。
- 适配 320、360、390、430px 手机宽度和常见短屏。
- 补充单元、响应式、溢出和可视验收。
- 更新响应式声明并发布生产。

## Scope out

- 不改变桌面端业务布局和优先级排序算法。
- 不新增数据库迁移、API、权限模型或扫码协议。
- 不修改订单、客户、回收、库存页面业务逻辑。
- 不按物理 PPI 整页缩放，不缩小可点击区域。

## Hard constraints

- 主操作触控区不小于 44px。
- 页面不得产生横向溢出；主要文字保持清晰可读。
- 扫码失败时保留手动输入/粘贴回退。
- 颜色只使用现有 token，布局声明优先进入 pattern 层。
- 保留加载、空、错误、权限和旧数据状态。
- 生产发布前必须通过质量门禁并保留回滚提交。

## Acceptance criteria

- [ ] 移动概览显示“快速接单 / 扫码查单 / 回收估价”三个单行入口。
- [ ] “扫码查单”复用订单范围扫码弹层；有效工单码可打开订单，普通值可进入订单搜索。
- [ ] 交接指标在优先工单列表前以单行三项展示。
- [ ] 四个优先筛选在 320–430px 保持单行且可点击。
- [ ] 优先工单卡合并当前/下一步信息，明显降低高度且不隐藏关键字段。
- [ ] 320、360、390、430px 无页面级横向溢出；按钮触控区不小于 44px。
- [ ] 桌面概览布局与行为无回归。
- [ ] lint、typecheck、相关测试、全量 test、build 和可视截图通过。
- [ ] 推送 main、生产部署 Ready，域名只读 smoke 正常。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 全局扫码组件和订单 scope 已存在 | observed | `src/features/capture/components/scan-search-button.tsx` | 直接复用 |
| 首页移动 AppBar 和快捷 Dock 均隐藏 | observed | `src/components/app-bar.tsx`; `src/components/mobile-workspace-dock.tsx` | 需提供页面内显式入口 |
| 当前筛选为 2x2，工单步骤为大块堆叠 | observed | dashboard components | 压缩移动布局，桌面保持 |
| 用户要求部署生产 | approved | Owner 2026-07-25 instruction | 发布仍受质量门禁约束 |

## Decision and approval points

- R2/L2：客户可见 UI 变更但无数据、权限或迁移；允许最小可逆实施。
- D3 生产发布已由 Owner 在本任务指令中明确批准。

## Work packages

1. WP1：移动快捷操作与扫码入口。
2. WP2：移动指标、筛选和优先工单卡密度。
3. WP3：测试、响应式项目声明和截图。
4. WP4：质量门禁、main 集成、生产发布和 smoke。

## Definition of done

- 所有验收项有代码、测试、截图或部署证据。
- 没有无关文件、生成噪声、秘密或生产数据变更。
- 可用前一 main 提交立即回滚。
