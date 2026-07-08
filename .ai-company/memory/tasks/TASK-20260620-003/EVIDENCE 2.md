# Evidence Index — TASK-20260620-003

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T22:45:00Z | Integration Lead / CEO Agent |
| E-002 | context | no task was active before creating this preflight task | `.ai-company/memory/ACTIVE_CONTEXT.md` | status `idle`, `current_task_id: null` | 2026-06-19T22:45:00Z | Integration Lead / CEO Agent |
| E-003 | prior classification | previous classification is closed and approval-gated | `TASK-20260620-002/TASK.md`; `TASK-20260620-002/LEGACY_ROUTES_CLASSIFICATION_REPORT.md` | all six `src/routes/*` files classified delete-ready after Owner approval; no deletion performed | 2026-06-19T22:45:22Z | Integration Lead / CEO Agent |
| E-004 | source baseline | six legacy route files still exist | `find src/routes -maxdepth 1 -type f -print \| sort` | `index.tsx`, `inventory.tsx`, `messages.tsx`, `orders.index.tsx`, `orders.tsx`, `settings.tsx` | 2026-06-19T22:45:22Z | Integration Lead / CEO Agent |
| E-005 | source baseline | file sizes match classification baseline | `wc -l src/routes/*.tsx` | 1847 total lines; `orders.index.tsx` remains 1826 lines | 2026-06-19T22:45:22Z | Integration Lead / CEO Agent |
| E-006 | source baseline | hashes captured before any deletion approval | `find src/routes -maxdepth 1 -type f -exec shasum -a 256 {} +` | six SHA-256 hashes captured; match prior classification output | 2026-06-19T22:45:22Z | Integration Lead / CEO Agent |
| E-007 | source scan | active source outside `src/routes` still has no legacy route references | `rg -n "@/routes|src/routes" src --glob '!src/routes/**'` | no output, exit 1 from no matches | 2026-06-19T22:45:22Z | Integration Lead / CEO Agent |
| E-008 | tooling baseline | deletion task must update `knip.json` after directory removal | `rg -n "src/routes|@/routes|orders\\.index" knip.json docs/ARCHITECTURE.md .ai-company/memory/BACKLOG.md .ai-company/memory/OPEN_CONFLICTS.md .ai-company/memory/PROJECT_MEMORY.md` | `knip.json` still ignores `src/routes/**`; memory/docs record approval-pending cleanup | 2026-06-19T22:45:22Z | Integration Lead / CEO Agent |
| E-009 | workspace status | dirty worktree exists and must be isolated during deletion | `git status --short` | many existing modified/untracked files across docs, source, screenshots, tools; no staging performed | 2026-06-19T22:45:22Z | Integration Lead / CEO Agent |
| E-010 | contract | deletion preflight contract produced without deleting files | `LEGACY_ROUTES_DELETION_PREFLIGHT_CONTRACT.md` | exact scope, work packages, validation matrix, rollback, and stop conditions recorded | 2026-06-19T22:45:22Z | Integration Lead / CEO Agent |
| E-011 | validation | AI Company/agent governance checks pass after contract edits | `npm run agents:check` | passed: Agent config, template, and rule checks | 2026-06-19T22:47:23Z | Integration Lead / CEO Agent |
| E-012 | validation | current dirty-worktree lint baseline is green before deletion | `npm run lint` | passed | 2026-06-19T22:47:23Z | Integration Lead / CEO Agent |
| E-013 | validation | current dirty-worktree typecheck baseline is green before deletion | `npm run typecheck` | passed | 2026-06-19T22:47:23Z | Integration Lead / CEO Agent |
| E-014 | validation | `knip.json` is valid JSON before future tooling cleanup | `node -e 'JSON.parse(require("fs").readFileSync("knip.json","utf8")); console.log("knip json ok")'` | passed, printed `knip json ok` | 2026-06-19T22:47:23Z | Integration Lead / CEO Agent |
| E-015 | validation | active source legacy route scan remains clean after validation | `rg -n "@/routes|src/routes" src --glob '!src/routes/**'` | no output, exit 1 from no matches | 2026-06-19T22:47:23Z | Integration Lead / CEO Agent |
| E-016 | validation | no legacy route file was deleted during this task | `find src/routes -maxdepth 1 -type f -print \| sort` | same six files remain | 2026-06-19T22:47:23Z | Integration Lead / CEO Agent |
| E-017 | validation | governance checks still pass after long-term memory and architecture doc sync | `npm run agents:check` | passed: Agent config, template, and rule checks | 2026-06-19T22:49:23Z | Integration Lead / CEO Agent |
| E-018 | validation | active source still has no legacy route references after memory/doc sync | `rg -n "@/routes|src/routes" src --glob '!src/routes/**'` | no output, exit 1 from no matches | 2026-06-19T22:49:23Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
