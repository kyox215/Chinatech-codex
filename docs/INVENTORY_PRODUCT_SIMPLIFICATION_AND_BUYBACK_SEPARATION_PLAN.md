# RepairDesk 库存商品简化与回收分离实施计划

Status: implemented / production database enabled / application release in progress
Owner: Hexiang Huang / 鹤祥
Task: `TASK-20260729-011-inventory-product-simplification-implementation`
Risk / autonomy: `T3 / R4 / L2`
Last reviewed: 2026-07-29 Europe/Rome

## 0. Implementation outcome (2026-07-29)

The accepted Must scope is implemented:

- Product inventory and buyback now use separate routes, DTOs, API façades, query keys and realtime invalidation groups. Product reads exclude buyback records server-side, and buyback no longer navigates to or automatically creates product inventory.
- `/inventory` is a product-only responsive list. Mobile uses a filter Sheet; desktop uses a bounded six-column layout. Neither uses connected grouping rails, fake progress, nor control/table horizontal scrolling.
- `/inventory/new` is a single-page quick intake for phone, tablet, computer, game console and other. Category, brand and model/name are the only required fields; optional identifiers, pricing, cost, location, warranty and notes remain folded until needed.
- `/inventory/[id]` is an identity-first minimal detail page with masked external identifiers and permission-minimized cost data. It has no tabs, progress UI, buyback workspace or nested long-body scroll.
- The atomic quick-create RPC, idempotency ledger, cross-kind identifier lock/index, audit/event/movement graph and service-role-only grant were applied using an expand → rollback smoke → enable sequence. The rollback smoke left zero synthetic rows.
- Final verification passed: ESLint, TypeScript, 379 Vitest files / 2479 tests, production build, responsive product E2E at seven widths, buyback regression E2E and visual screenshots.

Plan delta: basic product editing, reservation and selling are explicitly deferred to the next bounded workflow task. They were Should/Later capabilities, not required for the Owner's current Must outcome of independent quick intake, product-only inventory and minimal detail. The present release does not expose placeholder or partially implemented actions for them.

## 1. 决策

库存商品和回收从本任务起按两个独立业务模块设计：

```text
商品库存：快速录入 → 在库查看 → 编辑 → 预留 / 售卖
回收业务：报价 → 客户确认 → 合规资料 → 付款 / 成交 → 回收历史
```

本阶段采用“业务合同与界面分开、底层历史兼容保留”：

- `/inventory` 只消费商品 DTO，服务端排除 `source_type=buyback`。
- `/buyback` 继续使用现有合规成交和历史兼容记录，但使用独立 façade 和 `buybackKeys`。
- 回收完成后不跳转商品页、不刷新商品缓存、不显示“转入库存”。
- 不自动将回收设备复制为商品；未来若恢复，必须由 Owner 另行批准显式一次性动作。
- 不删除、重写或批量回填历史回收、协议、付款、附件或审计记录。

## 2. Owner 目标与成功标准

1. 员工可以快速录入手机、平板、电脑、游戏机和其他单件商品。
2. 最短录入只需 `类别 + 品牌 + 型号/名称`，单页一次保存完成。
3. 没有 IMEI/序列号时仍可创建，数据库以 `public_no` 生成内部 SKU。
4. 商品详情首先回答“这是什么东西”，不再显示回收工作台。
5. 新页面没有圆点连线分组栏、装饰进度条或依赖左右拖动的控件。
6. 390px 起页面和主要控件均无横向溢出。

发布成功需同时满足：

- 五个类别最小创建全部通过。
- 同幂等键重放只创建一件；同键不同内容原子拒绝。
- 同门店活跃 IMEI/序列号并发重复只允许一次成功。
- 商品列表/详情 DTO 不包含客户、报价、证件、付款、风险或附件字段。
- 未填金额不显示 `€0.00`；明确输入 0 可显示真实零值。
- 无成本权限的响应和 DOM 都不存在成本字段。
- 回收 finalize/history 回归通过，商品/回收互不自动导航或失效缓存。

## 3. 产品范围

### Must

