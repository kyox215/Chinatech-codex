# RepairDesk 项目重规划：基于 Mobile Repair MVP v1.5

更新时间：2026-06-12  
参考文档：`/Users/kyox215/Downloads/codex_mobile_repair_mvp_plan_v1_5_whatsapp_order_communication.md`

## 1. 结论

外部 MVP v1.5 文档的方向是正确的：它把系统定位成“手机维修 / 回收 / 翻新机销售门店操作系统”，强调 mobile-first、PWA、高密度 UI、扫码拍照、WhatsApp 沟通和多门店预留。

当前项目已经不是从零 MVP，而是已经实现了较多后台能力：

- Next.js App Router + React Query + Supabase。
- 登录、onboarding、平台审批、多门店上下文。
- 工单、客户、库存、消息模板、设置、平台管理。
- 工单详情沉浸式工作面、技师锁定、报价草稿修复。
- 客户列表分页性能优化。
- 消息模板和 Click-to-WhatsApp 基础能力。

因此不建议推倒重做成文档里的 `/m/*` 新系统。更合理的路线是：

1. 保留当前 `/orders`、`/customers`、`/inventory`、`/messages`、`/settings` 作为统一业务路由。
2. 把当前桌面后台逐步升级为 mobile-first / PWA-first 响应式工作台。
3. 只在确实需要独立移动信息架构时，再增加 `/m/*` alias 或 mobile shell。
4. 优先补齐扫码、拍照附件、标签打印、客户查询页、PWA 和权限测试。
5. 不新增大模块前，先拆分现有超大文件和稳定数据/API 契约。

一句话：**当前项目应从“桌面后台 + 部分移动适配”重规划为“同一路由、多端自适应的门店操作系统”，而不是重新开一套移动端。**

## 2. 外部 MVP 文档给当前项目带来的关键改进点

### 2.1 产品定位改进

当前系统更像内部后台，外部文档提醒我们它还应覆盖三类入口：

- 员工：手机端高频接单、扫码、拍照、改状态、收款。
- 客户：查询维修进度、提交需求、查看保修、购买翻新机。
- 管理者：看订单、库存、利润、员工效率、多店数据。

建议新增产品分层：

| 层级         | 当前状态                         | 改进方向                                    |
| ------------ | -------------------------------- | ------------------------------------------- |
| 员工工作台   | 已有后台路由                     | 改为 mobile-first 高密度操作流              |
| 客户自助前台 | 基本缺失                         | 新增查询工单 / 保修 / 门店信息 / 翻新机展示 |
| 管理后台     | 已有 dashboard/platform/settings | 拆分老板总览、平台审批、多店统计            |

### 2.2 移动端信息架构改进

外部文档建议五大移动模块：

```txt
订单管理
客户管理
回收管理
库存商品
设置
```

当前项目侧栏是：

```txt
工单
客户
回收库存
消息模板
设置
平台审批
```

建议统一为：

```txt
工单
客户
回收 / 库存
消息
设置
平台
```

移动端导航建议与桌面共用同一套业务侧边栏，默认收纳为抽屉：

```txt
工单 / 客户 / 库存 / 消息 / 设置
```

全局扫码和新建不放在底部 Tab 内，改成：

- 顶栏菜单按钮 / 工具按钮。
- 移动端右下悬浮按钮。
- Command Palette 快捷动作。

### 2.3 PWA 与手机端能力改进

当前项目有 Web App 基础，但 PWA/移动硬件能力还不完整。

建议新增：

- `manifest.webmanifest`
- iOS/Android icon 和 splash 设置。
- offline fallback 页面。
- install prompt。
- HTTPS 下扫码能力。
- 相机拍照上传。
- 工单/设备/库存标签二维码生成。
- 手机端底部安全区适配。

### 2.4 扫码、拍照、附件改进

外部文档把扫码和拍照列为 MVP 必须做。当前项目已经有 `@zxing/browser`，但业务流程还未系统化。

建议规划为统一“捕获能力层”：

```txt
src/features/capture/
  components/
    BarcodeScannerSheet.tsx
    CameraCaptureSheet.tsx
    AttachmentUploader.tsx
  model/
    barcode-parser.ts
    attachment-rules.ts
  api/
    storage-client.ts
```

