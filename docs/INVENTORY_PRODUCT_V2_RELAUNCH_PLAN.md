# RepairDesk 库存商品 V2 重建与正式上线规划

> 状态：首个可发布纵向切片已实施 / 生产数据库与门店灰度待独立批准
> Owner：Hexiang Huang / 鹤祥
> 任务：`TASK-20260718-011-inventory-product-v2-plan`
> 风险与自治：T3 / R4 / L2 规划态
> 研究与代码审计日期：2026-07-18 Europe/Rome

## 1. 结论

不直接物理删除当前库存表、历史商品、回收记录、客户关系、付款流水或附件。推荐采用“替换式重建”：
```text
冻结 V1 功能扩张
→ 建设 V2 数据合同和新页面
→ 只读迁移预检
→ 新旧并行与历史核对
→ 单店切换
→ 观察与可回滚
→ 退役 V1 页面/API 写入
→ 单独批准后清理不再使用的代码与数据结构
```

目标前台只呈现五个新手可理解的阶段：

```text
录入 → 检测/整备 → 上架 → 售卖 → 完成/售后
```

底层保留现有状态作为兼容层，避免一次性改写历史数据。未正式启用的 AI 小助手作为受保护的并行能力继续建设，并嵌入“读取设备、确认型号”步骤；AI 只生成可编辑草稿，不直接写正式库存、价格、付款或客户数据。

## 2. 当前项目审计

### 2.1 已有且应保留的能力

- `/inventory` 已有搜索、扫码、状态视图、移动卡片、桌面表格、KPI、空态和错误态。
- 底层已有库存记录、质检、交易流水、事件时间线、附件、回收成交与门店隔离。
- 已有 `customer_id`、`buyer_customer_id`，服务端可按手机号复用或创建客户。
- 已有服务端权限：查看、创建、编辑、质检、销售、报损和历史导入。
- 已有回收专用的证件、签名、幂等成交与资料清除门禁；不得被普通库存入口绕过。
- 已有销售保修票据预览和打印能力，但它只是 RepairDesk 内部业务/保修文档，不能自动视为意大利法定的财政商业凭证。
- `origin/main` 已包含受功能旗标、门店 allowlist、权限和人工复核保护的 AI 小助手与拍照入库实现；V2 继续复用这套图片去元数据、候选合并和逐字段确认边界。

### 2.2 当前正式上线阻断项

| 级别 | 问题 | 当前证据 | 影响 |
|---|---|---|---|
| Blocker | 库存页面把列表、详情、录入、检测、销售、票据、导入集中在一个约 3318 行文件 | `src/features/inventory/screens/inventory-screen.tsx` | 难维护、难独立测试、新手一次看到过多信息 |
| Blocker | 普通手工商品默认可直接进入 `listed` | `inventory-screen.tsx` 的 `IntakeDialog` | 可能跳过检测、资料清除、激活锁和重复标识检查 |
| Blocker | `sellInventoryItem` 先更新商品为已售，再单独插入销售流水和事件 | `src/features/inventory/server/inventory.repository.ts` | 中途失败可能出现“已售但流水不完整”，不满足原子成交 |
| Major | 没有独立商品目录、型号、规格、单台设备和库存移动分层 | `src/lib/repairdesk/types.ts` 的 `InventoryItem` | 品牌/型号/容量重复自由输入，无法稳定统计或复用 |
| Major | 一个 `serial_or_imei` 字段承载 IMEI/序列号 | 当前 types/schema/migration | 无法可靠处理双 IMEI、EID、序列号、EAN/GTIN 和内部 SKU |
| Major | 手机、电脑、配件都进入同一个“单件设备”结构 | `CreateInventoryIntakeInput` | 配件应按数量管理，高价值设备应按单台序列管理 |
| Major | 录入和售卖 UI 仅提交客户姓名/电话，没有可见的客户选择确认 | `intakeInput`、`sellInput` | 容易让员工不清楚是复用客户还是新建客户 |
| Major | 销售不是独立销售单，票据快照存入 `legacy_payload.sale_receipt` | `inventory-sale-receipt.ts`、repository | 不利于多商品销售、部分付款、退款、重打和法务版本管理 |
| Major | 当前列表/分页会分批读取整店库存后在 Node 端过滤、统计和切页 | inventory repository | 数据量增长后延迟、内存与数据库读取成本不可控 |
| Major | 保修条款硬编码在前端/领域文件 | `inventory-sale-receipt.ts` | 无版本、无店铺政策、无法跟随法律与通知要求更新 |
| Major | SeaTable 导入占据库存主工具位 | `ImportDialog` | 迁移工具干扰日常新手流程 |
| Major | 当前客户设备仍只有自由文本品牌、型号、单标识符 | customer device form/types | 维修、客户、库存和销售不能共享统一设备身份 |
| Minor | 1024px 桌面表格仍依赖最小宽度和局部横向滚动 | inventory list table | 窄桌面密度与可读性不稳定 |
| Minor | 当前列表初始 skeleton 偏移动结构 | inventory list loading branch | 桌面加载反馈不完整 |

