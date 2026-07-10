# 工单数据导入导出

Status: implemented
Owner: RepairDesk Integration Lead
Last updated: 2026-07-10

## 范围

工单数据入口只位于 `设置 > 工单数据`。活动订单列表不提供客户端导出按钮。

入口包含四个动作：

- 下载空白 XLSX 模板。
- 导出当前店铺全部安全工单字段。
- 导出当前店铺客户统计。
- 上传 XLSX，先预览，再确认应用。

## 权限与店铺隔离

每次请求都重新检查以下条件：

1. 账号已登录并拥有当前活动店铺的有效 `owner` membership。
2. `actor.id` 等于当前 `stores.owner_user_id`。
3. 店铺状态为 `active`。
4. 多店账号已经明确选择活动店铺。
5. 客户端提交的 `expectedStoreId` 与服务端活动店铺完全一致。

店长、技师、前台、只读成员以及其他 owner membership 均不能调用端点。平台管理员账号若同时就是当前店铺创建者，按正常店铺成员上下文和 `owner_user_id` 判断。

## 工作簿合同

模板版本为 `repairdesk-order-data-v1`，包含：

- `工单`：一行一张工单。
- `维修项目`：一行一个维修项目，通过工单 ID、工单号或稳定外部记录 ID 关联。
- `字段说明`：字段用途和清空规则。
- `枚举值`：导入动作、订单类型和质保月数。
- `示例`：不参与导入的示例行。
- `_元数据`：隐藏的模板版本、解析器版本和导出批次 ID。

导出不包含：

- `store_id`。
- 设备解锁值或图案。
- 客户签名。
- 消息正文。
- 附件 URL、Storage 路径或签名链接。
- 付款流水、退款明细或审计原文。

## 导入规则

默认模式为 `update_only`。需要从其他系统新增工单时，显式选择 `create_and_update`。

- 空白单元格表示保留原值。
- 缺行或删除行不会删除现有工单。
- 只有字段说明标记可清空的列接受 `__CLEAR__`。
- 更新匹配顺序为当前店铺工单 ID、工单号、稳定外部引用。
- 电话、客户名、型号或日期不会作为自动覆盖匹配条件。
- 更新已有工单必须使用当前创建者账号在本店导出的工作簿。
- `版本时间` 与当前 `updated_at` 不一致时标记冲突，不静默覆盖。
- 新增必须填写稳定的 `外部来源 + 外部记录ID`；重复导入同一外部记录不会重复创建。
- 状态、技师、已付金额、余额和付款状态为只读字段。
- 维修项目或定金变化时按已收款金额重新计算报价与余额，不覆盖既有付款流水。
- 已进入报价审批或维修报价流程的财务字段不允许从表格覆盖，必须回到工单页面处理。
- 预览存在错误行时，整批不能应用。

## 文件安全

- 仅接受 `.xlsx`，最大 4 MB。
- 压缩条目最多 250 个，解压后总量最大 25 MB。
- 拒绝加密文件、宏、外部链接、DDE、嵌入对象和不安全 ZIP 路径。
- 工作表、行数和单元格长度均有固定上限。
- 上传工作簿中的公式单元格整批拒绝。
- 导出单元格按文本或数值写入，不生成公式对象。
- 下载响应使用 `private, no-store` 和 `nosniff`。

## API

所有端点均为同源 POST：

| Endpoint                      | 请求                                   | 响应         |
| ----------------------------- | -------------------------------------- | ------------ |
| `orders/data/template`        | `{ expectedStoreId }`                  | XLSX         |
| `orders/data/export`          | `{ expectedStoreId }`                  | XLSX         |
| `customers/data/stats-export` | `{ expectedStoreId }`                  | XLSX         |
| `orders/data/import/preview`  | multipart: file, mode, expectedStoreId | JSON preview |
| `orders/data/import/apply`    | `{ batchId, expectedStoreId }`         | JSON result  |

## 数据库对象

迁移 `20260710150000_order_data_roundtrip.sql` 新增：

- `order_data_batches`：导出和导入批次状态、版本、hash、汇总及过期时间。
- `order_data_batch_rows`：规范化变更、匹配工单、版本、错误码及行级结果。
- `order_external_refs`：店铺范围内稳定外部 ID 到工单的唯一映射。
- `repairdesk_apply_order_data_batch(...)`：锁定批次并逐行原子应用。
- `repairdesk_rollback_order_data_batch(...)`：按应用后的版本号保护性恢复更新行；新增行只标记人工恢复，不自动删除。
- `repairdesk_cleanup_expired_order_data_batches()`：过期与保留期清理。

新表启用 RLS，显式撤销 `public`、`anon`、`authenticated` 权限，只授予 `service_role`。所有工单和批次关联均包含 `store_id`。

未应用预览 24 小时后失效；批次及行级暂存最多保留 30 天。上传的原始文件和原始行不写入数据库或 Storage。创建新的导入预览前会调用清理 RPC，过期预览先清除规范化敏感字段，再按保留期删除。首版不自动安装或调度 `pg_cron`；如后续需要定时清理，应单独发布一个只包含 Cron 配置的小迁移。

## 发布与回滚

发布顺序：

1. 核对 linked migration history 和主店主数据质量。
2. dry-run 新迁移。
3. 应用 additive migration。
4. 发布应用代码。
5. 使用合成数据验证模板、导出、preview、apply、重复 apply 和跨店拒绝。

应用层提供两个紧急关闭开关：`ORDER_DATA_EXPORT_ENABLED=0` 是主开关，会关闭整个设置入口及所有相关端点；`ORDER_DATA_APPLY_ENABLED=0` 只关闭最终应用，模板、导出和预览仍可使用。回滚时先关闭入口和端点，保留新增表用于审计和恢复，不立即 drop。更新行仅在工单、客户和设备仍保持本批次应用后的版本时才能调用恢复函数；存在后续人工修改时记录冲突，不覆盖。新增工单不会自动删除，必须人工核对后处理。

## 同步容量

- 工单导出最多 10,000 行。
- 客户统计最多 10,000 行。
- 导入最多 10,000 张工单和 50,000 个维修项目。
- 预览批次有效期为 24 小时。

超过同步容量时拒绝请求，不自动提高超时或内存上限。
