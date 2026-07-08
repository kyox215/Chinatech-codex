# Evidence Index — TASK-20260708-011-xutech-self-service-onboarding

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-08T17:45:33Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-08T18:04:57Z` `1f34165d36` — 测试：stores/platform/router/schema/onboarding 相关 vitest 78/78 通过；另 onboarding/store 相关测试 53/53 和 platform/schema 35/35 通过；npm run typecheck 通过；targeted eslint 通过；npx next build --webpack 通过。部署：Vercel inspect chinatech-codex-g1foh0by1... status Ready 且别名包含 www.chinatech.in。数据：xutech store id 9a696edc-e70f-456f-891c-50681a71eec7 active，store_code XUTECH-2B8021；ChinaTech membership inactive，xutech membership owner active。截图：/tmp/repairdesk-xutech-created-20260708.png。