- 独立商品列表、筛选 Sheet、快速录入、极简详情。
- 固定类别：`phone`、`tablet`、`computer`、`game_console`、`other`。
- 独立商品 API 门面、DTO 和 `inventoryProductKeys`。
- 商品读取在数据库查询阶段按门店并排除回收记录。
- 原子 quick-create RPC，同时写入 V1 兼容行与 V2 catalog、variant、unit、identifier、movement、ledger、event、audit。
- 使用既有 `inventory_intake_command_ledger`，不建立第二套幂等域。
- 服务端固定 `manual_stock`；客户端不能提交 store、actor、来源、客户、供应商或回收字段。
- “保存”和“保存并继续录入”；失败保留草稿，成功继续时生成新幂等键并清空唯一/金额/备注字段。
- 回收 façade 与 query key 独立；去除“转入库存”和商品跳转。

### Should

- 类别相关可选规格、扫码填当前字段、预留/售卖和基础编辑。
- 缺售价/标识以轻量资料提示表达，不伪装为流程进度。
- 桌面最多六列，1024–1279px 使用五列或卡片，平板双列卡片。

### Later / 非本轮

- 手机壳、贴膜、数据线等数量型配件余额与盘点。
- 回收与商品物理拆表、历史回填、旧 RPC 删除。
- 自动或持续“回收转商品”。
- 复杂审计时间线、附件墙、检测工作台或多 Tab 详情。

## 4. 页面合同

### `/inventory`

手机顶部：菜单、标题、快速录入、搜索、筛选。默认列表只显示：

- 内部 SKU、类别、品牌型号、关键规格。
- 显示状态：在库、已预留、已售、已移除、已退回。
- 库位和已填写的售价。

禁止显示：回收报价、客户确认、风险扣减、回收成本、证件、检测流程、利润和“推进状态”。

筛选使用纵向 Sheet，包含状态、类别、品牌、库位；关闭不误应用，重置和应用均有明确动作。列表需覆盖 loading、empty、filtered-empty、error、permission denied 和正常长数据。

### `/inventory/new`

首屏只显示类别、品牌、型号/名称三个必填字段。“更多信息”折叠区包含：容量/配置、颜色/成色、IMEI/序列号、售价、授权成本、库位、保修和备注。

输入规则：

- 金额接受 `129,90` 或 `129.90`，拒绝负数、三位小数、分组逗号和非数字。
- IMEI/序列号可空；如填写必须同时明确类型并由服务端标准化查重。
- 离线时明确禁止提交并保留草稿，不伪装保存成功。
- 双击在 UI 锁定，服务端幂等仍是最终保证。
- 门店/权限变化由 authority monitor 拦截，服务端再次校验 actor/store。

### `/inventory/[id]`

固定顺序：商品身份 → SKU/脱敏标识 → 状态/库位 → 最多四个经营字段 → 备注。无值字段省略。

默认禁止 Tabs、回收来源、客户、报价、证件、付款、风险、检测工作台、附件墙、长时间线和嵌套正文滚动区。

## 5. 状态和数据不变量

显示状态映射：

| 显示状态 | 兼容状态                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| 在库     | `intake`、`evaluating`、`refurbishing`、`ready_for_sale`、`listed`、`offer_made`、`purchased`、`data_wipe` |
| 已预留   | `reserved`                                                                                                 |
| 已售     | `sold`                                                                                                     |
| 已退回   | `returned`                                                                                                 |
| 已移除   | `cancelled`、`recycled`                                                                                    |

数据不变量：

- 每件商品属于且只属于一个门店，数量恒为 1。
- 每件新商品有一个 V1 item、一个 V2 stock unit、一个 catalog/variant、至少一个标识、一个 `receive +1` movement 和一条 intake ledger。
- 无外部标识时 SKU 为唯一 primary；有外部标识时外部标识为 primary、SKU 为非 primary。
- 金额列因历史兼容可存 0，但 `cost_provided/list_price_provided/warranty_provided` 必须原子保存。
- 成本输入需要 `inventory:cost_allocate`；成本读取只对授权角色投影。
- 旧销售/工作流门禁继续负责是否可售；“在库”不等于绕过检测立即可售。

## 6. UI 长期硬规则