业务使用场景：

- 工单新建：扫 IMEI / 序列号。
- 工单详情：拍设备外观、故障照片、签名附件。
- 库存：扫商品条码、IMEI、库存标签。
- 回收：拍外观、检测结果、客户证据。
- 标签打印：扫码打开工单或库存详情。

### 2.5 WhatsApp 沟通改进

当前项目已有消息模板和通知弹窗，外部文档 v1.5 重点强化“订单 WhatsApp 沟通模块”。

建议把消息能力升级为统一 communication domain：

```txt
src/features/communication/
  model/
    template-renderer.ts
    whatsapp-link.ts
    communication-event.ts
  components/
    MessagePreviewDialog.tsx
    CommunicationTimeline.tsx
    TemplateVariablePicker.tsx
  server/
    communication.repository.ts
```

MVP 保持 Click-to-WhatsApp：

- 模板变量渲染。
- 发送前预览。
- 员工可编辑文本。
- 打开 WhatsApp。
- 复制文本。
- 记录沟通日志。
- 在工单和客户详情中显示沟通时间线。

暂不做：

- WhatsApp Business Cloud API 自动发送。
- Webhook 回执。
- 24 小时会话自动化。
- 自动营销。

### 2.6 标签打印改进

外部文档强调 QR / 条码追踪，结合当前用户需求，应新增打印/标签规划。

建议新增 print/label domain：

```txt
src/features/print/
  model/
    label-template.ts
    label-size.ts
    print-payload.ts
  components/
    LabelPreview.tsx
    LabelPrintDialog.tsx
  server/
    print-settings.repository.ts
```

第一版只做浏览器打印：

- 工单标签。
- 设备标签。
- 库存标签。
- 取件标签。

后续支持 QZ Tray：

- 本地直连 Brother / Zebra / Rollo。
- 设置默认打印机。
- 选择标签尺寸。
- 一键打印。

## 3. 当前项目最值得改进的地方

### 3.1 架构拆分

当前已经有 feature 目录，但仍有几个明显风险：

- `src/features/orders/server/order.repository.ts` 过大。
- `src/features/orders/components/order-overview-tab.tsx` 过大。
- `src/features/inventory/screens/inventory-screen.tsx` 过大。
- `src/features/inventory/server/inventory.repository.ts` 过大。
- `src/lib/repairdesk/types.ts` 过大。
- `src/lib/repairdesk/api.ts` 逐渐成为跨域大入口。
- `src/server/api/repairdesk-router.ts` 和 schemas 继续增长。

改进方向：

- API client 按 domain 拆分，`@/lib/repairdesk/api` 保留 re-export。
- API router 按 domain 拆分，外部 URL 不变。
- repository 拆成 query、command、mapper、audit/event。
- 大 UI 文件拆成 panel、section、dialog、model helper。

### 3.2 移动端优先

当前 UI 已做响应式和高密度修复，但仍以桌面后台为主。

建议新增“移动操作模式”标准：

- 小屏首屏直接显示待处理业务，不显示大 hero。
- 列表卡片 72-112px 内承载状态、客户、设备、金额、时间。
- 详情页底部固定主操作栏。
- 复杂表单使用分步或折叠区块。
- 居中 Dialog 在手机端替换为 Sheet / full-screen workspace。
- 扫码和新建常驻为移动快捷动作。

### 3.3 数据库与权限

当前已具备多店铺和平台审批，但重规划前必须审计：

- 远端 migration history 与本地 migration 是否一致。
- legacy public tables 是否启用 RLS。
- 所有 service role repository 是否总是使用 actor store_id。
- platform admin 是否可能越权访问门店业务数据。
- 所有关键 mutation 是否写 audit_logs。
- RPC 是否避免不必要的 security definer。

### 3.4 性能

已完成客户分页优化，但还应继续：

- 工单搜索避免全店全量 fallback。
- 库存列表全面分页/服务端筛选。
- 详情页避免拉全店数据。
- Query key factory 覆盖所有 domain。
- mutation 精确 invalidate。
- 重数据列表添加 skeleton/placeholderData。

### 3.5 测试

重构前必须先补 characterization tests：

