# Checkpoints — TASK-20260901-002

The complete pre-release checkpoint history is preserved in
`CHECKPOINTS_HISTORY_PRE_RELEASE_20260903.md` with SHA-256
`891a952bb008a73a51639a180339e79011b512c43deabe129a143797da55e02c`.
This compact file contains the minimum current recovery chain required by the
Registry Context Packet.

## 2026-09-01 — Task intake and phased contract

- Owner requested execution of the website/i18n audit plan, then normal push to `main` and deployment.
- Task classified T3/R3/L2 and split into bounded release units with independent product/UX/architecture/QA/security/release evidence.
- Customer routes remain fixed Italian; employee locale switch remains `zh-CN` / `it-IT` / `en`, Chinese default, URL-stable.

## 2026-09-01 to 2026-09-02 — Release 1 and Release 2A accepted

- Release 1 customer/Kiosk/i18n CI candidate passed required local and hosted gates and production verification at `7d1b59c5e8e61b654beb329444ec1fef03cda2c3`.
- Release 2A Scanner/Camera plus adjacent Orders fixed-UI localization passed exact gates and production verification at `5edab21d75c540cd16b32e87683edb1d72a7a5dd`.
- Release 2A hosted run `33560282833` was green and Vercel deployment `dpl_6eEWtvZQAGw1JSkXeX9gDAuyuUdp` was READY.

## 2026-09-02 to 2026-09-03 — Employee deep i18n candidate completed

- Bounded packages localized Orders New/Task, Order Detail, Customers, Inventory, Buyback, Settings, Messages and Finance.
- Each package retained canonical identifiers, enum values, payloads, customer-facing content and dynamic business values; package-specific tests and independent QA/security evidence are indexed in `EVIDENCE.md`.
- No schema, migration, production data or secret change was included.

## 2026-09-03 — Owner authorizes all four former Release 2B-6 deltas

- Owner replied `确认全部` for Memos Europe/Rome time semantics, shared authority-cache cleanup, removal of impossible Platform approve UI, and locale-aware AI response metadata.
- Memos Europe/Rome Delta completed and passed its focused tests/review before the task was narrowed.

## 2026-09-03 — Owner supersedes broad work with lightweight i18n-only scope

- Only translation coverage, locale switching, i18n output/parity and responsive/a11y defects directly caused by localization remained.
- Memos, Toolkit, Platform and AI client presentation became the final four-group batch.
- Business logic, cache architecture, AI server/API/tool behavior, protocol idempotency, dependency/runtime work and repeated security rounds stopped or moved to backlog.
- Release required a separate Owner decision after one targeted validation and one direct-i18n QA pass.

## 2026-09-03 — Final four code and QA pass

- Memos, Toolkit, Platform and AI client fixed UI/ARIA/validation/fallback copy support `zh-CN`, `it-IT` and `en`.
- Memos retains the completed Europe/Rome due-time Delta; unfinished authority/PII/cache/lock work was removed.
- Toolkit preserves canonical `platform: "桌面"`; AI localized suggestion labels submit original canonical Chinese request values.
- Targeted validation passed 13 files / 84 tests with zero stderr/React act warnings; typecheck, scoped ESLint/Prettier and diff gates passed.
- Independent direct-i18n QA result: PASS, P0 0, P1 0.

## 2026-09-03 — Conditional browser closeout

- Memos and Toolkit browser stories passed.
- Platform and AI reached and passed locale/viewport/dynamic/ARIA/overflow checks, then stopped on existing mobile Escape focus-return P2 assertions.
- Four sanitized screenshots were retained under `screenshots/release2b6/chromium/`; the P2 issue was recorded in project backlog and does not block direct i18n acceptance.
- The experimental failing `tests/e2e/i18n-final-four-release-2b6.spec.ts` was removed from the source candidate; no 4/4 browser pass was claimed.

## 2026-09-03 — Owner approves separate release

- Owner replied `批准` to the explicit request to separately release the current i18n candidate.
- Authorized: exact path reconciliation, Registry/lease preflight, proportional final gates, normal commits, non-force push to `main`, deployment to the existing Vercel production project, exact-SHA/canonical smoke and rollback evidence.
- Excluded: DB/schema/migration, environment/secret, production/customer data, force push, unrelated project-health files and new product/business remediation.

