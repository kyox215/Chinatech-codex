# Plan — TASK-20260719-004-store-lifecycle-uuid-flow-plan

## Owner-visible contract

- 页面名称使用“店铺状态与关闭”。
- 关闭只有三步：检查是否可以关闭 → 处理问题/查看结果 → 确认关闭这家店（可恢复）。
- 未检查时不显示尾号、原因、验证码或红色最终按钮。
- 重命名放回店铺资料，使用独立确认层。
- UUID 对 Owner 称“店铺唯一编号”；主流程只显示操作所需的最后 8 位。
- 删除重复的手输店铺名称确认；保留尾号、后果确认和 6 位安全验证码。
- 浏览器不提供永久删除。

## Must work packages

1. WP-00：隔离基线、三步产品合同、白话错误码。
2. WP-01：简化设置入口，分离重命名与关闭，增加唯一编号展示。
3. WP-02：检查通过/阻断/失败/过期和最终确认向导。
4. WP-03：服务端 primary-owner、explicit-store、MFA、feature/enforcement capability。
5. WP-04：事务内 writer fence、blocker 重算、普通业务读写边界和关闭后切店。
6. WP-05：已关闭店铺列表、恢复确认和旧凭据不复活。
7. WP-06：单元、组件、并发、E2E、响应式、a11y、安全与发布门禁。

## Should

- 阻断项直接处理入口。
- 同名店的地址/创建日期/稳定代码消歧。
- 中/意/英完整本地化。
- 关闭历史和支持参考编号。

## Later

- Passkey、高级诊断。
- 加密导出/KMS、独立恢复证明、法律保留和双批准永久清除后台。

## Hard gates

- 小白化只改展示，不降低完整 UUID、revision、preflight、MFA/challenge、primary-owner、幂等和审计。
- 生产 close 前必须完成数据库写入栅栏、事务内复检、business/recovery 上下文分离和关闭后失权。
- linked database apply 继续受 migration-history、备份/恢复、dry-run、Owner approval 和 post-apply verification 约束。
- 永久清除继续绝对 NO-GO。

## Full detail

See `docs/STORE_LIFECYCLE_SETTINGS_FLOW_PLAN.md`.
