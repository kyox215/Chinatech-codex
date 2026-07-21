# 初始定金更正

## 业务语义

“更正初始定金”只用于修正建单时录错的定金金额，不代表新收到一笔钱。新增收款继续使用“登记收款”，退款、冲销和强制结清仍是独立的高权限流程。

## 权限与状态

- Owner、Manager、Sales（前台/销售工作人员）可更正当前店铺的有效工单。
- Technician 仅可更正 `assignee_membership_id` 与其当前有效店铺成员身份匹配的工单。
- Viewer、未被指派的 Technician、终态、取消、作废或删除工单拒绝更正。
- 已存在后续付款流水，或报价已经发送/确认时，初始定金不再允许直接更正。

## 数据合同

- API：`POST order/initial-deposit/correct`
- 输入：工单 ID、`expected_updated_at`、UUID 幂等键、两位小数以内的非负定金及 5–240 字符原因。
- 数据库：`repairdesk_correct_initial_deposit` 在同一事务内锁定工单、验证租户/角色/指派/版本/金额/状态，更新金额摘要，并追加更正记录、工单事件和审计日志。
- `order_payment_ledger` 仍只记录真实新增收款，不接收定金更正记录。

## 发布与回滚

1. 先在非生产环境应用 `20260721133000_order_initial_deposit_correction.sql`，验证函数授权只开放给 `service_role`。
2. 使用 Owner、Sales、已指派/未指派 Technician、Viewer 各验证一次允许或拒绝路径。
3. 检查更正表、工单金额、时间线和审计日志四处数据一致后再发布应用。
4. 应用回滚可隐藏入口并停止调用新 API；迁移创建的追加式审计表应保留，不删除历史记录。若数据库函数异常，先禁用应用入口，不执行破坏性数据回滚。
