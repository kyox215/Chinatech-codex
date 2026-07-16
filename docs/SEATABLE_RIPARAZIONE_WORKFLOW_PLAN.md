# SeaTable RIPARAZIONE 维修工单重规划

## 1. 来源与范围

本规划基于 SeaTable 外链 `ChinaTech (1)` 中的第一张子表 `RIPARAZIONE`。该表是当前日常手机/电子维修接单记录的核心来源。

本轮只规划 `RIPARAZIONE`：

- 纳入：维修接单、客户电话、留下物品、维修状态、报价、定金、品牌型号、问题、保修期、供应商/货源、添加时间、取走时间、技术员、IMEI。
- 暂不纳入：`电子产品` 子表、`BUONO` 子表、二手销售库存、优惠券/票据类记录。
- 目标：把现在 SeaTable 的高频记录方式，整理成 RepairDesk 项目里的标准工单流程和数据闭环。

## 2. SeaTable 当前字段观察

`RIPARAZIONE` 当前可见字段：

| SeaTable 字段 | 当前含义 | RepairDesk 规划字段 |
| --- | --- | --- |
| `STATO` | 工单状态，例如进行中、寄修、久等未答复 | `repair_orders.status` |
| `NOME` | 客户姓名，可为空 | `customers.name` |
| `OGGETTO` | 客户留下的物品状态，例如 `LASCIATTO` | `repair_orders.accessory_state` 或从留存备注推导 |
| `DA RIPARARE` | 要修的内容、检查/配件/寄修状态 | `fault_prices`、`issue_category`、`supplier_status` |
| `NUMERO TELEFONO` | 客户电话，可能有多个号码 | `customers.phone_raw`、`customers.phone_e164`、备用电话 |
| `PREZZO TOTALE` | 报价总价，欧元 | `repair_orders.quotation_amount` |
| `ACCONTO` | 定金，欧元 | `repair_orders.deposit_amount` |
| `MARCA` | 品牌 | `device_snapshot.brand` |
| `MODELLO` | 型号 | `device_snapshot.model` |
| `PROBLEMA` | 客户问题、维修描述、配件说明、PIN 等混合备注 | `issue_description`、`diagnosis_result`、`internal_note` |
| `GARANZIA` | 保修期 | `repair_orders.warranty_period`，默认 6 个月 |
| `DATA RITIRO` | 客户取走时间 | `repair_orders.delivered_at` |
| `DATA AGGIUNTA` | 添加/接单时间 | `repair_orders.created_at` |
| `TECNICO` | 技术员 | `repair_orders.technician_name` |
| `S/N o IMEI` | IMEI / 序列号 | `device_snapshot.imei` |

## 3. 新工单核心流程

### 3.1 接单默认流程

新建维修订单时，默认按当前店内习惯处理：

1. 客户送来设备。
2. 系统默认状态写入 `INCORSO / 进行中`，对应 RepairDesk 内部状态建议为 `diagnosing` 或 `repairing`，前端显示为 `进行中`。
3. 填写客户手机号，系统按手机号查找已有客户。
4. 填写客户姓名，可选。
5. 填写品牌、型号、IMEI/序列号。
6. 填写客户描述的问题。
7. 选择维修项目，例如屏幕、电池、尾插、主板、进水、系统、摄像头等。
8. 填写客户留下物品，例如 SIM 卡、卡托、手机壳、充电器、包装盒。
9. 填写报价总价和定金。
10. 保修默认 6 个月，可手动修改。
11. 选择技术员。
12. 如果配件来自供应商，记录供应商/货源和配件状态。

### 3.2 必填字段

新建工单必须具备：

- 客户电话
- 品牌
- 型号
- 问题描述
- 技术员
- 工单状态

建议强提示但不硬阻断：

- 客户姓名
- IMEI / 序列号
- 留下物品
- 报价
- 定金
- 供应商/货源

## 4. 状态与流转规划

SeaTable 的 `STATO` 目前承担了“店内处理阶段”和“客户沟通状态”。RepairDesk 中建议拆成两个层级：

### 4.1 工单主状态

