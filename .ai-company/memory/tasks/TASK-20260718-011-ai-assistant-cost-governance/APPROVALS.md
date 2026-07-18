# Approval Register — Phase 3A

| Decision | Status | Evidence / condition |
|---|---|---|
| Plan and start Phase 3A default-off implementation | approved | Owner: “开始规划下一个阶段…并开始执行” |
| Preserve Phase 0–2 safety boundaries | approved/required | master plan and prior conditional closeout |
| Proposed production hard cap `$50/month` | proposed, not D4-approved | prior recommendation; Owner has not explicitly confirmed numeric spend |
| Proposed per-store provider fallback `20 text + 10 vision/day` and global `300/day` | proposed | may be implemented as disabled config contract; live use pending budget approval |
| Deterministic zero-model order routing | approved in local/default-off scope | reversible and no new data access |
| Local-first complete-label bypass | approved in local/default-off scope | no server request when local candidates are sufficient; still human review/no write |
| Cost estimator, deadline, AbortSignal and safety identifier contracts | approved in local/default-off scope | no external request or secret required |
| Prepare durable quota migration file | approved in local scope | additive/file-only; no production apply |
| Apply durable quota migration to linked/production Supabase | pending D4 | requires dry-run, recovery, advisors, RLS/Grants and execution approval |
| Seed/enable any quota policy row | pending D4 | migration intentionally inserts zero enabled policies; numeric proposal remains unapproved |
| Reuse existing OpenAI project key for any live call | pending D4 for live use | key exists ignored; do not copy/read/sync during Phase 3A safe slice |
| Install official OpenAI SDK or image decoder dependency | pending D4/dependency approval | no package change in safe slice |
| Send real text/image/IMEI/PII to OpenAI | pending D4 | DPA/ZDR/EU/retention/notice/deletion required |
| Push/deploy dormant Phase 3A code | approved with prior release gates, revalidate before action | all flags off, no key, no migration apply; stop if authorization scope is unclear |
| Enable any production AI flag/provider/public assistant | pending D4 | independent activation package required |
