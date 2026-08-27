# Memory Delta — TASK-20260827-006-owner-store-deletion-release

## Candidate project facts

- **Source:** Registry doctor/status and parent-provided context packet; **status:** verified; **owner:** release-candidate writer; **scope:** this task/run only; **review trigger:** any window, worker, WP or context-packet mismatch. The writer identity is bounded to `WINDOW-01A043DB-STORE-DELETE-RELEASE-WRITER` / `WORKER-20260827-006-LUNA` / `WP-20260827-006-RELEASE-CANDIDATE`; the integration lease is not held by this worker.
- **Source:** `git fetch --no-tags origin main` and `git rev-parse`; **status:** verified twice; **owner:** Integration Lead for later reconcile; **scope:** candidate baseline; **review trigger:** any origin SHA movement. `origin/main` and candidate HEAD remain `e80099b2c36e89a484acf4430f3fddb4a9f199ad`.
- **Source:** candidate `git status --short` and manifest; **status:** verified; **owner:** release-candidate writer; **scope:** `/private/tmp/repairdesk-store-delete-release-20260827`; **review trigger:** any file outside the manifest or any staged/committed state. The worktree is isolated, contains 27 scoped application/test/runbook files, and the shared root was not cleaned or rewound.
- **Source:** release command audit; **status:** verified; **owner:** Owner/Integration Lead; **scope:** production; **review trigger:** any release request. No production env, migration, Supabase data, worker, Storage/DB deletion, commit, push or deploy action occurred.

## Candidate department updates

- **RELEASE/QA:** targeted lifecycle suite is 13 files/79 tests PASS; split manager tests are 17/17 PASS; full Vitest is 460 files/3048 tests PASS; typecheck, scoped lint, and diff-check PASS. **Status:** exact-SHA Preview GO and production flags-off GO per independent release review; build has only offline Google Fonts environment failure. **Owner:** Integration Lead; **scope:** candidate only; **Review trigger:** dependency/toolchain repair or source change.
- **SEC/DATA/PLATFORM:** browser control plane remains staged; authoritative owner/UUID/phrase checks and contract>=4 destructive guard are present in candidate evidence. **Status:** local-only, production NO-GO. **Owner:** Owner plus D4 approver; **scope:** any future production purge; **Review trigger:** forward v4 migration, independent background runner/sink/restore approval, or flag change.

## Candidate decisions / ADRs

- **Decision:** use origin `e80099b2...` plus only TASK-005 deletion hunks in an uncommitted temp worktree; **source:** release task contract and diff review; **status:** applied; **owner:** luna_worker; **scope:** TASK-006 candidate; **review trigger:** origin changes or mixed-hunk ambiguity.
- **Decision:** retain `origin/main@e80099b2...` as rollback candidate and report exact-SHA Preview GO / flags-off production GO / real purge NO-GO; **source:** E-006 through E-016; **status:** applied; **owner:** Integration Lead; **scope:** candidate handoff; **review trigger:** any request to publish or declare release-ready.
- **Decision:** do not repair missing print dependencies, fetch fonts, modify migrations/flags, or claim production readiness; **source:** R4/L2 and D4 boundary; **status:** applied; **owner:** Owner/Integration Lead; **scope:** current run; **review trigger:** explicit later approval in a properly leased release window.
- **Decision:** Owner explicitly authorizes a later qualified scoped commit/push/deploy, while migration, production-flag changes, and real deletion remain unauthorized; **source:** Owner instruction relayed by Integration Lead; **status:** recorded; **owner:** Hexiang Huang / Owner; **scope:** future release window; **review trigger:** any integration or production action.

## Latest candidate verification

- **Source:** Node24 `npm ci --include=optional`; **status:** verified; **owner:** release-candidate writer; **scope:** candidate dependencies; **review trigger:** lockfile or runtime change. npm 10.8.2 installed 730 packages successfully; `package.json` and `package-lock.json` hashes remained unchanged.
- **Source:** candidate manager line counts and tests; **status:** verified; **owner:** FRONTEND/QA; **scope:** same-directory `store-purge-*` split; **review trigger:** API, copy, security-state-machine, or styling changes. The coordinator is 28 lines; confirmation surface 224; status card 185; state hook 405; pure logic 89; logic test 64. Existing manager behavior remains covered by the 13-file/79-test suite.
- **Source:** independent release reviewer flag and Preview report; **status:** verified by reviewer; **owner:** RELEASE/SEC; **scope:** release gates; **review trigger:** any flag, Preview, production, or real-purge request. Six deletion-related production/Preview flags are absent or not equal to `1`; exact-SHA Preview is GO, flags-off production posture is GO, and real permanent purge remains NO-GO.

## Candidate lessons and capability evidence

- **Lesson:** a dirty shared root with mixed hunks requires a clean origin worktree plus manual diff selection; copying whole tracked files can import unrelated account/inventory/memo work. **Source:** candidate reconstruction; **status:** verified; **owner:** release-candidate writer; **scope:** future RepairDesk release candidates; **review trigger:** any mixed-scope root.
- **Lesson:** a dependency symlink can make Turbopack reject an otherwise valid worktree; an entity-copied local dependency tree then exposed missing print modules and offline font fetches. **Source:** build attempts; **status:** verified baseline/toolchain blocker; **owner:** PLATFORM; **scope:** local candidate verification; **review trigger:** dependency lock/node_modules repair.
- **Capability evidence:** no destructive production capability was exercised; worker contract>=4 and explicit no-go documentation remain required. **Source:** E-010/E-011; **status:** verified; **owner:** SEC/DATA; **scope:** production purge; **review trigger:** v4 forward migration plus D4 approval.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