| 前端显示 | 内部状态 | 使用场景 |
| --- | --- | --- |
| 新建 | `new` | 刚录入，尚未开始检查 |
| 进行中 | `diagnosing` / `repairing` | 默认接单状态，正在检查或维修 |
| 等配件 | `parts_ordered` | 已确认需要配件，等待到货 |
| 配件已到 | `parts_arrived` | 配件到货，待继续维修 |
| 寄修中 | `outsourced` | 设备或主板寄给外部供应商维修 |
| 待客户确认 | `waiting_approval` | 已报价，等客户确认 |
| 已修好 | `repaired` | 维修完成但客户未取走 |
| 已通知 | `notified` | 已通知客户取机 |
| 已完成 | `completed` | 客户已取走并结算 |
| 未修取走 | `unfixed_pickup` | 客户取走但未维修成功 |
| 已取消 | `cancelled` | 作废或取消 |

### 4.2 客户沟通状态

SeaTable 中类似 `久等 未答复` 不建议直接作为主状态使用，建议作为沟通标记：

- `no_reply`：客户未答复
- `approval_sent`：已发送报价确认
- `pickup_notified`：已通知取机
- `reminder_needed`：需要再次提醒

这样列表可以同时显示：

- 主状态：进行中
- 沟通标记：久等未答复

不会让工单流转逻辑变乱。

### 4.3 SeaTable 强状态导入规则

导入时 `STATO` 的明确值优先于 `PROBLEMA` 中的历史备注，避免“未修”“下单”等旧文本覆盖当前阶段：

- `FATTO` -> `completed`，归入“已完成”。
- `IN CORSO` / `INCORSO` -> `diagnosing`，归入“正在处理”。
- `到货` / `到货已通知` -> `parts_arrived`，保留通知状态并归入“正在处理”。
- `修好` -> `repaired`，`修好已通知` -> `notified`，两者均归入“正在处理”。
- `作废` / `作废已通知` -> `cancelled`，归入“已取消”。

“正在处理”是业务汇总分类；`parts_arrived`、`repaired`、`notified` 等详细状态仍保留，供店内继续按阶段筛选。

## 5. 客户与电话规则

### 5.1 手机号唯一

客户以手机号作为主要身份：

- 输入手机号时自动规范化。
- 同一手机号复用已有客户。
- 一个客户允许多个联系电话，例如 SeaTable 中 `3292147635/3441227014` 这种格式。
- 主号码用于 WhatsApp，备用号码保留在客户档案。

### 5.2 客户名称

`NOME` 可为空，但系统应允许后续补全：

- 新建工单时可以只填电话。
- 客户详情页可统一修改姓名。
- 工单列表显示优先级：客户姓名 > 电话 > 未命名客户。

## 6. 设备与问题记录

### 6.1 设备快照

每张工单保存独立设备快照：

- 品牌
- 型号
- IMEI / 序列号
- 颜色，可后续从 `电子产品` 模块复用，但本轮不纳入
- 设备备注

客户设备档案可以复用，但历史工单必须保持当时快照，不被后续修改污染。

### 6.2 问题字段拆分

SeaTable 的 `PROBLEMA` 现在混合了：

- 客户描述的问题
- 技师诊断
- 配件说明
- PIN / 密码
- 已更换配件
- 价格拆分
- 内部备注

RepairDesk 应拆成：

- `issue_description`：客户描述的问题
- `diagnosis_result`：技师检查结果
- `fault_prices`：报价项目和价格
- `internal_note`：内部备注，例如 PIN、特殊情况
- `accessory_notes`：客户留下物品，例如 SIM 卡、卡托、手机壳

## 7. 客户留下物品规划

SeaTable 的 `OGGETTO = LASCIATTO` 只表示“有留下物品”，但具体内容经常写在问题或备注里。

RepairDesk 建议：

- 新建工单增加“客户留存物品”字段。
- 支持快捷标签：
  - SIM 卡
  - 卡托
  - 手机壳
  - 充电器
  - 保护膜
  - 包装盒
  - 内存卡
  - 其他
- 支持自由输入，例如 `cmlink sim卡 LV手机壳`。
- 打印受理单必须显示留存物品，避免取机纠纷。