### 2.3 当前工作区约束

- 当前 `main` 相对 `origin/main` 为 ahead 1 / behind 45，并存在大量其他任务未提交改动。
- 后续实现必须从刷新后的 `origin/main` 建立隔离工作树/分支；不得在当前混合工作区删除、stage 或发布。
- 生产数据库仍存在项目级历史迁移与广泛 DB gate，任何新 migration 只能先写文件和 dry-run，apply 需要独立批准。

## 3. 产品范围

### Must：正式首版

- 统一商品目录、型号/规格和单台库存身份。
- 正式首发先覆盖手机/平板等序列化设备；同一 V2 模型同时支持配件数量库存，待数量流与盘点验证通过后再替代 V1 配件入口。
- 逐步式手机录入、扫码/手工常驻、AI 拍照可选。
- 客户搜索、选择、快速创建和购买历史。
- 原子销售确认：销售单、商品出库、付款、保修快照、审计一次完成。
- 退货/退款/售后可追溯，不直接改历史流水。
- 手机与桌面统一 RepairOS 视觉语言并分别优化信息密度。
- V1 历史数据兼容读取、迁移核对、可回滚切换。
- 权限、门店隔离、RLS、幂等、并发版本与脱敏审计。
- 意大利保修、商业凭证和税务流程的操作边界与人工确认。

### Should：首版稳定后

- 批量采购收货和供应商单据导入。
- 预订、定金、尾款、多次付款和重打票据。
- 客户详情中的购买记录、已购设备与保修状态。
- 低库存提示、库存盘点、调整原因和差异报告。
- 维修完成后转售、回收转库存的统一来源链。
- AI 型号匹配、重复设备提示和只读库存查询。

### Later

- 外部电商平台上架/同步。
- 自动补货、价格建议和需求预测。
- 注册收银机/RT 或第三方财政系统的直接 API 集成。
- 公开客户 AI 助手。
- 多仓库、调拨、组合商品和复杂采购订单。

### 明确不做

- 不在 V2 验证前删除历史数据库对象或附件。
- 不让 AI 猜成本、售价、成色、所有权、激活锁、真伪或盒内实物配置。
- 不把 AI、客户端或 URL 参数作为 `store_id`、actor 或权限来源。
- 不把内部保修票据冒充 Agenzia delle Entrate 的商业凭证。
- 不把供应商强行建成客户。
- 不在首版依赖未经授权、许可不清或不可维护的第三方手机型号数据库。

## 4. 推荐领域模型

### 4.1 核心实体

| 实体 | 目的 | 关键字段/约束 |
|---|---|---|
| `product_catalog_items` | 商品类别/品牌/标准型号主档 | store、category、brand、model、tracking_mode、active |
| `product_variants` | 型号的可售规格 | catalog_item、RAM、storage、color、GTIN/EAN、internal_sku、unique normalized key |
| `stock_units` | 单台序列设备 | variant、condition、source、status、primary identifier、cost、location、version |
| `stock_unit_identifiers` | 多标识符 | unit、kind、slot、normalized value、validation、同店唯一约束 |
| `stock_balances` | 配件数量库存 | variant、on_hand、reserved、available、version |
| `stock_movements` | 所有库存变化的事实账 | receive/reserve/release/sell/return/adjust/write_off、quantity、source ref、idempotency |
| `sales` | 一次销售业务单 | customer、status、totals、warranty/fiscal status、idempotency、version |
| `sale_lines` | 销售商品行 | sale、variant/unit、quantity、price、discount、tax/fiscal snapshot |
| `sale_payments` | 可追加的付款账 | sale、amount、method、status、external ref、idempotency |
| `sale_returns` | 退货/退款流程 | sale line、reason、resolution、refund ref、restock decision |
| `warranty_snapshots` | 成交时不可变的保修说明 | sale line、legal/commercial policy version、start/end、disclosed defects |
| `ai_intake_drafts`（可选） | AI 可恢复草稿 | actor/store/session/version/expiry，不含不必要原图与完整聊天 |

