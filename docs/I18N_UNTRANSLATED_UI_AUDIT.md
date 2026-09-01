# 员工界面未翻译 UI 审计与迁移路线

Last verified: 2026-09-01
Baseline commit: `8e349b06f9e44883eb3348b434f96ad3f0d409d3`

## 结论

历史 TSX 口径当前包含 **5,592 次 Han-script 出现、4,081 个唯一候选**；扩展 TSX + TS runtime/API 口径包含 **8,153 次出现、5,753 个唯一候选**（TSX 5,592，TS 2,561）。这些数字是待分类的审计输入，不是同数量的翻译缺陷。旧实现、不可达路径、测试/Story/mock、中文源 catalog、canonical code、动态业务数据和安全内部错误都必须在人工复核后分类。

首批迁移冻结为一个可完整验证的员工故事：Dashboard 快捷/优先区 → `/orders` Orders Queue。该范围在基线上共有 **240 个直接 TSX 候选**。Release A 不包含新建工单、详情/任务、客户、库存、回收、设置、打印/PDF、通知或客户/法律内容，也不改变 API、schema、权限、筛选值、URL、payload 或持久化数据。

## 审计方法

总量可通过以下命令复现：

```bash
node scripts/audit-i18n-ui-text.mjs --summary
node scripts/audit-i18n-ui-text.mjs --include-ts --summary
```

脚本读取 TypeScript 配置，用 TypeScript AST 检查 JSX 文本、JSX attribute 字符串和普通字符串。默认参数保留历史 `src/**/*.tsx` 口径，排除 test/spec/story、server、testing、API 与消息 catalog；`--include-ts` 额外纳入生产 `.ts` 与 App API runtime-error 候选，仍排除 server/testing/test/story 和消息 catalog。摘要和 JSON 都输出 kind、extension 和 domain 计数，用于按可达性分批，而不是作为全仓零汉字门禁。当前历史 TSX 结果为：

| 分类          | 出现次数 |
| ------------- | -------: |
| JSX 文本      |    1,776 |
| JSX attribute |    1,108 |
| TSX 字符串    |    2,708 |
| 合计          |    5,592 |
| 唯一候选      |    4,081 |

扩展口径的 kind 结果为 JSX 1,776、attribute 1,108、string 5,269；其中 `.tsx` 5,592、`.ts` 2,561。完整 per-domain 计数通过上述 `--include-ts --summary` 可重现，并优先按冻结 consumer allowlist 而非全仓总量判定发布。

审计随后执行三层复核：

1. 从 App Router、导航与组件引用判断生产可达性。
2. 区分 UI-owned 文案、固定系统展示值、动态业务数据与内部稳定值。
3. 反向检查运行时 model/config 导入，补足仅扫描 TSX 字面量会漏掉的固定中文。

这套方法仍有边界：AST 扫描不会发现第三方组件内部文案、远端配置值、运行时拼接结果或只在特定权限/网络状态下出现的分支，因此 Release A 还需要 adapter 测试与受控浏览器状态矩阵。

## 生产可达性与旧代码

下列路径可确认贡献了至少 935 次不应计入当前生产缺陷的候选：

| 路径/类别 | 候选数 | 分类 |
| --- | ---: | --- |
| `src/routes/**` | 108 | 旧 TanStack/Vite 路由，不是当前 App Router 入口 |
| `src/features/inventory/screens/inventory-screen.tsx` | 306 | 旧库存屏幕 |
| `src/features/buyback/screens/buyback-screen.tsx` | 141 | 旧回收屏幕 |
| `src/features/buyback/components/buyback-quote-workspace.tsx` | 380 | 旧回收报价工作区 |
| 合计 | 935 | 明确旧实现/不可达 |

这不是完整不可达清单；其余候选仍需在各批次开始前重新核对，而不能仅凭路径名豁免。

## 基线 Top 10 文件

以下按同一 AST visitor 的 per-file 结果排序，用于确定后续调查优先级。高计数不等于高缺陷数。