## 8. 报价、定金与付款

### 8.1 金额规则

所有金额统一欧元：

- 总报价：`quotation_amount`
- 定金：`deposit_amount`
- 已付款：`paid_amount`
- 尾款：`balance_amount = max(0, quotation_amount - deposit_amount - paid_amount)`

### 8.2 新建订单

接单时可以先填：

- 报价总价
- 定金
- 付款方式：现金 / 刷卡

如果暂时未报价：

- 总价允许为 0
- 审批状态为 `待报价`
- 后续在详情页补报价

### 8.3 付款闭环

收款必须写入：

- 付款金额
- 付款方式
- 收款时间
- 操作人
- 工单事件

当尾款为 0 时自动标记 `已结清`。

## 9. 供应商与货源规划

用户提到“会留下一行供应商的货源是谁家进的”。这部分建议不要塞进问题描述，而是独立记录。

### 9.1 字段设计

每张工单可选供应商信息：

- 供应商名称
- 供应商联系方式
- 采购/寄修类型：
  - 本店库存
  - 外部拿货
  - 外修主板
  - 返修
- 配件状态：
  - 未订
  - 已订
  - 已到
  - 已使用
  - 已退货
- 供应商成本价
- 供应商备注

### 9.2 与库存联动

当工单状态流转到 `parts_ordered` 或 `parts_arrived`：

- 库存页显示该工单。
- 供应商字段可筛选。
- 取件超期和配件超期可以单独统计。

## 10. 保修期规划

默认保修期为 6 个月。

规则：

- 新建工单默认 `6个月`。
- 快修小项目可选 `无保修 / 1个月 / 3个月 / 6个月`。
- 主板、进水、资料恢复类项目可允许特殊保修说明。
- 打印单使用意大利语显示保修条款。
- WhatsApp 完成通知中可包含保修说明。

## 11. 时间字段规划

### 11.1 添加时间

`DATA AGGIUNTA` 对应接单时间：

- 创建工单时自动写入。
- 列表默认按创建时间倒序。
- 不建议手动改，迁移旧数据时保留原值。

### 11.2 取走时间

`DATA RITIRO` 对应客户取走时间：

- 工单流转到 `completed` 或 `unfixed_pickup` 时写入。
- 如果客户已通知但未取走，保持为空。
- 可用于统计取件超期。

### 11.3 技术员

`TECNICO` 必填：

- 新建工单默认最近使用的技术员。
- 支持列表筛选。
- 维修、报价、收款、通知等事件都记录操作人。

## 12. 列表页规划

工单列表应优先展示接单所需信息：

### 12.1 桌面端列

- 工单号
- 状态 / 沟通标记
- 客户姓名 + 电话
- 留存物品
- 品牌型号 + IMEI
- 问题摘要
- 总价 / 定金 / 尾款
- 技术员
- 供应商/配件状态
- 添加时间 / 取走时间

### 12.2 移动端卡片

移动端一张卡只显示核心：

- 状态
- 工单号
- 客户 + 电话
- 品牌型号
- 问题一行
- 留存物品一行
- 总价 / 尾款
- 添加日期

点击卡片直接打开详情弹窗或详情页，不依赖三个点。

### 12.3 筛选

高频筛选：

- 全部
- 进行中 / `INCORSO`
- 待报价
- 待客户确认
- 等配件
- 寄修中
- 已修好
- 已通知
- 已完成
- 未修取走
- 久等未答复

高级筛选：

- 技术员
- 品牌
- 供应商
- 付款状态
- 是否有定金
- 是否有留存物品
- 添加时间范围
- 取走时间范围

## 13. 详情页规划

详情页按三个区域组织：

### 13.1 客户

- 客户姓名
- 主电话
- 备用电话
- WhatsApp 通知入口
- 历史工单

### 13.2 设备与维修

- 品牌
- 型号
- IMEI / 序列号，支持扫码
- 客户问题
- 技师诊断
- 维修项目
- 留存物品
- 供应商/货源
- 保修期

### 13.3 财务与交付

