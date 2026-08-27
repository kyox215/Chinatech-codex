# Evidence Index — TASK-20260823-002-store-signup-repair

## Evidence retention and authority

- This live file is a compact projection created after the v11 lineage checkpoint. The byte-faithful pre-compaction source is `EVIDENCE_ARCHIVE_20260824_PRE_V11_LINEAGE.md`; consult it for full historical descriptions.
- Evidence is separated into confirmed facts, reviewer-reported facts, planned gates and unknowns. A local candidate result is not staging or production proof.
- Task `closed` after E-068/P-054 final 60-minute read-only release closeout; E-062/P-048 **Executed; downstream deviation**; E-063/P-049 recorded; E-064/P-050 superseded; E-065/P-051 completed; main/production release evidence verified.

## Confirmed and inherited evidence (compact projection)

| ID | Confirmed claim / boundary | Status / source |
|---|---|---|
| E-001 | Owner repair task and title recorded | Observed request; 2026-08-23T14:03:52Z |
| E-002 | Four create-store attempts reached route 400, RPC 403 and Postgres `STORE_CREATE_FORBIDDEN` | Prior audit/log evidence; no replay |
| E-003 | Signup 200, verification 303, PKCE 200, onboarding reads 200; zero reported store/operation residue | Prior read-only logs/aggregates |
| E-004 | Legacy claim gate rejects before validation/DML; service-role-only ACL intent remains | Confirmed source/migration evidence; historical migration not edited |
| E-005 | Repository/BFF/UI drops stable code into generic HTTP 400/retry text | Confirmed source inspection |
| E-006 | Existing SQL test sets legacy claim and browser E2E mocks create route | Confirmed test gap |
| E-007 | Availability/blocker, not auth bypass; retain BFF auth, verified email, SECURITY DEFINER, empty search path and exact ACL | SEC boundary |
| E-008 | Production key category/value, deployed parity and backup/PITR readiness unknown; dirty/diverged shared tree | No secret read; release risk |
| E-009 | Supplied task packet identity and doctor/no-lease record | Identity only; grants no execution authority |
| E-010 | Supabase API-key docs distinguish backend-only elevated key and legacy service-role key | Documentation only: https://supabase.com/docs/guides/getting-started/api-keys |
| E-011 | Shared worktree unsuitable for business writes | Preserve unrelated dirty/untracked files |
| E-012 | Supplied baseline metadata: commit `7b47c0afcb2bea5f1069553555c701bc75549d46`, live marker `20260810173610` | Unverified parity metadata |
| E-013 | Initial DATA/SEC/RELEASE correction findings: non-prod hard stops, 0600 state, no media, real POST, UUID non-disclosure, TTL/cost, rollback and observation controls | Contract trigger; not completion |
| E-014 | v3 finding: BFF/ref/origin/state binding incomplete; rollback reused `20260823141758`; baseline invalid | Reviewer finding; WP-05D contract |
| E-015 | SEC v4 High: Playwright setup may precede spec guards | Reviewer finding; WP-05E contract |
| E-016 | WP-05E/05F v5 local candidate completed; 9 modified + 7 untracked / 16 paths; no external mutation | Candidate-only |
| E-017 | SEC v5 local static PASS; old prelaunch High CLOSED | Reviewer packet |
| E-018 | QA v5 PASS: typecheck/ESLint/list, marker/no-start, synthetic Node24 modes, negative fail-closed and cleanup | Reviewer packet; not real staging |
| E-019 | Release v5 CONDITIONAL PASS to local candidate freeze only | Production NO-GO |
| E-020 | DATA v4 PASS reusable because migration/data unchanged; not pgTAP/PostgREST staging proof | Reviewer packet |
| E-021 | Temporary synthetic fixture state precisely deleted; no residue | QA/SEC note |
| E-022 | v5 stable artifact hashes recorded in archived evidence | Candidate provenance |
| E-023 | External gates: Git/candidate approval, ≤4h/$0.054 branch, Node24, pgTAP 19/19, both key modes, rollback/re-forward, Vercel, backup/PITR, then D4 | Confirmed blockers |
| E-024 | Node22.12/npm10.9 typecheck, ESLint, 454/3,002 Vitest, build 30/30, Node24-gate negative reported PASS | Local toolchain only |
| E-025 | Candidate exact 16-path baseline and no source/secret/DB/staging/commit/push/deploy change | Local boundary |
| E-026 | Historical D3 authorization blocker repeated; exact backup/PITR and D4 missing | Historical blocker |
| E-027 | Owner approved staging-only D3: commit/push, ≤4h/$0.054 branch, Node24, pgTAP, both modes, rollback/re-forward, Vercel; no production | Confirmed approval |
| E-028 | Branch/key semantics: independent branch/no production data/independent credentials; elevated key backend-only/service_role; legacy coexistence | Documentation only; no values |
| E-029 | Precommit found one rollback EOF blank line; all other listed candidate checks passed | Hygiene finding |
| E-030 | D3 candidate freeze CAS v3: root v9 `aab140...d254`, writer v9 `7cffdb...f9f8`, DATA `df43c9...8d66` PASS, SEC `6edd51...83af` PASS; local commit/tree `871d2ca9ef8de6af056001454d66b082a1ac7e0d`/`df6862f4f820b35a18434d7585e84f39cdd78778`; exact 16 paths, clean tree/index, diff check PASS | Candidate freeze only; no push/DB/secret/deploy |
| E-031 | Rollback SHA `4ee9dae7a6d91cec62d20808c16aa2ca0b74c0f821fa0f71110875c38e4bcc75`; runbook SHA `8f5d6cf3988163ab70c56a5ce82feec96d2c165a95bc504c85ba262a712937c3`; forward/pgTAP/historical unchanged; quote $0.01344/h, max $0.05376; lease v2 | Candidate provenance; branch not yet created |
| E-032 | Writer v10 `733f9b38...58b4` verified; candidate `871d2ca9...7e0d` clean; pre-list empty; branch `store-signup-repair-d3-871d2ca9`, id `8b387cc7-c951-4825-8a12-4c0602a9fa4b`, ref `tmdebsvqvcrkburxyshp`, created `2026-08-23T22:09:22.949752Z`, deadline `2026-08-24T02:09:22.949752Z` | Provision attempt only; no DDL/DML/user/key/push/Vercel/deploy |
| E-033 | Read-only branch lineage had only 3 migrations through `20260518150000), not expected `20260810173610`; candidate migration absent; exact-ID deletion and post-list absence | Confirmed fail-closed blocker; not staging PASS; no retained branch/cost |
| E-034 | v11 production `list_migrations` and direct ledger each count 119; first `20260213234620`, latest `20260810173610`; repo candidate has 121 timestamped files. Repo-only: `20260806222149`, `20260807120000`, `20260807120100`, `20260823141758`. Production-only: `20260804225445`, `20260804230127` | Confirmed counts/drift; object-level reconciliation pending |
| E-035 | Deleted branch `get_project` not found; branch-action logs empty; exact cause unproven. CLI 2.101.0 help only showed official branch create and optional `--with-data`; no operation invoked | Confirmed observations; no secret; same-method paid retry NO-GO |
| E-036 | DATA v12 packet `b35bbc2c5c85ede7306c7043504a9cf821f8133547f2303570dc1d75c45fb3d1`: production-only ledger `20260804225445`/`20260804230127` map to local-main aliases `20260804140252...`/`20260804225900...`; repo-only `20260806222149`/`20260807120000`/`20260807120100` absent in production; local main `353fb0eb` has SeaTable aliases only, while origin/main `e427c375`, deployed `7b47c0af`, candidate `871d2ca9` have toolkit/lifecycle; no ref has both | Full production-parity staging NO-GO; limited candidate-schema signup static conditional GO only; any reconcile/new migration changes frozen candidate and needs Owner direction |
| E-037 | `WP-20260824-002-D3-NODE24-BUILD` CAS v3, writer v12 packet `d44bf90bab938b21482df0bb5349a76319f46d60d8502368ad37dff4c10b05a6`; Node `/private/tmp/node-v24.19.0-darwin-arm64/bin/node` v24.19.0/npm10.9.0, Next16.2.11; font network-only first failure then authorized retry PASS 18s, TS/30 pages; exact candidate/tree/parent/16 paths/clean | Local Node24 build evidence only; no secret/DB/server/browser/push/deploy/migrate/file change; ignored `.next`/`playwright-report` only |
| P-029 | Owner decision gate after v12: recommended lineage reconcile first, re-freeze then full D3, or limited candidate-schema signup static rehearsal now (conditional, non-parity); no second paid branch/push/Vercel until selected path and safe lineage method reviewed | INT/DATA/QA/SEC/RELEASE/Owner | Lease v4; task `in_progress`, R3/L2, production NO-GO |
| E-038 | Owner selected Option A: migration-lineage reconciliation design first, then re-freeze/re-review and full non-production D3; production remains excluded | Owner instruction; reclassification only, no implementation claim |
| E-039 | Current intake records Registry run instruction 12 and no active integration lease; prior lease-v4/v12 context is historical | Runtime state supplied by Owner; next lease must be verified |
| E-040 | DATA v13 packet `95525e82c36b506c8b47a4a11f7fed305c82afdc2988d74472eb4966bc5a0c2d` GO: target active lineage is production 119 + signup = 120; SeaTable production bodies are 43,341 bytes/SHA `c7d28bd05b862e4ef2865cc53a94b04a123e2645129af079bdb00b793f1af5b5` and 24,925 bytes/SHA `6aebb597ff202f67aa8d4421a70b7fb47de589178f01d140d8bbcfd2330486a4` | DATA final design; files not yet added |
| E-041 | Exact 17-path repository-only allowlist, prior signup 16-blob invariant, default-off feature-flag evidence, archive MANIFEST provenance and no-merge/cherry-pick rule are recorded below | DATA final design; implementation contract only |
| E-042 | Writer v14 packet `8e3799c7f12f9f84c56265753fd3fe53732aac1f537301443a2b001f24d4ab91`; `WP-20260825-002-D3-LINEAGE-RECONCILE-IMPLEMENT` completed CAS v3 on exactly the 17 E-041 paths; isolated HEAD remains `871d2ca9ef8de6af056001454d66b082a1ac7e0d`, dirty/unstaged/uncommitted, with no push | Candidate implementation only; no freeze/staging/production claim |
| E-043 | Active migration lineage is 120/120 unique; SeaTable exact bodies and four archive hashes match; prior signup 16 blobs and historical `20260724114500` unchanged; targeted 3 Vitest files/17 tests, typecheck, changed ESLint and static/hash/diff/whitespace/secret-like scans PASS | Local candidate evidence; no DB reset, pgTAP, PostgREST, branch, deploy or full suite |
| E-044 | v15 packets DATA `68c400e1...`, SEC `8fe82f67...`, QA `5f8514a2...`, Release `38f667c2...`; QA real Node24 targeted 17/17, typecheck, ESLint, full Vitest 454 files/3,005 tests, active 120/120 and hashes PASS | DATA CONDITIONAL/NO-FREEZE; SEC FAIL Medium; QA FAIL; Release FAIL |
| E-045 | Review blockers: required terminal LF in production-authoritative `20260804230127`; MANIFEST alias/candidate provenance and production ledger derivations; stale archived lifecycle runbook; stale out-of-scope `STORE_SIGNUP_REPAIR_RUNBOOK` needing path18 approval | Plan Delta; exact SQL must remain unchanged; staging/production NO-GO |
| E-046 | Owner explicitly approved exactly `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md` as path18; bounded correction allowlist is exactly E-041's existing 17 paths plus this one, 18 total, with no other path | Approval recorded; no production/push/deploy/DB/secret action |
| E-047 | `WP-20260826-002-D3-LINEAGE-REVIEW-CORRECTION` completed CAS v3 under writer packet `5d05083be0bfd031e4046a2f355d7b2a0a6b09a3291d3ffd56712445fd1e2aa6`; exact 18 unstaged/uncommitted paths; HEAD/tree unchanged; SQL, runbook and MANIFEST hashes recorded; Node24.19 targeted 3 files/18 tests, typecheck, ESLint and diff check PASS; active 120/120 | Local correction evidence only; no DB/push/deploy/production |
| E-048 | v17 packets DATA `9c2099c4...`, SEC `b037f2fb...`, QA `c25ec002...`, Release `68348d65...`; local freeze FAIL/NO-GO with six in-scope blockers covering whitespace/archived SQL, lineage parent, remote verification, branch ledger sequence and toolkit deploy wording | D3/production NO-GO; exact 18-path scope unchanged |
| E-049 | `WP-20260826-002-D3-LINEAGE-V17-CORRECTION` CAS v3, writer `4bec48ec...5281`; exact 18 unstaged paths, HEAD/tree unchanged; fixed explicit eight-path whitespace check, static-only archive/lifecycle rules, parent/merge-base and pre/post-push checks, 120/120→rollback121→fresh122 ledger contract; Node24 targeted 18/18 plus clean-status shim, typecheck/lint/diff PASS, active 120/120, SQL unchanged, MANIFEST `e31a2e...`, runbook `4e7881...`, README `b6cb43...` | Local correction evidence only; no DB/push/deploy/production |
| E-050 | v19 DATA `c7ffd6da...7aa6`, SEC `699b2970...23ff`, QA `c630a9f5...d25b`, Release `2b426f3e...fb1b` all PASS/GO TO FREEZE ONLY; exact 18/index clean, fixed-8 normal+clean shim 18/18, active 120/120 and SQL/archive hashes retained | Local freeze review PASS; D3 conditional NO-GO pending commit/integration/remote/branch/real tests; production NO-GO |
| E-051 | Post-freeze Integration Lead staged exact 18 only; narrow staged diff-check had exactly approved `20260804230127...:497` new blank line at EOF with exact SHA `6aebb597ff202f67aa8d4421a70b7fb47de589178f01d140d8bbcfd2330486a4`; staged Node24 18/18, typecheck/focused lint PASS; ordinary commit X `105fbf9aab4a8312f7d7a0c8a0e832e8c0f3cfcc` tree `d3510de9a1f951dbb5e1e369da7517e22e1973ec`, parent `871d2ca9...`, merge-base `7b47c0af...`, diff18/full33, clean | Local post-freeze checkpoint only; no push/DB/deploy/production |
| E-052 | SEV-2: sanitized GitHub origin/Vercel Node24 read-only evidence; browser tool exposed a Supabase GitHub OAuth callback with three bearer types (values/IDs omitted), then no-fragment sign-in; no repo/file write, API call or known abnormal use. | D3/production NO-GO; Owner revoke OAuth, terminate sessions, audit, restore MFA |
| E-053 | P-042 verified: old GitHub Supabase OAuth revoked ~11:38 CEST; GitHub confirmed removal/five old tokens destroyed; no abnormal use until reauth. Bounded 24h audit saw ~01:26 login plus settings/API-key metadata/network-ban reads only; no later member/SQL/settings/deploy/customer/store write; org table unverifiable. MFA added `2026-08-26T13:31:44+02:00` (official docs); deliberate read-only reauth passed (five apps, one Supabase/read-only email); GitHub+MFA Organizations ~`2026-08-26T13:55:54+02:00`, target two projects; visual proof path retained. One TOTP/backup risk; no business-code/DB/migration/push/deploy/config/store change. | **Verified;** P-042 Satisfied; approved non-production D3 only; production NO-GO |
| E-054 | v20 DATA/SEC read-only: production remains 119 migrations; `20260823141758` unapplied; old claim gate/`STORE_CREATE_FORBIDDEN` remains. Failures: `2026-08-26T08:08:53.533Z`, `08:09:08.900Z`, `08:10:12.901Z`; ACL/definer/search-path/service-role-only baseline correct; no sensitive value observed; backup/PITR UNKNOWN; no write. | Baseline PASS; D3 pending/conditional; production NO-GO |
| E-055 | v20 QA read-only: X retains exact local 18/33 path evidence and clean candidate; remote-tracking branches do not contain X; artifact QA CONDITIONAL PASS. Real D3 gates remain pending; no write. | P-043 input; not D3/production proof |
| E-056 | v20 Release/INT prechecks FAIL/NO-GO: no new Vercel deployment since `2026-08-25T21:00Z`; target route again returned 400 around the listed v20 failures, and remote candidate ref, Vercel root/trigger/target/preview and PITR remain unverified. Only approved non-production candidate-ref method may be considered next; no write. | P-043 input; production NO-GO |
| E-057 | D3 remote candidate-ref attempt failed closed: v21 packet, lease v9 (valid at the time), candidate worktree/HEAD/parent/tree/merge-base/clean/origin checks passed; `git ls-remote` confirmed target `refs/heads/codex/store-signup-repair-20260823` absent. Ordinary push failed on sandbox DNS; the matching escalated request was rejected pending current Owner authorization. No remote ref/fetch/file/DB/deploy/other write occurred. | Push blocker; P-044 required; production NO-GO |
| E-058 | Owner: `确认推送 到main`; ordinary X=`105fbf9aab4a8312f7d7a0c8a0e832e8c0f3cfcc`→`refs/heads/main` only; no force/tag/ref deletion, Supabase/DB, POST/store or implicit deploy/promote. Main R4/L1/D4; no push/external write. | Owner auth; P-045 pending |
| E-059 | 3 RO preflights: main NOW NO-GO/CONDITIONAL; origin/main=`e427c375…`; X FF only unchanged; main..X=4 commits/162 paths (131 inventory/Quick Entry outside signup); dirty main=`353fb0eb` diverges with 3 absent SeaTable commits—never push. Main unprotected/no checks; Vercel main→prod history/trigger/root/ignore unknown; prod=119, `20260823141758` absent, old RPC=5 `STORE_CREATE_FORBIDDEN`; no auto-migrate; Supabase GitHub prod integration/backup/PITR unknown; push cannot fix/risk sequencing; no external write. | Read-only; production NO-GO |
| E-060/P-046 | Owner `确认`→`确认先推非生产候选分支`; exact ordinary X→named non-production ref + fetch SHA/tree; excludes main/force/tag/ref-delete/deploy/promote/Supabase/DB/POST/store. | Owner | Satisfied; P-047 satisfied; P-048 executed; production NO-GO |
| E-061/P-047 | v23 packet/lease + lineage/clean/origin/ref-absent PASS; DNS blocked; elevated retry rejected (`确认` lacked same-message repo+commit+ref); ref absent/no fetch/file/DB/Supabase/Vercel/deploy/POST write. | Owner | Satisfied; production NO-GO |
| E-062/P-048 | v26 `492feaf2...58f95`/lease v18; prechecks/ref absent PASS; DNS-failed ordinary then identical elevated push created named ref; ls-remote/fetch verified X=`105fbf9aab4a8312f7d7a0c8a0e832e8c0f3cfcc`, tree=`d3510de9a1f951dbb5e1e369da7517e22e1973ec`, origin/main=`e427c3751f8c8ef0d6533ee15424676a61348a4d`; candidate clean; no force/tag/ref-delete/main push/manual deploy/promote/Supabase/DB/POST/store/secret. | Owner/INT | Executed; downstream deviation |
| E-063/P-049 | Vercel Git auto-created Preview `dpl_8Urvbzc6iF84wUpu5gvwKjUzBTxR` READY at X; production `dpl_48HThuaNdK7QbhSma3REppSG4LwC`/`7b47c0af...` unchanged/not promoted. Owner “不部署” conflicts; no delete/cancel authority, retained; retain for D3 or authorize deletion; no further Vercel/DB/D3/production action. | Vercel/Owner | Verified; P-049 pending; main/production NO-GO |
| E-064/P-050 | v26/lease v18 prechecks PASS; ordinary DNS-failed then elevated exact push to named ref; X/tree/candidate clean; no prohibited write. Vercel Preview `dpl_8Urvbzc6iF84wUpu5gvwKjUzBTxR` READY; production unchanged/not promoted; no-delete authorization. P-050 A/B pending; main/production NO-GO. | Owner/INT | Historical; superseded by P-051 |
| E-065/P-051 | Owner `设置目标并修复所有问题 直到可以创建店铺 ，解决所有问题。完成后推送并部署`; target tool created active objective. Supersedes P-050: migration-first; authorizes required D3, production function migration, ordinary main push and Vercel production deploy (R4/L1/D4). Prohibits force/tag/ref-delete, historical rewrite/repair/with-data, irreversible deletion, secret/PII/customer communication, paid PITR/add-ons and production POST leaving store/customer data; prefer rollback-only/zero-residue canary; stop on lineage/ACL/RLS/auth/tenant/backup/remote-SHA deviation. Status `in_progress / owner-authorized-migration-first-recovery-and-release`; production writes only after gates. Next: v29 live baseline→D3→independent reviews→prod 119→120→main/Vercel→15/30/60. | Owner/INT/DATA/SEC/QA/RELEASE | Authorized; gates pending; production NO-GO |
| P-030 | DATA Stage-A design: map bodies/provenance, isolate three repo-only migrations + lifecycle pgTAP archive, preserve production parity | DATA/INT | Design complete; implementation pending |
| P-031 | After Stage-A, one writer may implement in clean worktree, re-review and run non-production D3; Node24/pgTAP/both-key/rollback-re-forward/Vercel/PITR gates remain | DATA/SEC/QA/RELEASE/Owner | Pending; production NO-GO |
| P-032 | Required static/staging gates: active=120, hashes, 17-path freeze, data-less ledger/parity, pgTAP19, role denial, both keys, idempotency/atomicity, rollback/re-forward, privacy/cleanup | DATA/SEC/QA/RELEASE | Pending implementation/staging |
| P-033 | Rollback = one repo revert + disposable branch deletion/recreate; no production rollback/repair, --with-data, copied PII or history rewrite | INT/DATA/RELEASE/Owner | Contract; production NO-GO |
| P-034 | v14 is dirty local candidate only; v15 review/new freeze required before D3 | DATA/SEC/QA/RELEASE | Pending; staging/production NO-GO |
| P-035 | Owner approved path18 only; v16 correction stays within 18 paths and needs four re-reviews | Owner/DATA/SEC/QA/RELEASE | Approved bounded scope; reviews pending |
| P-036 | v16 correction: exact 18 paths, SQL bytes/LF preserved; no production/push/deploy/DB/secret/migration | Owner/INT/DATA/SEC/QA/RELEASE | Contract; no-freeze |
| P-037 | v17 re-review exact 18 paths; freeze only if DATA/SEC/QA/Release PASS | DATA/SEC/QA/RELEASE | Pending; staging/production NO-GO |
| P-038 | v18 fixes six blockers inside 18 paths; four re-reviews, no new Owner approval | DATA/SEC/QA/RELEASE | Pending; no-freeze |
| P-039 | v19 re-review exact 18-path correction; freeze only if all four PASS | DATA/SEC/QA/RELEASE | Local PASS; X next |
| P-040 | After v19, validate path/SHA EOF exception, ordinary X lineage/path counts and clean tree; no rewrite/push/DB | INT/DATA/SEC/QA/RELEASE | Completed local; D3 conditional NO-GO |
| P-041 | After X, v20 QA/Release and Supabase/Vercel/root prechecks; D3 only if all gates pass | QA/RELEASE/INT/DATA/SEC | Pending; D3/production NO-GO |
| P-042 | Incident response: revoke GitHub OAuth authorization/grant, globally terminate Supabase Dashboard sessions, audit for use, then restore a clean MFA session; recovery is verified by E-053 before bounded D3 resume | SEC/Owner/INT | **Satisfied/verified** by E-053; scope limited to v20/approved non-production D3 |
| P-043 | Resume gate after P-042: re-verify the v20 Integration Lead packet and lease v8 before each material step; then complete v20 QA/Release, Supabase/Vercel/root prechecks and approved non-production D3 gates. Production migration/deploy/canary/real store creation remain NO-GO. | INT/QA/RELEASE/DATA/SEC/Owner | Pending; lease v8 was verified at this checkpoint but is not claimed continuously valid |
| P-044 | Current Owner gate: authorize only ordinary push of X=`105fbf9aab4a8312f7d7a0c8a0e832e8c0f3cfcc` to `refs/heads/codex/store-signup-repair-20260823`; prohibit force/tag/main/deploy/Supabase/DB/real POST. After confirmation, re-verify current packet/lease and absent remote ref, then one Luna writer retries. | Owner/INT/RELEASE/SEC | Pending; without current Owner confirmation no push |
| P-045 | Main push requires fresh packet/lease, remote-main, protection, Vercel trigger, DB sequencing, rollback/backup and D3/quality/security/release checks; any miss blocks. P-044 superseded. | Owner/INT/DATA/SEC/QA/RELEASE | Historical; E-059/P-046 supersedes; R4/L1/D4; production NO-GO |

## Planned evidence and gates (stable IDs)

- **P-001–P-025:** deployed lineage/recovery, forward invariants, both credential modes, browser denial, auth/input/rate/idempotency/atomicity, typed errors, E2E/runbook controls, candidate freeze, D3/D4 separation and Node24/branch evidence; staging/D4 remain pending.
- **P-026–P-028:** inert rollback/hash equality, guarded branch/TTL evidence and object-level lineage/safe data-less branch method; branch attempt failed closed and paid retry remains blocked.
- **P-030–P-033:** DATA Stage-A lineage design, exact allowlist, active=120 and archive/body provenance, no-history-rewrite rollback, and required pgTAP/ACL/RLS/credential/replay/privacy/cleanup gates.
- **P-034–P-036:** dirty v14 candidate is not freeze proof; path18 is Owner-approved as the sole additional path and v16 correction remains no-freeze until independent review.
- **P-037–P-041:** v17 failed; v18 corrected; v19/X local PASS; v20 gates pending. P-042 verified; P-043 technical D3 pending; E-059–E-065/P-046–P-051 governs main/D3/retry/Preview/D4; P-044–P-050 historical/superseded.

## E-041 exact 17-path allowlist (DATA v13)

The implementation writer may touch exactly these paths, from clean candidate `871d2ca9ef8de6af056001454d66b082a1ac7e0d` / tree `df6862f4f820b35a18434d7585e84f39cdd78778`; no merge, cherry-pick or copy from local `main`:

E-041: exact 17-path allowlist archived; commit X/tree remain immutable.

The three migrations and lifecycle pgTAP are byte-preserving evidence-only moves. MANIFEST records path/source/blob/bytes/SHA/commit, production_applied=false/date, other-environment unknown and forbids old-timestamp execution/restoration; tests assert archive hashes/invariants and inactive paths. Prior signup 16 blobs remain unchanged; `.env.example`, app feature code and Supabase config are out of scope.

## Lineage/review compact pointers

- E-042–E-051 and P-034–P-041 table rows above are authoritative for v14–v19 local candidate, review and commit-X facts; none is staging or production proof. Static/staging gates remain listed in P-032/P-041.

## E-052 SEV-2 security pause checkpoint

- Sanitized remote origin and read-only Vercel project/deployment evidence were observed before the browser-tool event. The tool internally output a full Supabase Dashboard GitHub OAuth callback containing three bearer credential types; this memory stores no token values, token URLs, session IDs, emails, IPs or PII, and does not enumerate unprovided type names.
- Activity reached a no-fragment sign-in; no repository/file write or API call occurred and no abnormal use is known. Security classified SEV-2; D3/production remain NO-GO.
- Recovery required: revoke GitHub OAuth grant, globally terminate Dashboard sessions, audit, then restore clean MFA. Status/action time are unknown; do not claim revoked or restored. Next is Owner confirmation.

## Repository rollback and remaining decisions

Revert only the lineage commit: restore the three repo-only active files and remove the two SeaTable additions; delete/recreate disposable branches because Git revert does not roll back ledgers. Never rollback production, edit shared history, use migration repair/with-data, copy PII or clear ledgers. New approval covers scope/common-history/data/cost/unknown environments/D4 production.

## Current / next

- Current: `closed` after E-068/P-054; the final docs-only release gate, deployment, and 60-minute read-only observation are verified.
- Next: no further action within this task. Future implementation, credential rotation, staging E2E, or recovery requires a new Owner-approved task with fresh gates.
- No production secret/key value, test user, customer PII, DDL/DML, deploy, Vercel action or historical POST was performed by this memory writer.
- Validation for this projection is scoped whitespace/diff/size checking only; it does not claim application tests, staging success or production status.

## Archive pointer

- Raw pre-v11 EVIDENCE.md: `EVIDENCE_ARCHIVE_20260824_PRE_V11_LINEAGE.md`, byte-faithful. Live projection is compacted below the 24,800-byte target packet size.
- Pre-v13 TASK/HANDOFF raw snapshots: `TASK_ARCHIVE_20260825_PRE_V13.md` and `HANDOFF_ARCHIVE_20260825_PRE_V13.md`, byte-faithful; live projections are compacted for packet recovery.
- `2026-08-27T07:55:00Z` `62e1724907` — D3 read-only ledger query: 3 migrations, latest 20260518150000; target 20260518170000 absent.
- `2026-08-27T07:55:00Z` `2936107d29` — D3 postgres log and BEGIN/ROLLBACK reproduction: PostgreSQL 42804, uuid customer_id incompatible with text customers.id; rollback left no relation residue.
- `2026-08-27T07:55:00Z` `f30117c44b` — Candidate X target migration SHA-256 173a53c531342883bf7dc5ae3506ec12871cb4f3ecf0240e1fb762c302879906; candidate status clean; local scoped Vitest 21/21 passed.
- `2026-08-27T08:10:48Z` `fc61e3d70c` — Production metadata read-only: function exists, PL/pgSQL, SECURITY DEFINER, search_path empty, anon/authenticated EXECUTE false, service_role EXECUTE true, legacy claim gate still present before signup migration.
- `2026-08-27T08:10:48Z` `2dd391678b` — Production migration ledger 119/latest 20260810173610; candidate migration filenames 120; set difference exactly 20260823141758.
- `2026-08-27T08:10:48Z` `765985ddf3` — Candidate tracked dedicated Playwright config exists; --list without explicit gate fails closed by design, not missing-file drift.
- `2026-08-27T08:26:29Z` `6b6842c511` — /private/tmp/repairdesk_store_signup_preflight_rollback_v30.sql sha256=7c0d884fbf8131aa252cf1c6dc99b1972745e8ad9bd0fcaf1f330cfdb08a2eba; embedded migration sha256=1a55e5e8af78ccb20f23d1e046cdc2c76b160b9e571e4c27965043c7b368c8e1; begin/rollback transaction lines 1/1; exact comparison true

## E-068 / P-054 — Final 60-minute release verification and closeout (2026-08-27)

- Production deployment `dpl_8Vk8CvGq4Bzj3ziaYkqFXk3Ki9QM` is READY and serves runtime commit `e17434e8388959e14e8ed1de8323172e28c2c876`. Computer Use hard refresh showed the ChinaTech account-opened/owner state (`账号已开通`); redacted screenshot: `/Users/kyox215/.codex/visualizations/2026/08/25/01a03ac9-d6dd-7a63-b1fb-ce1c291ac896/repairdesk-store-signup-60m-2026-08-27.png`.
- Vercel sanitized approximately two-hour observations recorded `401`/`403`/`5xx`/timeout/`Invalid API key`/`STORE_CREATE` counts all `0`. From READY at `2026-08-27T12:23:34.626Z`, Supabase observations were API `34`, Auth `14`, Postgres `2`, with every target category `0`.
- Postcheck `/private/tmp/repairdesk_store_signup_postapply_postcheck_v30.sql` is 320 lines, SHA-256 `f0fd3415ad343100524148e42e588b656efd1b168541689100f24c9314df7153`, pure read-only, execution `isError=false`; committed ledger `120/120`, RPC, owner/language/SECURITY DEFINER/empty `search_path`/ACL, 18 normal-trigger, 6 event-trigger, synthetic-residue and advisory-lock assertions passed.
- Independent QA is `PASS`; Release is `GO` for docs-only closeout. No real create-store POST, new account/store, or real multi-account E2E was executed or claimed. `PITR=false` remains a recovery-risk limitation; rollback remains forward-only under the runbook.
## E-066 / P-052 — Owner authorization and runtime rollback checkpoint (2026-08-27)

- Owner saw the exact security warning for credential precedence and replied `继续`; this explicitly authorizes the minimal server-only compatibility policy: trimmed nonblank `SUPABASE_SERVICE_ROLE_KEY` takes precedence, `SUPABASE_SECRET_KEY` is fallback only when legacy is missing/blank, and both absent fail closed. Authorization includes the corresponding code/tests patch, ordinary non-force push to `main`, and redeployment.
- Candidate HEAD is `626d3df4245d100662fea776f5550412ef5c7953`; worktree was clean; the two-file patch remains unimplemented and untested at this checkpoint.
- Owner-provided production evidence: `dpl_2XB...` selected the secret path and returned `401 Invalid API key` on the same account path, then was rolled back. The formal domain currently targets READY stable `dpl_48H...`; the same account path returned 200 at `2026-08-27T11:34:00Z`, and Computer Use showed the account-opened state.
- DB migration/canary health is retained and no DB rollback occurred. This evidence does not establish that the new code patch, main push, redeploy, migration, or store creation is complete.
- No secret value, full email, user ID, or customer PII is stored; no SQL, network, production write, stage, commit, push, or deploy was performed for this checkpoint.
- `2026-08-27T12:01:57Z` `b9dd2b5cc9` — Candidate /private/tmp/repairdesk-store-signup-repair-7b47c0af/src/server/supabase.ts and src/server/supabase.test.ts; focused Vitest 4/4 passed.
- `2026-08-27T12:01:57Z` `6b0e831375` — Candidate lint passed for src/server/supabase.ts and src/server/supabase.test.ts; npm run typecheck passed; git diff --check passed.

## E-067 / P-053 — Post-deploy immediate verification (2026-08-27)

- Commit `e17434e8388959e14e8ed1de8323172e28c2c876` has parent `626d3df4245d100662fea776f5550412ef5c7953`, tree `6a031516a72823c0673be23a743321429756b767`, and exactly three files; GitHub `main` and the candidate ref both resolve to the exact commit.
- Preview `dpl_9Cx9MhoXiH1F6gMyqCNRnDLyUvr8` is READY; `npm run build` passed; cold unauthenticated probe returned `401` rather than `500`; preview error logs had zero hits.
- Production `dpl_8Vk8CvGq4Bzj3ziaYkqFXk3Ki9QM` is READY and `chinatech.in` points to it. Production metadata shows both server-key variable names exist, but no key value was read or printed. Computer Use refresh showed the ChinaTech account-opened/owner state; screenshot: `/private/tmp/repairdesk-store-signup-production-final.png`.
- Recent Vercel observations: 2xx=2, 401/403/5xx=0, relevant errors/leakage=0. Recent Supabase 20-minute observations: 12/12 2xx, auth=5, store/profile/membership read=1, and 401/403/5xx/`Invalid API key`=0.
- No real create POST was executed and no store was created. Stable rollback `dpl_48HThuaNdK7QbhSma3REppSG4LwC` is READY. Security review PASS; Release/Production conditional GO at that immediate checkpoint. The 15/30/60-minute observations were pending then; E-068/P-054 later superseded this checkpoint with the completed final observation and task closeout.
- **Scope:** no secrets, raw logs, customer PII, or production mutation evidence recorded.

## Final closeout projection (E-068/P-054, 2026-08-27)

- Status is `closed`. Production deployment `dpl_8Vk8CvGq4Bzj3ziaYkqFXk3Ki9QM` is READY on runtime commit `e17434e8388959e14e8ed1de8323172e28c2c876`; the redacted ChinaTech / `账号已开通` / `owner` screenshot is `/Users/kyox215/.codex/visualizations/2026/08/25/01a03ac9-d6dd-7a63-b1fb-ce1c291ac896/repairdesk-store-signup-60m-2026-08-27.png`.
- Sanitized Vercel approximately two-hour target errors (`401`, `403`, `5xx`, timeout, `Invalid API key`, `STORE_CREATE`) were all `0`; after READY at `2026-08-27T12:23:34.626Z`, Supabase recorded API `34`, Auth `14`, Postgres `2`, with target categories all `0`.
- The 320-line pure read-only postcheck SHA-256 `f0fd3415ad343100524148e42e588b656efd1b168541689100f24c9314df7153` executed `PASS` (`isError=false`); ledger/RPC/ACL/18-trigger/6-event/synthetic-residue/advisory-lock assertions passed. Independent QA is `PASS`; Release is `GO` for docs-only closeout only.
- No real create-store POST, new account/store, or real multi-account E2E was executed or claimed. `PITR=false` remains an open recovery risk; future database recovery is forward-only.
- `2026-08-27T13:57:21Z` `591d3a1980` — E-068/P-054: deployment READY on e17434e, sanitized target error categories zero, 320-line read-only postcheck execution PASS, ledger/RPC/ACL/trigger/residue/advisory-lock assertions passed.
