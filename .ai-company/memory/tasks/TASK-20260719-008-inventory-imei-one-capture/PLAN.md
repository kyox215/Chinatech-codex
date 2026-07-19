# Plan — TASK-20260719-008

1. **恢复上下文与冻结边界** — 完成。隔离脏根 checkout，基于干净 `origin/main` 建立单一写入 worktree；确认无 schema 需求。
2. **本地识别与隐私分流** — 完成。原生 + Worker 条码、固定同源 OCR、完整标签本地化、独立规格裁剪与显式确认。
3. **IMEI 复核与草稿合并** — 完成。IMEI 优先、遮罩、校验、冲突、主标识和不覆盖手工内容。
4. **专项验证与视觉证据** — 完成。35 项聚焦测试、typecheck、V2 Playwright 6/6、390/1280 截图。
5. **全量质量与审查门** — 完成。lint/typecheck、313 files / 2044 tests、production build、依赖、diff、secret、架构、安全、UX、文档与发布审查通过。
6. **发布与数据库应用门** — 进行中。exact scoped commit、fresh fetch、非强制推送 main、Vercel READY、Supabase list/dry-run；无 SQL 则 no-op。
7. **生产验收与关闭** — 待执行。已登录手机/电脑无 PII 本地识别、零外发/零写入、日志观察、最终 memory checkpoint 与关闭报告。

## Stop conditions

- 完整标签、IMEI/SN/EAN、原始 OCR 或条码出现在外部请求/日志/持久化路径。
- Worker 在取消/超时后无法终止，或手工下一步被识别流程阻塞。
- `origin/main` 前移且无法安全重放，质量门失败，或出现未审核 migration。
- 正式部署不是 exact reviewed SHA、不是 READY、Chinatech-only/预算边界变化或生产 smoke 产生库存写入。