## 2026-09-03 — Release control-plane recovery

- Registry instruction advanced from version 1 to 2 for the Owner release approval.
- Context Packet issuance initially failed closed because historical `TASK.md` and `CHECKPOINTS.md` exceeded the 28KB required-source ceiling.
- Full files were archived byte-for-byte as `TASK_HISTORY_PRE_RELEASE_20260903.md` and `CHECKPOINTS_HISTORY_PRE_RELEASE_20260903.md`; current recovery files were compacted without changing the executable release contract.
- Next: issue and verify Context Packet v2, acquire integration lease, fetch/reconcile `origin/main`, freeze exact release manifest, then run release gates.

## Current recovery state

- **Done:** direct i18n implementation, targeted validation, independent QA, documentation/memory sync, Owner release approval, historical-memory archival.
- **Remaining:** Context Packet v2, lease, remote/candidate preflight, local gates, exact staging, commit, push, hosted/Vercel verification, closeout.
- **Blocked:** none; stop on any condition listed in `TASK.md`.
- **Owner:** Hexiang Huang / 老板.
- **Integration window:** `WINDOW-01A05709-OPT-I18N-REL-20260901`.

## 2026-09-04 — Playwright stability precondition and release authority updated

- Owner added a narrow stability precondition: normal Scanner/Camera i18n runs create no manual evidence screenshots; Playwright defaults are serial/one-worker, failure-only screenshot, video off and first-retry trace; normal i18n CI uses Chromium only and WebKit is one bounded final compatibility check.
- Owner then authorized normal `main` push and the existing production deployment after the updated i18n/stability acceptance and one bounded final verification.
- The prior old-config WebKit run is not reused as a pass. Existing lint/typecheck/Vitest/build and independent staged-scope QA passes remain reusable because application source, dependencies and business contracts did not change.
- Next: instruction version 3 Context Packet, stability delta, one targeted validation, then bounded final verification and release.

## 2026-09-04 — Final compatibility gate stopped release

- The stability delta passed static checks and targeted Chromium proof; normal evidence capture is off unless `REPAIRDESK_CAPTURE_I18N_EVIDENCE=1`.
- Final Chromium language-switcher plus Scanner/Camera completed 31/31 PASS with one worker.
- The single bounded WebKit run completed 29/31 PASS; Scanner/Camera itself was 22/22 PASS. The two failures were a screenshot-induced hydration warning and keyboard activation of the language menu.
- The only permitted targeted repair gated the language-switcher suite's manual screenshots and replaced locator-level Enter presses for the related re-verification. The hydration case passed, but the keyboard case remained red; the ineffective keypress edit was removed while the proven screenshot gate was retained.
- Verification budget is exhausted. No lease was reacquired and no staging, commit, push or deployment followed. A new Owner-authorized bounded compatibility packet is required before another fix or WebKit run.

## 2026-09-04 — Owner reopens one bounded compatibility packet

- The monitoring checkpoint directs this Integration Lead to continue the next legal batch through normal deployment and not idle while authorized work remains.
- Reopened allowlist: the WebKit language-switcher keyboard-activation path, its paired test/evidence, and release-memory updates only.
- Existing product/i18n, database, permission, environment, dependency and deployment prohibitions remain unchanged.
- Next: advance the Registry instruction, issue/verify the new Context Packet, then perform one evidence-backed correction and one exact WebKit verification.

## 2026-09-04 — WebKit compatibility packet passes

- Context Packet instruction v5 was issued and SHA-256 verified before writing.
- Root cause: the server-rendered trigger became visible before React/Radix event props were attached in WebKit; locator and page-level Enter presses performed before hydration were correctly ignored.
- The E2E now waits for the existing React event-prop attachment before starting the keyboard path. No application behavior, assertion, retry, timeout or dependency changed.
- Scoped ESLint/Prettier passed and the exact WebKit keyboard/focus/scroll test passed 1/1 with one worker and retry zero.
- Combined browser evidence is Chromium 31/31 and WebKit 31/31 for language switching plus Scanner/Camera. Next: exact manifest/lease preflight and controlled release.