### 4.2 两种库存追踪模式

| 模式 | 适用 | 规则 |
|---|---|---|
| `serial` | 手机、平板、电脑、游戏机、高价值单品 | 每台一条 `stock_unit`；可有 IMEI1、IMEI2、serial、EID；数量恒为 1 |
| `quantity` | 手机壳、贴膜、数据线、普通配件 | 以 variant + movement 管数量；不要求每件序列号 |

GS1 的正式追溯模型区分产品级 GTIN、批次级 GTIN+lot 和单件级 GTIN+serial。RepairDesk 首版用相同思路区分“型号/规格”和“某一台真实设备”，但不要求门店立即申请 GS1 前缀；已有 EAN/GTIN 可保存，门店内部仍可使用自己的 SKU。

### 4.3 关键不变量

- 标准型号与真实设备分离；型号不是库存，单台设备/余额才是库存。
- 同店同种有效标识符不得绑定两台活跃设备；冲突必须人工处理。
- 序列设备可用数量只能是 0 或 1。
- `available = on_hand - reserved`，不得出现负可售数。
- 销售、出库、付款首笔、保修快照和审计在一个数据库事务/RPC 中原子完成。
- 每次正式 mutation 带 `store_id`、actor、idempotency key、expected version。
- 退款采用追加负向/冲正业务记录，不覆写原付款。
- 历史 `inventory_items` 在迁移期间只作为 V1 事实源或兼容投影，不双向自由写入。
- AI 草稿与正式业务实体隔离；草稿过期、门店切换或版本变化后不可应用。

## 5. 新手手机录入流程

正式页面使用 `/inventory/new`，不再把全部字段塞进一个 Dialog。

### 第 1 步：选择来源

- 供应商采购
- 客户回收
- 维修后转售
- 现有库存补录

选择“客户回收”立即转入现有回收合规流程，不能走普通入库绕过证件、签名、报价和付款。

### 第 2 步：读取设备

- AI 拍标签
- 扫码 / IMEI
- 手工录入

三种入口同级。AI/相机失败、离线或被拒绝时可立即改用手工，当前草稿不丢失。

### 第 3 步：确认型号与标识

- 类别、品牌、型号
- RAM、存储、颜色
- 主 IMEI / serial
- IMEI2、EID、EAN/GTIN、内部 SKU 等其他候选

型号选择顺序：最近使用 → 搜索标准目录 → AI/扫码候选 → 手工新建待标准化型号。没有目录匹配时允许继续，但必须标记“未标准化”，不能静默替换。

标识符在离开字段和进入下一步时查重。IMEI 格式或 Luhn 校验通过不代表设备所有权或真机匹配。

### 第 4 步：来源主体

- 客户回收/维修转售：手机号搜索已有客户，选择后展示确认卡；未找到时姓名+手机号快速创建。
- 供应商采购：选择独立供应商记录；不能写入客户表。
- 补录：允许无外部主体，但必须填写补录原因。

### 第 5 步：成本与初始业务信息

仅显示当前来源需要的字段：采购/入库成本、整备预算、计划售价、付款方式、保修策略、位置、备注。

金额使用 string draft，可清空，支持 `,` 与 `.`。AI 永远不填写金额、成色、所有权、激活锁或真伪。

### 第 6 步：复核并保存

按“设备、来源、金额、待完成门禁”显示摘要。默认保存为“待检测”，主按钮为“保存并开始检测”；次按钮为“保存，稍后检测”。双击、超时重试和浏览器重发只能创建一个实体。

## 6. 检测、整备与上架

前台只显示一个推荐下一步，不让新手任意选择底层状态。

