# Handoff

## 当前状态

代码已实现，核心验证通过；远端 Supabase 迁移已应用；尚未 stage、commit、push。

## 交接重点

- `public_no` 修复采用双保险：
  - 应用层插入前显式生成并写入 `public_no`。
  - 数据库迁移恢复 sequence/RPC/default，兼容后续直接插入。
- 移动端底栏只显示 `创建工单`，桌面提交栏仍显示金额摘要用于提交前确认。
- 前端 toast 不再直接暴露 `null value in column public_no...` 原始数据库错误。

## 后续首个动作

如需发布：

1. 复核本任务 diff，确保只 stage 本任务文件。
2. 推送 `main` 后等待 Vercel 部署完成。
3. 用真实账号创建一张测试工单，确认 `public_no` 非空且详情可打开。

## 注意事项

- 当前 worktree 原本已经很脏，不要 blanket add。
- 不要回滚与本任务无关的已有修改。
- 扩展桌面审计失败点是订单详情收款交互，不应阻塞本次 `/orders/new` 修复，但应记录为后续订单详情修复候选。
