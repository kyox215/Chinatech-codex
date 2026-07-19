# Evidence Index — TASK-20260719-007-fast-app-recovery

| ID | Type | Claim | Evidence | Result |
|---|---|---|---|---|
| E-001 | owner | 2–3 秒恢复目标 | 当前 Owner 指令 | approved requirement |
| E-002 | git | 隔离基线 | `origin/main@25752bd1`; branch `codex/app-style-recovery-fast-20260719` | clean baseline; dirty root untouched |
| E-003 | code | 旧 `wait` 可能成为终态且依赖 hydration | baseline `app-style-recovery.tsx` / helper | verified defect |
| E-004 | code | 内联控制器、runtime handshake、固定探针 | layout/component/helper; `public/recovery-probe.txt` | implemented |
| E-005 | PWA | 导航超时和新离线壳 | `public/sw.js` | cache v3; 3s navigation timeout |
| E-006 | unit | reload policy/parser/state | `npx vitest run src/shared/lib/app-style-recovery.test.ts` | 1 file / 7 tests PASS |
| E-007 | full test | repository regression | `npm run test` | 311 files / 2020 tests PASS |
| E-008 | static | lint/type/build | `npm run lint`; `npm run typecheck`; `npm run build` | PASS; 26 routes generated |
| E-009 | browser | production Chromium recovery | 修正后 production build 上的 app-style recovery E2E | 8/8 PASS; direct style recovery ~0.94s; JS-only refresh action <=3s |
| E-010 | browser | production WebKit recovery | 修正后 production build 上的 app-style recovery E2E | 8/8 PASS; direct style recovery ~1.1s; JS-only 跨 1.3s 仍无 false-ready shell，随后 refresh action <=3s |
| E-011 | safety | refresh loop/storage/reduced motion | E2E cases | one auto reload; manual fallback; no loop; PASS |
| E-012 | visual | mobile recovery state | `screenshots/TASK-20260719-007-fast-app-recovery/manual-recovery-mobile.png` | 390x844 inspected; no PII/overflow |
| E-013 | visual | desktop recovery state | `screenshots/TASK-20260719-007-fast-app-recovery/manual-recovery-desktop.png` | 1440x900 inspected; no PII/overflow |
| E-014 | review | independent architecture review | `/root/fast_recovery_arch_review` | final PASS after double-readiness correction and rerun |
| E-015 | review | independent QA/UX review | `/root/fast_recovery_qa_review` | final PASS after JS-only false-ready coverage and rerun |
| E-016 | hygiene | scoped diff and static assets | `git diff --check`; `node --check public/sw.js`; probe token check | PASS |
| E-017 | release | no external mutation | Git/Vercel state | not pushed; not deployed |
| E-018 | checkpoint | 修正后完整门禁时间顺序 | source fix 18:44Z; build 18:45Z; Chromium/WebKit 18:46–18:47Z; full lint/test 18:48Z | all evidence is newer than final source fix |
| E-019 | owner | 生产发布授权 | 当前 Owner 指令：推送 main 并应用 Supabase/migration | approved |
| E-020 | git | 最新远端与候选关系 | fresh fetch；`25752bd1..94243401`；behind 0 / ahead 1 | direct fast-forward candidate; root excluded |
| E-021 | database | linked migration history | `supabase migration list --linked` | 91/91 timestamps paired through `20260718223739` |
| E-022 | database | production migration dry-run | `supabase db push --linked --dry-run` | `Remote database is up to date`; no SQL eligible |
| E-023 | database | target health | Supabase project API | `ChinaTech_date` / `xluzcoduqsdvjoouqhkc`; `ACTIVE_HEALTHY` |
| E-024 | security | advisor baseline | Supabase security/performance advisors before release | pre-existing warnings recorded; candidate has no DB diff |
| E-025 | blocker | first real SW smoke | cached Next `/offline` + WebKit controlled disconnect | reproduced stalled runtime; release stopped before push |
| E-026 | architecture | standalone offline fallback | `public/offline-fallback-v1.html`; `public/sw.js` v4 | no Next/external assets; GET-only; cache-miss 503 |
| E-027 | contract | fallback/main constant alignment | targeted Vitest | 1 file / 9 tests PASS; inline script syntax PASS |
| E-028 | browser | real SW Chromium | production build + controlled connection proxy | 3/3 PASS; final interactive; no loop/storage case PASS |
| E-029 | browser | real SW WebKit | production build + controlled connection proxy | 3/3 PASS; final interactive; no loop/storage case PASS |
| E-030 | browser | original recovery regression after v4 | production Chromium + WebKit | 8/8 each PASS |
| E-031 | quality | final repository gate after all source changes | `npm run check` | agents/lint/typecheck/build PASS; 311 files / 2022 tests PASS |
| E-032 | visual | SW recovery final mobile state | `screenshots/TASK-20260719-007-fast-app-recovery/sw-recovered-chromium.png`; `sw-recovered-webkit.png` | 390x844; inspected flow uses no PII |
| E-033 | persistence | browser state and cache safety | real SW E2E | cookie/localStorage/IndexedDB + unrelated cache retained; session reload state cleared after ready |
| E-034 | review | final independent release decision | Architecture PASS; Release QA GO | no code blocker; exact commit/fresh-fetch conditions retained |
| E-035 | quality | post-final-source full gate | final `npm run check` at 20:13Z | agents/lint/typecheck/build PASS; 311 files / 2022 tests PASS |
| E-036 | git | exact v4 release candidate commit | `8fa5b172` on top of `94243401` | 11 intended paths; staged diff clean; no migration/env/dependency diff |