| 新手阶段 | 兼容 V1 状态 | 上架门禁 |
|---|---|---|
| 录入 | `intake` | 基础身份与来源完整 |
| 检测/整备 | `evaluating`、`offer_made`、`purchased`、`data_wipe`、`refurbishing`、`returned` | 二手机 IMEI/serial、激活锁、资料清除、功能/成色、成本完整 |
| 上架 | `ready_for_sale`、`listed` | 售价与保修政策完整，无硬阻断 |
| 售卖 | `reserved` | 有效预订/定金与过期策略 |
| 完成/售后 | `sold`、`cancelled`、`recycled` | 只能通过销售、取消、报损或售后专用动作进入 |

新机/封装采购和二手机使用不同检查模板；系统基于来源和 condition 决定必填项，不能简单让普通手工录入绕过二手机门禁。

## 7. 客户管理

- 继续以当前客户模块为唯一客户事实源。
- 库存录入、销售、维修单统一复用“手机号搜索 → 选择客户 → 快速创建”。
- 正式提交使用 `customer_id` / `buyer_customer_id`，姓名和电话只作为显示快照或创建输入。
- 客户详情新增：购买记录、已购设备、维修记录、保修状态、退货/售后。
- 同一真实设备从购买进入客户设备档案时保留 `stock_unit_id` 关联，不复制成互不相识的字符串记录。
- 匿名零售是否允许、何种金额/商品必须采集客户资料，需要 Owner 与 commercialista/隐私顾问确认；系统不得默认强制收集不必要 PII。

## 8. 正式售卖流程

使用独立 `/inventory/[id]/sell` 或桌面受控工作区，不再使用一次性销售 Dialog。

1. **商品确认**：设备/配件、标识尾号、数量、检测与资料清除门禁。
2. **客户**：搜索/选择/快速创建；按批准政策允许匿名零售。
3. **成交与付款**：成交价、折扣原因、定金/已收/尾款、付款方式、渠道。
4. **保修与披露**：新/二手、已知缺陷、法定保证、额外商业保修、语言。
5. **财政凭证确认**：记录外部 RT/Documento Commerciale/发票方式与引用；RepairDesk 内部票据不替代财政凭证。
6. **最终确认**：清楚说明将原子产生销售单、库存出库、付款、保修快照和审计。
7. **结果**：打印/重打内部交付单、查看客户、发送消息、返回库存。

部分成功边界：

- 核心销售事务成功、打印失败：不得重试销售，只允许重打。
- 核心销售成功、消息失败：单独重发消息。
- 响应未知：用 idempotency key 查询原结果，不能创建第二笔销售。
- 财政凭证外部系统失败：按批准的操作策略进入 `fiscal_pending`，不得伪装已完成；是否允许先交付由 Owner/commercialista 决定。

## 9. AI 小助手保留与介入

AI 资产列为明确禁止删除范围：

- `docs/AI_ASSISTANT_VISION_INTAKE_PLAN.md`
- `.ai-company/memory/tasks/TASK-20260718-009-ai-assistant-implementation/`
- 忽略文件中的 OpenAI 本地 Secret（不读取、不打印、不复制）
- 后续 `src/features/ai-assistant/`、服务端 provider、模型/提示/工具版本与黄金集

AI 介入点：

| 场景 | AI 可以 | AI 不可以 |
|---|---|---|
| 手机录入 | 识别标签、提出品牌/型号/RAM/存储/颜色候选 | 直接创建库存 |
| 标识符 | 结合 OCR/条码显示候选、冲突与证据 | 把多个 IMEI 拼成一个值或绕过确定性校验 |
| 型号目录 | 推荐最相近标准型号并解释差异 | 无证据自动选择 |
| 重复检查 | 只读提示可能重复记录 | 修改或合并记录 |
| 客户/库存查询 | 调用白名单只读工具返回有限字段 | 通用 SQL、跨店查询、付款/权限/正式写入 |
| 业务草稿 | 把员工确认字段应用到当前页面草稿 | 填成本、售价、成色、所有权、锁状态或真伪 |

AI 结果使用“高可信 / 需核对 / 未识别 / 冲突”，不显示未经校准的模型百分比。每个字段可接受、修改、清空、拒绝和撤销回填。图片只代表标签声明，不证明盒内设备或所有权。

AI 仍受现有 pending 门禁约束：API 预算、真实客户/IMEI/图片外发、DPA/ZDR/MAM/EU residency、生产 Secret、生产迁移和公开客户入口都需要独立批准。

## 10. 页面与响应式规范

### 10.1 页面地图

