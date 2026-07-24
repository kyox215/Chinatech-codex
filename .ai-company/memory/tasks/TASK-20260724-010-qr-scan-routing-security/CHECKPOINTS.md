# Checkpoints

## 2026-07-24T15:18:00Z — implementation started

- Based on `origin/main` at `7a57ab0a` in isolated worktree `/private/tmp/repairdesk-qr-scan-routing-security`.
- Confirmed defect: smart QR was treated as generic URL and order search.
- Targeted implementation in progress; no database changes.

## 2026-07-24T17:07:00Z — release candidate verified

- 标准 URL、裸 legacy/v2 token、错误路径 fragment 均作为专用敏感载荷处理。
- 拒绝反斜杠网络路径、credentials、异常端口、恶意/同形域；完整文档导航前再次校验。
- token 不进入普通搜索、`?q=`、scan intent、React Query/API 输入、sessionStorage 或 history state。
- `/r` 使用 AbortController 与 generation，旧请求不得覆盖或跳转。
- Targeted 10 files / 59 tests；full 354 files / 2356 tests；lint、typecheck、diff-check、production build 全通过。
- Chromium 2/2、WebKit 2/2；独立 Chromium repeat-each=5 为 10/10。
- 安全只读复核 PASS，无 P0/P1/P2；无服务端授权边界 diff。
## 2026-07-24T17:08:16Z — 二维码扫码分流与 bearer 隔离修复已通过全量测试、生产构建、Chromium/WebKit E2E 和安全审查

- **Phase:** release
- **Completed/current state:** 二维码扫码分流与 bearer 隔离修复已通过全量测试、生产构建、Chromium/WebKit E2E 和安全审查
- **Next:** 提交并快进推送 main，等待 Vercel 生产部署后执行无 PII smoke
- **Decision:** 裸 token 与任何含 token fragment 的非精确链接均 fail-closed，内部扫码只经 /r 分流
- **Evidence:**
  - .ai-company/memory/tasks/TASK-20260724-010-qr-scan-routing-security/EVIDENCE.md
- **Recorded by:** IntegrationLead
