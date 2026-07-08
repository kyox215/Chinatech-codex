# RepairDesk 手机回收与售卖闭环执行计划

## Summary

第一版做内部闭环：客户交机回收、检测估价、付款回收、资料清除、整备维修、上架售卖、成交、售后回溯。登录使用 Supabase 邮箱密码，由管理员先邀请员工并维护 `staff_profiles`；业务写操作通过后端 API 记录员工、时间、实体、变更前后。

## SeaTable `电子产品` 字段映射

| SeaTable 字段         | 目标字段                                              | 说明                                     |
| --------------------- | ----------------------------------------------------- | ---------------------------------------- |
| `状态`                | `inventory_items.status`                              | 导入时用于辅助推断；取走日期优先级更高   |
| `NOME`                | `customers.name`                                      | 缺失时使用手机号或导入行占位             |
| `NUMERO TELEFONO`     | `customers.phone_e164/phone_raw/contact_phones`       | 使用现有号码标准化逻辑                   |
| `CATEGORIA`           | `inventory_items.category`                            | 保留原文，例如 telefono/tablet/computer  |
| `MARCA`               | `inventory_items.brand`                               | 品牌                                     |
| `MODELLO`             | `inventory_items.model`                               | 型号                                     |
| `COLORE`              | `inventory_items.color`                               | 颜色                                     |
| `MEMORIA`             | `inventory_items.storage_capacity`                    | 容量                                     |
| `METODO DI PAGAMENTO` | `inventory_items.payment_method` / transaction method | 付款方式                                 |
| `PREZZO`              | `list_price` / `sale_price`                           | 有售出日期时视为成交价，否则视为挂牌价   |
| `PREZZO PAGATO`       | `buyback_price`                                       | 回收成本                                 |
| `ACCONTO`             | `deposit_amount`                                      | 订金                                     |
| `NOTE`                | `notes`                                               | 备注                                     |
| `BATTERIA`            | `battery_health`                                      | 解析数字或百分比                         |
| `IMEI/序列号`         | `serial_or_imei`                                      | IMEI 或序列号                            |
| `DATA RITIRO`         | `sold_at`                                             | 有值时优先推断为 `sold`                  |
| `DATA`                | `created_at`                                          | 导入创建时间                             |
| `1` / 未命名数字列    | `legacy_payload`                                      | 原始 legacy 数据完整保存，不参与核心逻辑 |

## 状态流

主流程固定为：

```txt
intake -> evaluating -> offer_made -> purchased -> data_wipe -> refurbishing -> ready_for_sale -> listed -> reserved -> sold
```

异常出口：`cancelled`、`returned`、`recycled`。`returned` 可回到 `refurbishing` 或 `listed`，`reserved` 可退回 `listed`，`sold` 可进入 `returned`。

## Supabase Schema

- `staff_profiles`: `auth.users` 对应员工档案，权限以本表为准，不使用用户可编辑 metadata 判断权限。
- `audit_logs`: 所有 create/update/delete/transition/payment/sale/import 操作审计。
- `inventory_items`: 回收/二手商品主表。
- `inventory_quality_checks`: 功能检测、外观等级、电池、IMEI/激活锁、资料清除记录。
- `inventory_transactions`: 回收付款、销售收款、退款、整备成本等轻量财务流水。
- `inventory_events`: 商品业务时间线，结构类似 `order_events`。

## 第一版验收标准

- 未登录访问 `/inventory` 跳转 `/login`；未登录请求 `/api/repairdesk/*` 返回 401。
- 登录员工可创建回收记录、登记检测、推进状态、上架、售出。
- 商品详情能看到概览、检测、财务和时间线。
- 所有库存写操作写入 `audit_logs` 和 `inventory_events`。
- SeaTable `电子产品` CSV 可预览并应用导入，原始行保存到 payload。
- 验证命令：`npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`。

## Assumptions

- 第一版不自动对接 eBay、Back Market、Facebook 等外部平台，只记录内部售卖渠道和备注。
- 货币继续使用 EUR。
- IMEI/黑名单、激活锁、资料清除第一版做人工检查结果记录，不接付费第三方 API。
- 二手商品保修默认可配置，默认 12 个月，并在销售记录中保留。
- 专业卖家销售二手商品需留意欧盟最低法定保证要求；系统保留保修到期字段用于回溯。