```text
/inventory                  工作队列
/inventory/new              逐步录入
/inventory/[id]             移动详情 / 桌面可复用详情工作区
/inventory/[id]/check       检测与整备
/inventory/[id]/sell        售卖向导
/inventory/sales/[saleId]   销售结果、付款、保修与重打
/customers/[id]             增加购买/已购设备视图
设置 / 数据工具              历史导入、迁移报告、目录管理
```

### 10.2 统一但不等同的跨端体验

- 颜色、字体、卡片、Badge、状态语义、字段顺序和按钮文案全端一致。
- 移动端使用 Floating Card、单列、底部一个主动作、真实输入字号至少 16px。
- 桌面端使用固定侧栏、高密度表格、稳定 Dialog/Workspace 和键盘操作。
- 390/430 无横向滚动；768 进入平板双列；1024 使用压缩表格；1280/1440 才展示完整财务和来源列。
- 列表移动卡一屏目标 4–7 条；桌面不退化为大卡片堆叠。
- 导入、导出、目录维护等低频动作放“更多/设置”，不占移动主入口。

### 10.3 必备页面状态

Default、Loading、Empty、Error、Offline、No permission、Partial success、Duplicate、Validation、Stale conflict、Pending、Unsaved draft、Camera denied、No catalog match 全部必须有可测试设计。

## 11. 权限与安全

| 能力 | Owner/Manager | Technician | Sales | Viewer |
|---|---:|---:|---:|---:|
| 查看库存 | 是 | 是 | 是 | 默认否 |
| 创建设备草稿/入库 | 是 | 是 | 是 | 否 |
| 检测/整备 | 是 | 是 | 默认否 | 否 |
| 查看成本/利润 | 是 | 按授权 | 按授权 | 否 |
| 上架/预订 | 是 | 按授权 | 是 | 否 |
| 确认销售/收款 | 是 | 否 | 是 | 否 |
| 退货/退款/报损 | 是 | 按细分授权 | 按细分授权 | 否 |
| 目录和迁移管理 | Owner | 否 | 否 | 否 |
| AI 草稿 | 仍受对应业务权限约束，AI 不新增任何权限 |

最终矩阵在实现前由 Owner 批准；所有关键规则服务端执行，隐藏按钮不算权限控制。

## 12. V1 → V2 迁移与删除合同

### 12.1 绝不随第一阶段删除

- `inventory_items`、quality checks、transactions、events、attachments 的历史数据。
- 回收协议、证件/签名受限附件、付款证据和审计日志。
- 客户、设备、供应商和订单关联。
- AI 计划、任务记录、Secret 配置和后续实现目录。
- `/inventory` 路由本身；它应切换到 V2，保留书签兼容。

### 12.2 可逐步退役

- 3318 行 V1 `inventory-screen.tsx` 中的旧录入、检测、售卖、票据和导入交互。
- `src/routes/inventory.tsx` 旧兼容入口（确认无引用后）。
- SeaTable 导入的主导航入口；迁至受限数据工具，迁移窗口结束后再决定删除。
- V1 写 API；先变成兼容适配器/只读，再在客户端与任务全部切换后移除。
- `legacy_payload.sale_receipt` 新写入；保留历史读取适配器直到保留期结束。

### 12.3 数据迁移步骤

1. 统计每店 V1 商品、状态、来源、标识符、客户/买家、交易、附件和异常数量。
2. 生成确定性映射：catalog item → variant → stock unit/balance → movements → sales。
3. 对自由文本品牌/型号只做规范化候选，不自动合并有歧义记录。
4. 标记重复 IMEI、多标识符拼接、缺客户、sold 无流水、流水不平、非法状态为人工修复队列。
5. dry-run 输出每店可迁移/需复核/阻断计数和哈希，不写生产。
6. 备份与恢复演练通过后，按 store 分批幂等迁移。
7. 新旧读模型对账：数量、成本、销售额、利润、客户购买、附件和状态。
8. V2 先影子读，再单店写入；V1 保留只读回退窗口。
9. 观察期通过后关闭 V1 写入口；最终删除需新的执行级批准包。

回滚顺序：关闭 V2 写旗标 → 恢复 V1 只读/写路由（仅在兼容窗口内）→ 回退应用 → 保留新增表和迁移记录用于审计；不紧急 DROP 表。

### 12.4 建议功能开关