| 排名 | 文件 | 候选数 | 当前判断 |
| ---: | --- | ---: | --- |
| 1 | `src/features/orders/screens/order-detail-screen.tsx` | 386 | 生产可达；Release B 候选 |
| 2 | `src/features/buyback/components/buyback-quote-workspace.tsx` | 380 | 旧实现/不可达 |
| 3 | `src/features/inventory/screens/inventory-screen.tsx` | 306 | 旧实现/不可达 |
| 4 | `src/features/buyback/screens/transparent-buyback-screen.tsx` | 158 | 生产可达；独立业务批次 |
| 5 | `src/features/buyback/screens/buyback-screen.tsx` | 141 | 旧实现/不可达 |
| 6 | `src/features/settings/components/order-data-section.tsx` | 129 | 生产可达；设置批次 |
| 7 | `src/features/orders/components/order-overview-tab.tsx` | 125 | 生产可达；Release B 候选 |
| 8 | `src/features/inventory/components/inventory-intake-dialog.tsx` | 121 | 生产可达；库存批次 |
| 9 | `src/features/orders/screens/new-order-screen.tsx` | 119 | 生产可达；Release B 候选 |
| 10 | `src/routes/orders.index.tsx` | 106 | 旧路由 |

## Release A 冻结清单

Release A 直接候选共 240 个：

| 文件 | 基线直接候选 |
| --- | ---: |
| `src/features/orders/screens/order-list-screen.tsx` | 75 |
| `src/features/dashboard/components/dashboard-priority-states.tsx` | 24 |
| `src/features/orders/components/order-list-filters.tsx` | 18 |
| `src/features/dashboard/components/dashboard-priority-workspace.tsx` | 17 |
| `src/features/orders/components/order-list-desktop-row.tsx` | 17 |
| `src/features/dashboard/components/dashboard-priority-sidebar.tsx` | 15 |
| `src/features/orders/components/order-list-states.tsx` | 15 |
| `src/features/orders/components/order-search-feedback.tsx` | 14 |
| `src/features/dashboard/components/dashboard-quick-start.tsx` | 11 |
| `src/features/orders/components/order-list-items.tsx` | 11 |
| `src/features/dashboard/components/dashboard-priority-card.tsx` | 8 |
| `src/features/orders/components/order-list-transition-feedback.tsx` | 4 |
| `src/features/orders/components/order-list-view-mode.tsx` | 4 |
| `src/features/orders/components/order-queue-stage-badge.tsx` | 4 |
| `src/features/orders/components/order-list-skeleton.tsx` | 2 |
| `src/features/orders/components/order-result-group-header.tsx` | 1 |
| 合计 | 240 |

迁移内容包括标题、说明、搜索、筛选、chips、队列/结果分组、桌面行、移动卡片、分页、批量反馈、ARIA、loading、empty、首次错误、后台刷新失败、离线/缓存、权限受限及列表日期/相对时间。系统 workflow、exception、财务、保管、解锁、工单类型和 Dashboard priority 指导只通过 display adapter 翻译；canonical value 不变。

Release A 完成时的复扫为 **5,599 次出现、4,088 个唯一候选**，较当时基线恰好减少 240 次；上述 16 个 TSX consumer 的直接 Han-script 候选为零。Release 1 完成 Kiosk、认证和 404/metadata 修正后的当前历史口径为 **5,592 次出现、4,081 个唯一候选**。这些差值只证明冻结的直接字面量已迁移，运行时 adapter 仍需单独测试，不能以数字替代验收。

## 误报、漏报与登记例外