- 登录后跳转。
- 多店铺权限。
- 平台管理员边界。
- 工单状态机。
- 报价/押金/尾款。
- 技师锁定。
- 客户分页和备用电话搜索。
- 库存状态机和利润。
- 消息模板渲染。
- 标签/二维码 payload。

## 4. 推荐的新目标架构

```txt
src/
  app/
    (public)/
    (workspace)/
    api/
  features/
    auth/
    stores/
    platform/
    orders/
    customers/
    inventory/
    communication/
    capture/
    print/
    settings/
    dashboard/
  entities/
    order/
    customer/
    device/
    inventory-item/
    money/
  shared/
    lib/
    ui/
    config/
    testing/
  server/
    api/
      domains/
    auth/
    db/
    observability/
```

说明：

- `communication` 承接消息模板、WhatsApp 链接、沟通记录。
- `capture` 承接扫码、拍照、附件上传。
- `print` 承接维修单、收据、标签、二维码打印。
- `entities` 放跨业务可复用规则。
- `features/*/server` 保持 server-only。

## 5. 推荐路由规划

### 5.1 当前路由保留

```txt
/                 老板/店长 dashboard
/orders           工单列表
/orders/new       新建工单
/orders/[id]      工单详情
/customers        客户列表
/customers/[id]   客户详情
/inventory        回收库存
/messages         消息模板
/settings         设置
/platform         平台审批
```

### 5.2 新增客户公开入口

```txt
/repair/status    客户查询工单
/warranty/check   客户查询保修
/shop             翻新机展示，后期
```

### 5.3 移动端路由策略

不建议第一阶段复制一套 `/m/*` 页面。

第一阶段：

- 同一路由响应式适配。
- 小屏显示侧边栏抽屉。
- 大屏显示固定侧栏，可折叠为图标模式。

第二阶段如确实需要：

```txt
/m/orders       alias 到 /orders 的移动壳
/m/customers    alias 到 /customers 的移动壳
/m/inventory    alias 到 /inventory 的移动壳
/m/settings     alias 到 /settings 的移动壳
```

这样可以避免两套业务页面分叉。

## 6. 分阶段实施路线

### Phase 0：事实冻结与规划验收

目标：

- 确认当前系统不回退。
- 基于本文档输出最终项目级重构计划。
- 标记所有不可破坏流程。

验收：

- 新规划文档被确认。
- 明确哪些功能先做、哪些后做。
- 不发生大面积代码改动。

### Phase 1：保护测试与质量基线

目标：

- 补 characterization tests。
- 把当前关键流程锁住。

优先测试：

- 工单新建、详情、状态、报价、收款。
- 客户分页、搜索、详情。
- 库存状态机。
- 消息模板渲染。
- 登录/onboarding/platform。

验收：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

### Phase 2：移动工作台外壳

目标：

- 当前业务路由支持真正 mobile-first 操作。

内容：

- 小屏侧边栏抽屉。
- 全局扫码/新建悬浮操作。
- 移动端详情底部固定操作栏。
- 页面级 safe-area 适配。
- PWA manifest 和基础安装能力。

验收：

- iPhone 宽度 390 下可完成查单、新建、状态变更、通知。
- 无页面级横向滚动。

### Phase 3：扫码 / 拍照 / 附件

目标：

- 让工单和库存真正具备手机端采集能力。

内容：

- 条码/二维码 Scanner Sheet。
- IMEI 解析和字段回填。
- 拍照上传到 Supabase Storage。
- 附件列表和删除规则。
- 私有 bucket + store scoped path。

验收：

- 手机 HTTPS 下能扫码。
- 新建工单能扫码填 IMEI。
- 工单详情能上传照片。
- 权限不能跨店查看附件。

### Phase 4：打印与标签

目标：

- 给每台设备、工单、库存商品建立可打印标签。

内容：

- 标签模板模型。
- LabelPrintDialog。
- 工单标签、设备标签、库存标签。
- 二维码指向系统详情或客户查询页。
- 设置页增加默认标签尺寸。

验收：

- 浏览器打印可用。
- Brother QL 系列标签尺寸可配置。
- 标签内容不溢出。

### Phase 5：通信中心

目标：