- `INVENTORY_V2_SCHEMA_READY`：仅表示 V2 schema 与权限门禁已验证。
- `INVENTORY_V2_SHADOW_READ`：允许 V2 只读投影和对账，不改变正式写入。
- `INVENTORY_V2_COMMANDS`：按门店开放 V2 mutation；默认关闭。
- `INVENTORY_V2_UI`：按门店切换 `/inventory` 到 V2 页面；默认关闭。
- `INVENTORY_LEGACY_MUTATIONS_ENABLED`：兼容窗口内保留 V1 写入；切换后关闭，但不立即删代码或表。

## 13. 分阶段实施计划

### Phase 0 — 基线、批准与隔离

- 从最新 `origin/main` 建隔离工作树。
- 固化 V1 数据/流程/权限/财务基线与异常统计。
- 批准 PRD、权限、匿名客户、财政凭证、保修政策和 AI 隐私边界。
- 建 ADR、威胁模型、数据迁移和回滚合同。

退出：没有未经登记的破坏性删除；所有 D4 决策有 owner。

### Phase 1 — V2 领域模型与兼容读层

- additive migration：目录、规格、单台设备、多标识符、movement、sale、payment、warranty snapshot。
- RLS、复合 tenant FK、最小 Grants、幂等、CAS、索引。
- V1 → V2 只读投影、dry-run 和对账报告。

退出：schema clone/dry-run/恢复/权限测试通过；不 apply 生产。

### Phase 2 — 新库存列表、详情与型号目录

- 新 V2 列表、移动详情、桌面工作区、简化五阶段。
- 最近型号、目录搜索、未标准化型号和目录管理。
- 完整 loading/empty/error/offline/permission 状态。

退出：6 个 viewport、键盘、无横向溢出和截图门禁通过。

### Phase 3 — 逐步序列设备录入

- 六步手机/平板录入、客户/供应商选择、重复标识阻断。
- 手工、扫码和 AI fake provider 入口。
- 幂等创建、草稿恢复和审计。

退出：双击/重试只创建一次；普通录入不能绕过回收或二手机门禁。

配件数量录入在同一 V2 领域模型上作为后续受控切片交付；在收货、库存移动、盘点、销售与退货对账全部通过前，不关闭 V1 配件入口。

### Phase 4 — 检测、整备、上架

- 来源驱动检查模板、缺失项、唯一下一步。
- 价格、成本、附件、时间线和上架门禁。
- 预订与释放库存。

退出：所有非法状态转换被服务端拒绝；库存余额无负数。

### Phase 5 — 客户与原子售卖

- 客户选择/快速创建、购买历史、已购设备。
- 原子销售 RPC、付款账、保修快照、财政引用、结果页、重打。
- 退货/退款/重新入库的补偿事务。

退出：故障注入下无“已售但无销售单/流水”；退款不覆写原记录。

### Phase 6 — AI 真实草稿能力

- 完整重读并遵循 AI 主计划。
- 图片安全处理、OCR/条码/视觉合并、置信/冲突、逐字段确认和撤销。
- 模型调用 default-off；真实图片/IMEI 仍由隐私批准门控制。

退出：AI 不可直接正式写入；OpenAI 故障时手工流程完整可用。

### Phase 7 — 迁移、灰度与切换

- Preview 全链路；单店 Owner 影子读；再开放 V2 草稿/写入。
- 每店对账、生产冒烟、观察、告警和回滚演练。
- `/inventory` 切换 V2；V1 进入只读。

退出：观察窗口无 P0/P1，核心业务指标与对账通过。

### Phase 8 — V1 退役

- 删除旧 UI/未引用适配器和迁移主入口。
- 保留历史读取与法定/业务留存。
- 物理表/字段清理仅在新的 D4 删除批准后执行。

退出：全局引用扫描、构建、数据恢复证明和生产观察完成。

## 14. 验证与发布门禁

### 自动验证

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- 领域、API、RLS、迁移、幂等、并发、负余额和原子故障注入测试
- V1/V2 每店对账与恢复演练

### 端到端角色

- Owner：目录、成本、销售、退货、迁移报告。
- Technician：录入、检测、整备，不越权查看利润或收款。
- Sales：客户、预订、成交、重打，不报损或改成本。
- Viewer：默认不能查看库存。

### 视口