- 总报价
- 定金
- 已付款
- 尾款
- 付款方式
- 打印受理单
- 通知客户
- 取走确认
- 完成工单

## 14. 打印与客户可见内容

打印单继续使用意大利语，字段必须从工单结构化数据生成：

- `Scheda di riparazione`
- `Cliente`
- `Telefono`
- `Dispositivo`
- `IMEI / Seriale`
- `Oggetti lasciati`
- `Problema segnalato`
- `Intervento richiesto`
- `Preventivo`
- `Acconto`
- `Saldo`
- `Garanzia`
- `Data di ingresso`
- `Firma cliente`

纸张继续按当前项目规则使用 A5 横向。

## 15. WhatsApp 通知规划

客户通知继续走意大利语模板，发送前必须预览可编辑。

模板包括：

- 报价确认
- 等待配件
- 配件到货
- 已修好可取机
- 久等未答复提醒
- 未修取走
- 已完成确认

所有通知写入：

- `message_logs`
- `order_events`
- 对应工单更新时间

## 16. 迁移 SeaTable 数据策略

迁移只处理第一张 `RIPARAZIONE`：

1. 导出 CSV。
2. 清洗电话：
   - 支持 `/` 分隔多个号码。
   - 第一个号码作为主号码。
   - 其余号码作为备用号码。
3. 清洗金额：
   - `PREZZO TOTALE` -> 总报价
   - `ACCONTO` -> 定金
   - 缺失值按 0 处理
4. 清洗设备：
   - `MARCA`、`MODELLO`、`S/N o IMEI`
5. 清洗备注：
   - `OGGETTO` 和问题文本中的 SIM 卡、手机壳、充电器等迁到留存物品。
   - PIN、密码、特殊说明保留到内部备注。
6. 清洗状态：
   - `INCORSO` / 进行中 -> `diagnosing` 或 `repairing`
   - 寄修相关 -> `outsourced`
   - 已取走 -> `completed`
   - 未修好取走 -> `unfixed_pickup`
   - 久等未答复 -> 主状态保持原阶段，沟通标记为 `no_reply`
7. 保留原始行号、源文件 SHA-256 和导入批次号；生产工单事件不得复制整行原始 JSON，完整源文件只保存在受控本地位置。

## 17. 第一阶段落地优先级

### P0：接单闭环

- 新建工单字段对齐 `RIPARAZIONE`
- 默认状态为 `进行中`
- 电话复用客户
- 留存物品结构化
- 报价、定金、尾款计算正确
- 保修默认 6 个月
- 打印单显示留存物品和保修

### P1：供应商/配件闭环

- 工单详情增加供应商/货源区
- 状态支持等配件、配件已到、寄修中
- 库存页按供应商和配件状态筛选

### P2：通知与超期

- 久等未答复标记
- WhatsApp 提醒模板
- 报价超期、取件超期、配件超期

### P3：迁移与报表

- SeaTable CSV 导入脚本
- 迁移预览和错误报告
- 技术员统计、供应商统计、未结清统计

## 18. 不做事项

本规划暂不做：

- `电子产品` 销售/二手机库存模块
- `BUONO` 优惠券/票据模块
- 多门店财务报表
- 自动群发 WhatsApp
- 真实库存扣减

这些可以在维修工单闭环稳定后再单独规划。

## 19. 2026-07-10 管理脚本安全门

- SeaTable import、demo reset 和 seed 默认只做 dry-run。
- seed/reset/SeaTable apply 不再接受 `NEXT_PUBLIC_SUPABASE_URL` 作为管理目标；浏览器公开配置不能成为 service-role 脚本的信任源。
- 写入必须显式提供 project ref、store id 和目标专属确认短语；project/store 任一不匹配即停止。
- seed/reset 只允许 local Supabase；当前 SeaTable apply 同样限制为 local，生产导入需要独立的 staging/import/swap 方案。
- 备份与删除必须按 store 过滤；备份目录权限为 0700、JSON 文件为 0600。没有显式备份目录时不得进入破坏性路径。
- 生产全局清表、默认店铺回退和仅布尔 `--confirm` 均不再属于允许路径。

## 20. 2026-07-11 安全导入包