- 把订单 WhatsApp 沟通能力从弹窗功能升级为统一通信模块。

内容：

- 模板变量系统统一。
- 状态变更后建议发送模板。
- 沟通时间线。
- 客户详情发送消息。
- 发送日志。

验收：

- 订单详情可生成意大利语 WhatsApp 消息。
- 员工可编辑、复制、打开 WhatsApp。
- 发送记录进入时间线。

### Phase 6：模块拆分与 API 收敛

目标：

- 降低维护成本。

内容：

- 拆 `repairdesk-router`。
- 拆 `repairdesk-schemas`。
- 拆大 repository。
- 拆超大 screen。
- API facade 按 domain 分层。

验收：

- 外部 API URL 不变。
- 测试全绿。
- 文件大小回到架构预算附近。

### Phase 7：客户前台与翻新机展示

目标：

- 补齐“网站前台”部分。

内容：

- 门店信息页。
- 客户工单查询页。
- 保修查询页。
- 翻新机公开展示页，暂不做完整电商支付。

验收：

- 客户可通过订单号/手机号查询进度。
- 不暴露内部备注、成本、利润。

## 7. 当前功能 vs 外部文档差距表

| 模块     | 当前项目                             | 外部文档要求                        | 建议                               |
| -------- | ------------------------------------ | ----------------------------------- | ---------------------------------- |
| 登录权限 | 已有 Supabase Auth、多店铺、平台审批 | 员工权限、RLS、多店预留             | 继续强化测试和审计                 |
| 工单     | 已较完整                             | mobile-first 接单、状态、报价、收款 | 加强移动操作和扫码拍照             |
| 客户     | 已有 CRM，已分页优化                 | 客户搜索、设备、订单、标签、沟通    | 补客户合并/匿名化规划              |
| 回收库存 | 已有 inventory                       | 回收、翻新、销售分流程              | 拆分 UI 和状态机                   |
| 消息     | 已有模板和通知                       | WhatsApp 沟通模块                   | 升级 communication domain          |
| 扫码拍照 | 依赖存在，流程不足                   | MVP 必做                            | 新增 capture domain                |
| 标签打印 | 目前不足                             | QR/条码追踪                         | 新增 print domain                  |
| PWA      | 不完整                               | PWA-first                           | 新增 manifest/offline/mobile shell |
| 前台网站 | 基本缺失                             | 客户入口和展示                      | 后期补 public routes               |
| CI/CD    | 基础脚本有                           | GitHub/Vercel/Supabase 流程         | 补 PR 模板和部署文档               |

## 8. 不建议做的事

- 不建议立刻重做整个项目。
- 不建议复制一套完整 `/m/*` 页面导致双维护。
- 不建议过早接 WhatsApp Business Cloud API。
- 不建议第一版做完整电商支付和发票系统。
- 不建议在没有测试前大拆工单和库存核心逻辑。
- 不建议把扫码、拍照、打印逻辑散落在各业务页面里。
- 不建议让 platform admin 默认访问所有店铺业务数据。

## 9. 最高优先级改进清单

1. 补移动端工作台外壳：侧边栏抽屉、全局扫码/新建、移动详情操作栏。
2. 补扫码和拍照附件能力。
3. 补标签打印：工单、设备、库存。
4. 把消息模板升级为统一 communication domain。
5. 拆分 orders / inventory 的超大文件。
6. 审计 Supabase RLS、legacy public tables、RPC 权限。
7. 补 characterization tests。
8. 新增客户公开查询页和保修查询页。
9. 整理 GitHub/Vercel/Supabase 发布流程文档。
10. 增加真实移动端 Playwright/手动验收矩阵。

## 10. 下一步建议

建议下一轮让 GPT / Codex 输出一份更细的执行计划，标题可以是：

```txt
RepairDesk Mobile-first Replatform Execution Plan
```

要求它按下面顺序规划：

1. 保护测试。
2. 移动 shell。
3. capture domain。
4. print/label domain。
5. communication domain。
6. orders/inventory 拆分。
7. public customer portal。
8. security/performance audit。

每个阶段都必须明确：

- 涉及文件。
- 数据库变更。
- UI 行为。
- 业务验收。
- 自动化测试。
- 不可破坏的现有功能。