390×844、430×932、768×1024、1024×768、1280×800、1440×900；每个视口验证超长型号、键盘、相机/扫码、金额、错误、重复、部分成功和 `scrollWidth <= innerWidth`。

### 生产放行指标

- 跨店/越权成功：0。
- 重复 IMEI/序列活跃绑定：0。
- 双击/重试重复入库或销售：0。
- 已售但无销售单/出库/付款结果：0。
- V1/V2 数量、销售、客户、附件阻断性对账差异：0。
- AI 高置信错误标识符被自动正式接受：0。
- 手工兜底成功率：100%。

## 15. D4 Owner 决策与外部专业确认

| 决策 | 推荐 | 未批准前默认 |
|---|---|---|
| “删除”含义 | 替换 UI/写路径，历史数据不物理删除 | 不删除 |
| 匿名零售客户 | 数据最小化，仅在业务/税务允许时使用 | 需要客户选择或明确人工政策 |
| 二手保修期 | 系统支持 24 个月默认及经明确约定不短于 12 个月的版本 | 先按 MIMIT/顾问确认的店铺政策，不硬编码缩短 |
| 财政凭证 | 首版记录外部 RT/Documento Commerciale 引用；自动集成后置 | 内部票据不得标记为财政凭证 |
| 旧 V1 生产写入关闭 | V2 单店灰度和对账通过后执行 | 保持现状 |
| 生产 migration apply | linked dry-run、恢复、RLS/Grants 后逐店批准 | 不 apply |
| AI 真实数据外发 | DPA/保留/驻留/预算/隐私告知批准后单店开放 | 仅 fake/脱敏 fixture |
| V1 物理表/字段删除 | 保留期、恢复、引用扫描和新批准包后 | 永不自动删除 |

本计划不是法律或税务意见。意大利法定保证、二手商品约定、财政凭证、IVA/regime del margine 和 POS/RT 操作应在发布前由 commercialista 或合格顾问确认。

## 16. 研究依据

- GS1 Global Traceability Standard：产品级 GTIN、批次级 GTIN+lot、单件级 GTIN+serial 的分层追溯。https://www.gs1.org/standards/gs1-global-traceability-standard/current-standard
- Odoo 官方序列号文档：高价值电子设备使用单件序列追踪，收货、销售和售后保留完整轨迹。https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/serial_numbers.html
- Odoo 官方 POS 序列号文档：销售时扫描/选择跟踪号并关联商品移动。https://www.odoo.com/documentation/18.0/applications/sales/point_of_sale/shop/serial_numbers.html
- MIMIT Garanzia legale：新商品法定保证 2 年；二手商品可明确约定更短责任期，但不得少于 1 年。https://www.mimit.gov.it/it/mercato-e-consumatori/tutela-del-consumatore/diritti-del-consumatore/garanzia-legale
- Your Europe 商业保证说明：专业卖家的二手商品也受法定保证保护；各国允许时可明确约定至少 1 年。https://europa.eu/youreurope/citizens/consumers/shopping/guarantees/index_en.htm
- Your Europe 2026 保证告知：统一保证告知从 2026-09-27 起成为强制要求，正式版需预留版本化告知能力。https://europa.eu/youreurope/business/dealing-with-customers/consumer-contracts-guarantees/eu-legal-guarantee-notice-and-garan-label/index_en.htm
- Agenzia delle Entrate：零售交易的商业凭证与日结数据通过 RT 或官方 Documento Commerciale online 处理；2026 年还有 POS 与凭证工具关联要求。https://www1.agenziaentrate.gov.it/servizi/scadenzario/main.php?chi=3982&come=549&cosa=11527&entroil=30-06-2026&op=4
- OpenAI 官方 API：Responses API 支持图像输入；结构化输出只能约束形状，业务仍需确定性校验和人工确认。https://platform.openai.com/docs/quickstart/make-your-first-api-request
- OpenAI 官方数据控制：图片/文件输入存在独立的数据保留与内容安全边界，`store:false` 不等于所有情形下的零保留。https://platform.openai.com/docs/models/default-usage-policies-by-endpoint

## 17. 批准后的第一步

批准本规划后，第一执行阶段只做 Phase 0：建立隔离工作树、冻结 V1 基线、输出生产只读数据预检和 ADR/批准包。不删除业务代码、不 apply 数据库、不调用付费 AI、不发布生产。Phase 0 通过后再提交 Phase 1 的实施合同。