当前生产能力仅开放只读 preflight，不开放生产 apply：

先在私有进程环境中设置 `SEATABLE_OWNER_EMAIL`；不要通过命令行参数传递 owner 邮箱，以免进入 shell history 或进程列表。

```bash
npm run db:import:seatable -- \
  --file /tmp/repairdesk-seatable-import/riparazione-default.csv \
  --import-batch-id <batch-id> \
  --fallback-date <ISO-timestamp> \
  --project-ref <project-ref> \
  --store-id <store-uuid> \
  --preflight-prod \
  --manifest-out /tmp/repairdesk-seatable-import/import-manifest.json \
  --preflight-out /tmp/repairdesk-seatable-import/production-preflight.json \
  --cleanup-preview-out /tmp/repairdesk-seatable-import/cleanup-preview.json
```

安全属性：

- 批次实体使用确定性 UUID；工单号使用源文件与批次的 16 位摘要命名空间，并做全局碰撞检查。
- `repair_orders.internal_tag` 与 created event payload 保存批次、源文件摘要、源行和固定 fallback 时间。
- created event 默认不保存 `raw` 原始行；历史导入不推定 SMS 或 WhatsApp 同意。
- preflight 核验 project、store、active owner membership、目标店与其他店基线计数、ID/工单号碰撞和金额不变量。
- cleanup preview 只接受 `TEST-####`、`AI_TEST_BATCH_*` internal tag 和匹配 event batch 三重证据；存在额外事件、附件或付款账本时自动排除。
- 所有输出必须位于仓库外、权限为 `0700` 的真实目录；工具拒绝符号链接，写入后强制 JSON 为 `0600`。
- 默认逐行 preview 属于受限假名化数据，不是匿名数据；含 PII 的 preview 或 warning value 还必须显式提供 `--confirm-private-output`。
- 报告中的 `production_mutation_authorized` 始终为 `false`。
- 现有 `--apply` 继续保持 local-only 整店重置语义，不得用于生产。

## 21. 2026-07-11 ChinaTech 生产导入完成

- Owner 批准导入全部 6284 条记录（含 623 条作废）并接受默认补位。
- 4 条定金高于报价记录采用 `raise_quotation_to_deposit`：保留实际定金，把报价提高到定金；报价合计增加 EUR 119。
- 批次 `chinatech-riparazione-20260711-v2` 使用未暴露给 Data API 的 `repairdesk_import_private` schema 暂存；`anon`、`authenticated` 和 `service_role` 均无权限。
- 最终事务在固定 store advisory lock 下精确删除 20 个测试客户、20 台测试设备和 20 条测试标签关联，再按 customers、devices、repair_orders、order_events 顺序写入。
- 正式提交前，同一事务正文完成强制回滚演练；提交后，选择性恢复脚本也完成强制回滚演练。
- 最终导入：3664 customers、6284 devices、6284 repair_orders、6284 order_events。
- 最终金额：报价 EUR 335021.50，定金 EUR 39192.51，金额不变量违规 0。
- 其他店铺 customers/devices/orders/events 均保持 1/1/1/1；消息、附件、付款账本副作用为 0。
- 三类历史同意 `consent_required_notify`、`consent_marketing`、`consent_sms` 均显式为 false。
- 私有暂存与恢复 before-image 保留至 2026-07-18；之后应在确认无需回滚后清理。

## 22. 2026-07-12 状态重分类完成

- 仅对批次中 24 张已证明不匹配的工单执行了受保护重分类；没有重跑 6284 行导入，也没有修改金额。
- `修好已通知` / `修好一通知` 映射为 `notified`；`到货已通知` 保持 `parts_arrived`，两者的通知副状态为 `sent`。
- 通知证据只读取强来源 `STATO`；自由文本中的“已通知”不能伪造通知状态。
- `delivered_at` 只接受明确交付状态；到货、修好或作废通知均不等于客户已取走。
- 重分类验收汇总中的 EUR 335046.50 / 39212.51 包含一张导入前已存在的真实工单；与导入批次的 EUR 335021.50 / 39192.51 相差 EUR 25 / 20，不代表重分类改动了金额。
