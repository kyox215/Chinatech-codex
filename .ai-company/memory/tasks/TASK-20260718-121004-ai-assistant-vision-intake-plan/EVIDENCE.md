# Evidence Index — TASK-20260718-121004-ai-assistant-vision-intake-plan

| Evidence ID | Type | Claim supported | Source/path | Result |
|---|---|---|---|---|
| E-001 | owner request | 需要网站 AI 助手、订单查询、拍照识别和入库整理 | 当前用户请求 | observed |
| E-002 | image inspection | 标签可提供品牌、型号、颜色、RAM、存储和多标识符候选 | 用户附件 `照片 1.jpg`，仅当前会话查看 | observed; identifiers redacted |
| E-003 | workflow evidence | 目标流程是拍照识别后人工补成本与售价 | 用户附件 `照片 2.jpg` | observed |
| E-004 | local code | 已有混合条码/OCR、候选和手工兜底 | `src/components/imei-scanner-field.tsx` | verified by inspection |
| E-005 | local code | 已有 IMEI 候选、置信和 Luhn | `src/features/capture/model/barcode-parser.ts` | verified by inspection |
| E-006 | local code | 已有订单/库存 API facade | `src/lib/repairdesk/api.ts` | verified by inspection |
| E-007 | local code | 已有 BFF、服务端权限和审计入口 | `src/app/api/repairdesk/[...path]/route.ts`, `src/server/api/repairdesk-router.ts` | verified by inspection |
| E-008 | local code | 当前库存只有 storage 和单一 serial_or_imei，缺少独立 RAM 与多标识符 | `src/lib/repairdesk/types.ts`, `supabase/migrations/20260610234427_buyback_resale_inventory.sql` | verified by inspection |
| E-009 | local code | 审计已对客户、IMEI、图片与秘密脱敏 | `src/server/audit.ts` | verified by inspection |
| E-010 | official docs | Responses 支持图像、工具与结构化输出 | `https://developers.openai.com/api/docs/guides/images-vision` | current research 2026-07-18 |
| E-011 | official docs | store:false 不等于完整零保留，API Key 应只放服务端 | OpenAI data controls and production best practices | current research 2026-07-18 |
| E-012 | official docs | RLS、Storage 和显式 Grants 需要共同设计 | Supabase RLS, Storage and changelog | current research 2026-07-18 |
| E-013 | department review | 产品/UX、架构/OpenAI、数据/安全/QA 三个独立只读工作包均支持“AI 草稿 + 人工确认” | 三个子 Agent 回传，已集成到主计划 | reviewed |

## Validation notes

- 用户原图包含敏感设备标识符，未复制到项目、测试集、截图或报告正文。
- 本任务未使用或验证任何 API Key、生产数据库、部署或发布状态。
- 工作区在任务开始前已存在大量其他任务改动；本任务只新增自己的计划文件和任务目录。
- `2026-07-18T10:19:05Z` `482cfc8743` — docs/AI_ASSISTANT_VISION_INTAKE_PLAN.md
- `2026-07-18T10:19:05Z` `b4ac3e72d0` — .ai-company/memory/tasks/TASK-20260718-121004-ai-assistant-vision-intake-plan/EVIDENCE.md