- 并列状态、分类和 Tabs 不得使用圆点连线步骤器。
- 新列表页不得使用 `RepairOsHeaderStepper`。
- Header、筛选、类别和 Tabs 不得依赖 `overflow-x-auto`、`snap-x` 或动态 `minWidth`。
- 普通列表、新建、编辑和对象详情默认无进度条；只有真实线性任务允许真实进度。
- 手机默认只使用页面主体纵向滚动；接近全屏的详情不再嵌套长正文滚动。
- 宽度不足时减少列或切卡片，不使用固定表格最小宽度加横向拖动。

## 7. 权限、安全与隐私

| 动作      | 权限                                 |
| --------- | ------------------------------------ |
| 查看商品  | `inventory:read`                     |
| 快速录入  | `inventory:create`                   |
| 输入成本  | `inventory:cost_allocate`            |
| 查看成本  | `finance:profit_read` 或受控成本权限 |
| 售卖      | `inventory:sale`                     |
| 移除/报废 | `inventory:write_off`                |

- BFF 从会话解析 actor/store；严格 schema 拒绝未知字段。
- RPC 为 `security invoker` 且 `search_path=''`，expand migration 默认撤销所有执行权，enable migration 只授权 `service_role`。
- 浏览器不接触 service role；商品接口不返回客户、回收证据或付款资料。
- 重复标识 advisory lock 按 `store + normalized value`，并跨 `imei1/imei2/serial` 检查。
- 事件和审计使用数据库 `clock_timestamp()`，不接受客户端回填时间。
- 所有失败必须整笔回滚，不留下半个 catalog/unit/movement/ledger。

## 8. 实施工作包

1. WP0：不可变上下文、隔离分支、生产只读 schema/ACL/重复数据预检。
2. WP1：商品/回收 DTO、API façade、query key、服务端投影边界。
3. WP2：dormant quick-create RPC、enable grant、幂等与原子测试。
4. WP3：商品列表、筛选 Sheet、响应式卡片/六列桌面布局。
5. WP4：单页快速录入、保存/继续、草稿与错误恢复。
6. WP5：极简详情与权限裁剪。
7. WP6：回收兼容、负向联动、缓存和导航回归。
8. WP7：DATA/SEC/UX/QA 独立复核、lint/typecheck/test/build/E2E、截图。
9. WP8：精确提交、推送、数据库 expand/enable、生产 Web 部署、smoke、观察和关闭。

## 9. 验证矩阵

- 静态：lint、typecheck、完整 test、build、secret scan、task-only diff。
- 数据：五类最小创建、无标识、空/零金额、重复标识、幂等 replay/conflict、并发、权限、跨店、故障回滚、ACL、reconciliation。
- 浏览器：390×844、430×932、768×1024、834×1194、1024×768、1280×800、1440×900。
- 页面：列表、筛选 Sheet、快速录入、极简详情、空/错误/权限状态。
- Overflow：`document.documentElement.scrollWidth <= window.innerWidth`，并检查 Header、筛选、类别、卡片和详情容器的元素级 scrollWidth。
- 回收：报价保存/finalize/history 不回归；商品创建不进入回收，回收完成不进入商品 UI、不跳转、不交叉失效查询。

## 10. 发布与回滚

发布顺序：

1. 确认生产 migration history、UUID 类型、V2 RLS/ACL、重复标识为 0、reconciliation healthy。
2. 应用 dormant expand migration并复核函数配置/ACL。
3. 应用 service-role-only enable migration。
4. 部署与精确 Git commit 对应的 Web 构建。
5. 用无 PII 合成商品完成最小创建、幂等、重复、权限、回收负向 smoke。
6. 观察 API/Postgres/Vercel 错误与性能，再正式关闭任务。

回滚：先撤回 Web 到上一 READY 部署或关闭 V2 command rollout；用 forward migration 撤销新 RPC 的 service-role EXECUTE。已成功创建的 V1/V2 商品、movement、ledger、event 和 audit 保留，不删除数据、不回滚历史。

## 11. Stop conditions

- 生产 schema/ACL/备份状态不能验证。
- 发现跨店泄漏、成本越权、标识并发重复或部分写入。
- 回收历史、协议、付款、证据或 finalize 回归失败。
- lint/typecheck/test/build/E2E 或主要视口 overflow 不通过。
- 发布 artifact 含无关工作区改动、目标项目/认证不明确或部署无法关联精确 commit。
