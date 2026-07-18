# Context Packet — TASK-20260718-009-ai-assistant-implementation

## Goal

按 `docs/AI_ASSISTANT_VISION_INTAKE_PLAN.md` 完成 RepairDesk AI 小助手的 Phase 0-5，并在所有门禁后推送、部署和验证。

## Current verified state

- OpenAI API Key 已安全写入 ignored `.env.local`；值未读取或记录。
- 主工作区 `main` 有大量其他任务改动，且本地 HEAD 与 `origin/main` 分叉。
- 最新刷新后的 `origin/main` 为 `51d5b3b9`。
- 主计划和其规划任务目录目前是主工作区 untracked 产物，必须显式带入隔离实施分支。
- 项目是 Next.js App Router + React 19 + Supabase BFF；当前未发现 OpenAI SDK 依赖。
- 现有 capture 有条码/OCR/Luhn，inventory 有单一 `serial_or_imei` 和 storage，但没有独立 RAM/多标识符。

## Hard boundaries

- 主线程唯一写业务代码；所有子 Agent read_only。
- 不在混合主工作区开发、stage、commit、push 或 deploy。
- 不读取/输出 key，不把真实客户图片或完整 IMEI 写入 fixture/log/screenshot/memory。
- AI 不直接执行正式业务写入。
- 生产迁移、真实数据外发和 public activation 需要执行级批准。

## Relevant files

- `docs/AI_ASSISTANT_VISION_INTAKE_PLAN.md`
- `src/app/api/repairdesk/[...path]/route.ts`
- `src/server/api/repairdesk-router.ts`
- `src/server/api/repairdesk-schemas.ts`
- `src/server/auth-context.ts`
- `src/server/audit.ts`
- `src/lib/repairdesk/api.ts`
- `src/lib/repairdesk/types.ts`
- `src/components/imei-scanner-field.tsx`
- `src/features/capture/*`
- `src/features/inventory/*`
- `src/components/app-bar.tsx`
- `src/app/providers.tsx`

## Immediate next action

完成 Phase 0 三个只读部门工作包，建立隔离分支，集成 ADR/接口/数据/安全/UI/测试决定，再开始 fake provider 与严格 Schema 的单一写入实施。
