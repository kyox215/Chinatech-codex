# 库存商品设备资料、扫码与移动端实施方案

状态：已实施，待生产发布门禁完成
任务：`TASK-20260730-002-inventory-device-data-implementation`

## 1. 目标与边界

- 商品库存与回收管理继续保持独立：商品 API、页面、实时事件与回收流程不联动。
- 支持手机、平板、电脑、游戏机和其他电子产品快速录入。
- 禁止顶部步骤分组栏、伪进度条和核心流程横向滚动。
- 商品详情只回答“是什么、状态、标识、关键资料、经营信息”，不承载回收评估流程。
- 完整 IMEI、序列号和 EID 只在有 `inventory:update` 权限的编辑页短时显示。

## 2. 页面方案

### 快速录入 `/inventory/new`

默认可见：类别、品牌、型号、常用容量/RAM/颜色和主设备标识。品牌使用可输入的类别候选列表，自定义品牌仍可直接录入。

设备标识支持摄像头扫码、照片本地识别、粘贴和手工输入；手机主路径为 IMEI 1，其他类别主路径为序列号。识别候选始终脱敏并要求人工确认，原图不上传。

“更多信息”包含 IMEI 2、EID、EAN/GTIN、成色、类别专属规格、售价、成本（按权限）、库位、保修和备注。“保存并继续录入”保留同款身份/规格/库位，清空单件标识及本次经营数据并生成新的幂等键。

### 极简详情 `/inventory/[id]`

按顺序显示：商品身份与状态、脱敏设备标识、实际有值的设备资料、经营信息、备注。已售出/已移除商品不显示编辑入口。页面无回收报价、客户确认、步骤轨道或进度栏。

### 编辑 `/inventory/[id]/edit`

编辑页要求显式 `inventory:update` 权限和设备资料子旗标。保存使用库存单元 `version` 做 CAS；冲突时保留本地草稿，把服务器未冲突字段合并进来，再由员工检查并重试。相同请求内容复用幂等键。

门店、membership 或权限指纹变化时，组件立即重新挂载并清空完整设备标识；对应 React Query 根同时从租户和权限缓存中移除。

## 3. 数据模型

- 型号级：`inventory_product_variants.ram_capacity`、`storage_capacity`、`color`、`gtin`、`specifications`、`specification_schema_version`。
- 单件级：`inventory_stock_unit_identifiers` 保存 `imei1`、`imei2`、`serial`、`eid`，包含来源、主标识和退休历史。
- EAN/GTIN 按零售商品语义归属型号变体，可被同款多件共享；不参与单件唯一索引。
- 同门店活动设备标识跨 IMEI/Serial/EID 唯一；同一库存单元同类活动标识最多一个，且有外部标识时恰有一个主标识。
- 更新采用 copy-on-write 选择/创建目标 variant，不原地修改共享规格。
- `inventory_product_update_command_ledger` 提供更新幂等；`inventory_stock_units.version` 提供乐观并发控制。

## 4. API 与权限

| 路径 | 权限 | 返回 |
|---|---|---|
| `inventory/products/list` | `inventory:read` | 列表和精确标识搜索均只返回脱敏值 |
| `inventory/products/get` | `inventory:read` | 极简详情、脱敏标识 |
| `inventory/products/edit-data` | `inventory:update` | 完整标识；UUID 严格校验、no-store、数据库限流、最小审计 |
| `inventory/products/quick-create` | `inventory:create` | 原子创建结果；成本另验 `inventory:cost_allocate` |
| `inventory/products/update` | `inventory:update` | CAS 更新结果；成本另验 `inventory:cost_allocate` |

两个写 RPC 均为 `SECURITY DEFINER`、空 `search_path`、postgres owner，应用层只授予 `service_role` execute。RPC 内再次验证门店、员工 membership、终态、幂等、版本和标识唯一性；`anon`/`authenticated` 无执行权。

## 5. 响应式与可访问性

- `<1024px` 使用 RepairOS Floating Card；`>=1024px` 提供独立桌面标题、返回与编辑入口。
- 390/430/768/1024/1440 均要求 `document.scrollWidth <= innerWidth`。
- 核心表单不使用横向滚动容器；所有网格子项 `min-w-0`，长值换行。
- 移动端操作至少 44px，输入字号至少 16px；Serial 使用文本键盘，IMEI/EID 使用数字键盘。
- 类别使用 radiogroup 键盘模型；标签 ID 唯一；字段错误通过 `aria-invalid`/`aria-describedby` 关联。
- 扫描候选、title、toast、审计和普通详情不得出现完整设备标识。

## 6. 发布与回滚

发布顺序：

1. 生产只读预检迁移历史、重复标识、活动 primary、表规模和锁。
2. 应用 expand migration `20260729225101_inventory_product_device_data_v2.sql`。
3. 验证列、索引、ledger、trigger、RLS、function owner/search_path 与 dormant ACL。
4. 应用 enable migration `20260729225109_inventory_product_device_data_v2_enable.sql`。
5. 部署 Web，并设置 `INVENTORY_PRODUCT_DEVICE_DATA_V2=1`。
6. 只读生产冒烟，不创建虚假商品。

紧急回滚优先将 `INVENTORY_PRODUCT_DEVICE_DATA_V2=0`，它会立即关闭新建/编辑写入口；随后回滚 Vercel deployment。数据表、唯一索引和历史记录保持不删，后续用 forward migration 修正。

## 7. 验收

- lint、TypeScript、全量 Vitest、production build 全部通过。
- 事务内数据库脚本 `scripts/validation/inventory-device-data-smoke.sql` 验证创建/更新幂等、CAS、成本保持、标识差异更新、来源/primary、variant/movement 和 ACL，最后 rollback。
- Playwright 覆盖 390/430/768/1024/1440 的录入、详情和编辑，并断言无横向溢出、无 `progressbar`。
