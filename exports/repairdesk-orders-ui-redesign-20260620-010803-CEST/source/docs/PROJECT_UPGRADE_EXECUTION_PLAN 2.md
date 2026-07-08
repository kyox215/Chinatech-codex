# RepairDesk 升级执行计划

更新时间：2026-06-12

参考：

- `docs/PROJECT_REPLAN_FROM_MOBILE_MVP_V1_5.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_PAGE_GENERATION_DECLARATION.md`
- `docs/COMPONENT_GENERATION_DECLARATION.md`
- `docs/RESPONSIVE_DENSITY_PLAN.md`

## 执行原则

本轮升级不复制一套孤立 `/m/*` 页面。现有业务路由继续保留，但底层架构和 UI 标准升级为 RepairOS Compact：移动优先、PWA 优先、可扫码拍照、可打印标签的门店工作台。

所有新增 UI 必须复用 `src/lib/ui-patterns.ts`、`src/lib/component-patterns.ts` 和 `src/lib/motion.ts`。客户端组件不得直接引入 `src/server/*`。

RepairOS Compact 标准见 `docs/REPAIROS_COMPACT_ARCHITECTURE.md`。

## Phase 0：RepairOS Compact 基础重建

状态：进行中

目标：

- 主色切换为科技蓝 `#315CFF`。
- 全局样式从杂乱玻璃拟态收敛为浅色背景 + 白色紧凑卡片。
- 导航统一为同一套业务侧边栏：桌面固定显示并可折叠，移动端默认收纳为侧边栏抽屉。
- 新增回收管理模块入口 `/buyback`。
- `ui-patterns.ts` 增加 `repairOs.*` 可复用声明。

## Phase 1：移动工作台外壳与 PWA 基础

状态：进行中

目标：

- 小屏有稳定的侧边栏抽屉导航。
- 小屏有统一快捷操作入口。
- App 具备 PWA manifest、图标、离线 fallback 和 service worker 注册基础。
- 导航声明从散落组件中收敛到共享配置。

验收：

- `/orders`、`/customers`、`/inventory`、`/messages`、`/settings` 在手机宽度下可通过 AppBar 菜单按钮进入侧边栏抽屉。
- 移动端不显示底部模块导航，页面底部只为快捷操作和 safe area 预留空间。
- 快捷操作可进入新建工单、客户、库存新增、消息和全局搜索。
- 浏览器可读取 `/manifest.webmanifest`。
- 离线导航 fallback 指向 `/offline`。

## Phase 2：扫码、拍照、附件

状态：进行中，扫码基础已完成

目标：

- 建立 `features/capture`。
- 工单新建和详情可复用扫码、拍照、附件上传能力。
- Supabase Storage 路径按 store/order scope 设计，避免跨店访问。

已完成：

- 新增 `features/capture/model/barcode-parser.ts`，统一解析工单链接、客户链接、库存链接、IMEI、序列号和普通文本。
- 新增 `BarcodeScannerSheet`，统一使用 ZXing 摄像头扫码，并提供手动输入 / 粘贴 fallback。
- 手机端快捷操作增加“扫码读取”。
- 扫到内部链接可直接打开；扫到 IMEI / 序列号可跳转新建工单并自动带入。

下一步：

- 新增拍照采集 Sheet。
- 新增附件选择 / 预览 / 删除组件。
- 设计 Supabase Storage bucket、路径、RLS 和附件元数据表。

## Phase 3：打印与标签

状态：待执行

目标：

- 建立 `features/print`。
- 支持工单标签、设备标签、库存标签、取件标签。
- 第一版使用浏览器打印，后续预留 QZ Tray / Brother / Zebra。

## Phase 4：通信中心

状态：待执行

目标：

- 建立 `features/communication`。
- 把消息模板、WhatsApp 链接、发送日志、沟通时间线统一管理。
- 工单状态变更后可建议发送对应模板。

## Phase 5：架构拆分与安全审计

状态：待执行

目标：

- 拆分超大 orders / inventory repository、screen 和 schemas。
- 审计 Supabase RLS、legacy public tables、RPC、service role repository 和 audit logs。
- 补 characterization tests，确保核心流程重构不回退。
