# RepairDesk 应用恢复运行手册

Status: active

Owner: Frontend + Architecture + Operations / Integration Lead

Scope: authenticated Web shell, Service Worker navigation fallback, reconnect recovery and rollback

Last verified: 2026-07-19 by `TASK-20260719-007-fast-app-recovery`

## 运行目标

当手机浏览器长时间断网、进入后台或恢复网络后，RepairDesk 不应无限停留在“正在恢复”状态。应用优先原地恢复；双就绪仍失败时，在站点真实可达后的 3 秒硬截止内开始一次受控刷新。

这是稳健在线模式，不是完整 offline-first：离线期间不承诺读取或提交全部业务数据。

## 权威实现

- `src/app/layout.tsx`：服务端初始恢复状态与内联恢复控制器。
- `src/components/app-style-recovery.tsx`：React runtime handshake。
- `src/shared/lib/app-style-recovery.ts`：常量、状态与刷新边界。
- `public/recovery-probe.txt`：固定正文 `repairdesk-recovery-v1`；不得加入 Service Worker 缓存。
- `public/sw.js`：`repairdesk-shell-v4`、GET 导航 3 秒超时与窄缓存清理。
- `public/offline-fallback-v1.html`：不依赖 Next.js 或外部资源的恢复壳。

## 状态与安全边界

1. CSS marker 和 React runtime handshake 同时成立，才允许隐藏恢复层并显示业务应用。
2. `online`、`pageshow`、`focus`、`visibilitychange`、`resume` 只加速检查；固定探针正文才证明站点可达。
3. 可见页以 750ms 间隔和 750ms 单次超时探测。
4. 每个 60 秒窗口最多自动刷新一次；达到上限后显示人工“立即重试”。
5. `sessionStorage` 不可用时仍必须防止刷新循环。
6. Service Worker 只为 GET 导航返回 fallback；非 GET 不拦截，fallback cache miss 返回 503。
7. 激活只删除旧 `repairdesk-shell-*`；禁止清理认证、本地存储、IndexedDB、outbox 或其他业务缓存。

## 发布前验证

```bash
npm run check
npx playwright test tests/e2e/app-style-recovery.spec.ts --project=chromium
npx playwright test tests/e2e/app-style-recovery.spec.ts --project=webkit
npx playwright test tests/e2e/app-style-recovery-sw.spec.ts --project=chromium
npx playwright test tests/e2e/app-style-recovery-sw.spec.ts --project=webkit
node --check public/sw.js
git diff --check
```

真实注册 Service Worker 的用例必须覆盖：正常恢复、探针恢复但业务导航继续失败、`sessionStorage` 禁用时无循环，以及 cookie/localStorage/IndexedDB/无关缓存保留。

## 生产验收

1. Vercel 部署必须是 exact Git SHA 且为 `READY`。
2. `https://www.chinatech.in/recovery-probe.txt` 必须返回精确正文 `repairdesk-recovery-v1`。
3. `/sw.js` 必须包含当前 cache version 与 `/offline-fallback-v1.html`。
4. fallback 不得含 `/_next/` 或外部 script/style/font/image/manifest。
5. 使用已授权测试会话检查 390x844 与 1440x900；不得在截图中暴露客户数据。
6. 检查浏览器控制台和部署范围内 error/fatal/warning。
7. 对真实 iPhone 的后台/BFCache/自然网络切换保留观察记录；模拟器通过不能冒充物理设备证据。

## 事故与回滚

出现以下任一情况立即停止发布或回滚：

- 自动刷新循环；
- CSS 已恢复但应用不可交互的假就绪；
- 会话、草稿、IndexedDB、outbox 或无关缓存丢失；
- 网络恢复后仍持续卡住且人工重试无效；
- Service Worker 影响非 GET 或业务 API。

Web 回滚优先在最新 `main` 上回退恢复 commits 并重新验证/部署。只有在确认没有后续功能提交依赖当前版本时，才可提升旧 `READY` 部署；不得为回滚一个恢复功能而顺带撤销无关后续发布。该恢复机制没有数据库 migration；若发布候选的 linked migration dry-run 为 up to date，数据库步骤必须保持零写入，不得重放历史 SQL。
