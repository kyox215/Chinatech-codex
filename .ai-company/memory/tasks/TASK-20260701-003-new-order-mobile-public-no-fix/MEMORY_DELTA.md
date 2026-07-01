# Memory Delta

## Project Memory Candidate

- `/orders/new` 移动端固定提交栏应只承载主提交动作，不再重复显示金额三联卡；金额确认留在 `报价处理` 卡片内。
- `repair_orders.public_no` 创建可靠性不能只依赖数据库默认值；repository 创建路径需要显式生成并写入 `public_no`，数据库 default/RPC 作为兼容兜底。
- `public_no` 相关数据库错误需要归一化为中文友好提示，避免向前台暴露 raw Supabase constraint 文案。

## Risk Memory Candidate

- 当前订单详情桌面 UI 审计存在 `收款` 按钮被其它详情层拦截的问题，和本次新建工单修复无关，但会影响后续订单详情桌面验收。