| 类别 | 示例 | 处理 |
| --- | --- | --- |
| 测试/Story/mock | 中文夹具、断言、状态样本 | 不计入生产 UI；保留用于中文基线或改为三语断言 |
| 中文源 catalog | `messages.ts` 的 `zh-CN` 内容 | 必须保留 |
| 内部稳定值 | status code、route、query/filter value、payload value | 绝不翻译；只翻译展示标签 |
| 动态业务数据 | 店铺名、客户名、设备、维修项目、技师、供应商、备注、自定义 workflow 标签 | 原样显示；不得误当 UI 文案 |
| 固定 model/config 展示文案 | 队列提示、默认系统状态、任务指导、财务状态、保管/解锁方式 | 用 exact/code-based display adapter，不改源业务模型 |
| 共享 badge 默认值 | 类型、保管、解锁 badge | Release A consumer 传 optional localized label；其他页面默认行为不变 |
| 第三方/权限/网络分支 | portal、离线、首次错误、回滚 | AST 可能漏报；通过 mock 浏览器矩阵补证 |
| 扫码弹层正文 | Orders 触发器打开的 `OrderQrScannerSheet` / `ScanSearchSheet` | 触发器已本地化；弹层属独立扫码业务组件，当前中文正文是 Release A 登记例外，归入 Release B 并须依扫码边界声明单独验证 |
| Kiosk model 的 7 个扩展候选 | `features/kiosk` 扩展审计命中 `kiosk-session.ts` 的员工侧创建、复核、退回校验 | 属内部员工流程错误，不是固定意大利语公共 Kiosk UI；公共 pair/submit/display consumer 已单独覆盖，且没有未分类的固定中文泄漏 |
| 旧实现/非生产路由 | 上述 935 次及旧 `src/routes` | 不作为本批缺陷；后续删除需另行授权 |

对 unknown/custom 值的默认规则是保留原文。不得用“所有汉字替换”处理动态数据，也不得把翻译后的展示值写回筛选、mutation、API 或数据库。

## Release A 验收矩阵

| 维度 | 最小覆盖 |
| --- | --- |
| Locale | `zh-CN`、`it-IT`、`en` |
| Viewport | 390、768、1440；无页面级横向溢出 |
| 引擎 | Chromium、WebKit |
| 正常状态 | 有数据、搜索、组合筛选、分页、桌面/移动列表 |
| 空/错/网络 | 无数据、搜索无结果、首次读取失败、后台刷新失败、离线有/无缓存 |
| 权限 | 归档、供应商、打印、批量流转不可用时不暴露越权入口 |
| 批量反馈 | 成功与部分失败仅使用受控 mock，不触碰真实工单 |
| 状态保持 | 在语言切换器可达时，切换后 URL、搜索、非默认筛选、第 2 页、选择和滚动不丢失 |
| 数据合同 | 请求参数、状态 code、权限、业务数据和 persisted value 不变 |
| 可访问性 | 可见标签与 accessible name 同语言；loading/status、error/alert、键盘路径可用 |

## 明确排除

- `/orders/new`、`/orders/[id]`、`/orders/[id]/task` 正文和交互。
- Customers、Inventory、Buyback、Settings 及其他深层页面。
- 打印/PDF、通知、票据、保修、协议、客户及法律内容。
- API、query key、schema、migration、认证、权限、租户、依赖、环境变量和生产数据。
- 自定义店铺 workflow 标签及动态客户/设备/维修/供应商数据的“翻译”。

Orders 移动筛选使用 modal focus trap；弹层打开时外部语言切换器本来就不可达，所以“保持已开弹层并同时切换”不是可执行交互路径，不以修改 modal 行为扩大本批。关闭弹层后的非默认筛选与页码仍必须在切换后保持。

## Release B+

| 批次 | 建议范围 | 先决条件 |
| --- | --- | --- |
| Release B | New Order + Order Detail/Task + `order-overview-tab` + Orders/Dashboard 扫码弹层正文 | 单独冻结表单、扫描、草稿、校验、权限、写入载荷与离线恢复合同；遵守订单 QR 与设备识别分离的扫码边界 |
| Release C | Customers 与 Inventory 当前生产列表/详情 | 先做生产可达性复核；严格区分 catalog 选项与客户/库存数据 |
| Release D | Transparent Buyback、Settings、Messages/其他员工工具 | 各领域独立状态矩阵与权限复核 |
| 独立内容批次 | 打印/PDF、通知、保修、票据、客户和法律文案 | 需要内容所有者、法律/业务审批与客户语言策略，不与员工 UI 机械合并 |

每一批都应重复“可达性审计 → 冻结 allowlist → typed catalog/display adapter → 三语单元与浏览器验证 → 逐项例外 → 独立发布门禁”，并在关闭时更新本报告，而不是宣称一次性完成全站翻译。
