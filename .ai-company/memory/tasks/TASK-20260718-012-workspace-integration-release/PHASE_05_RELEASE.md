# Phase 05 — 推送、部署与生产验证

状态：`completed`

## Gate

- [x] staged scope、实际 secret pattern scan、`git diff --check` 和 `agents:check` 通过。
- [x] 非强制快进推送 `origin/main`，业务发布 SHA 为 `e4aee9231745de4def661b3c79400a616b2e3e55`。
- [x] Vercel Git 部署 `dpl_AjMLSbHA9fnA9Vytd7si9jRafkrP` 对应同一 SHA，状态 READY，并服务生产域名。
- [x] `/login` 返回 200；受保护页面返回登录重定向；未认证 API 返回 401；Inventory V2 与 lifecycle 激活变量不存在，保持默认关闭。
- [x] 发布后 10 分钟 error 级日志为空；前一 READY 部署 `chinatech-codex-36c0kpcd7-kyox120-9295s-projects.vercel.app` 可作为 Web 回滚目标。
- [x] 六张只含合成数据的订单、解锁、门店地址与打印预览截图已保存。

## Release evidence

- Production URL: `https://chinatech.in`
- Git-triggered deployment URL: `https://chinatech-codex-aal916m1c-kyox120-9295s-projects.vercel.app`
- Closeout 文档提交不改变运行时代码；最终 `main` 与其自动部署一致性在发布关闭时再次核对。

## Exit condition

Git、database、deployment、runtime 四层证据一致；否则执行回滚或停止。
