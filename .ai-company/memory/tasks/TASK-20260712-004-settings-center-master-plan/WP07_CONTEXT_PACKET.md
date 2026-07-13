# WP-07 Context Packet — 工单数据中心

Status: local_conditional_closeout
Owner: Integration Lead
Risk / autonomy: R3 / L2 bounded local execution
Verified worktree: `/private/tmp/repairdesk-settings-center-20260712`
Verified branch baseline: `2ef412d0`
Last rehydrated: 2026-07-13 CEST

## Authority and provenance

The Owner-approved Settings plan is preserved in the original dirty checkout at:

`/Users/kyox215/Documents/文稿 - kyox215的MacBook Pro/Codex/2026-05-17/zip-github/.ai-company/memory/tasks/TASK-20260712-004-settings-center-master-plan/SETTINGS_CENTER_MASTER_PLAN.md`

SHA-256 recorded at rehydration:
`ee8f684699465235b927a756327bad3f892b83e9984a5a60072905bd5d6e6100`.

The approved WP-07 outcome is an owner-only, store-bound order-data center with safe exports,
preview-before-apply, complete feedback, responsive layouts, and explicit release controls. This
packet does not expand approval to database changes, retention policy, production data, push, or
deployment.

## Verified starting risks

- Repair-item matching scanned all repair items for every order row at the 10,000 × 50,000
  contract limit, allowing algorithmic denial of service.
- Order export could materialize an unbounded repair-item array before building the workbook.
- Feature flags were fail-open when unset and the mock granted order-data authority to any owner
  membership instead of the primary store owner.
- The Settings UI omitted store/mode/expiry/public-number context, silently truncated rows, used
  transient errors, and lacked a final confirmation, navigation guard, and complete reports.
- The existing Apply RPC hardcodes workflow/default warranty behavior that does not match normal
  order creation and does not write the required warranty audit metadata.
- Cleanup is opportunity-based on a later preview. Expiry blocks Apply but is not proof of timed PII
  deletion.

## Implemented local safe slice

- Repair-item matching uses exact identifier-signature indexes and preserves multi-identifier
  conjunction semantics. A real 10,000-order/50,000-item regression covers the maximum contract.
- Export enforces the 50,000 repair-item cap before workbook construction.
- Both flags require exact `1`; real and mock access require the active primary store owner. Apply
  remains default-off.
- Batch history is store-scoped, primary-owner protected, lazy-loaded, limited to 20, and exposes
  only allowlisted numeric summaries plus safe operator labels. Repository errors are logged
  internally and mapped to stable public messages.
- The Settings section shows store, mode, file, expiry, public order number, changed fields, and
  persistent status. It renders 10 rows initially, at most 100 in-page, and provides formula-safe
  full CSV preview/error reports.
- File/mode/actions lock during pending work; expiry is checked in the UI and server path; one result
  locks the current batch. Apply needs an explicit checkbox and second confirmation.
- Selected files and previews join the shared dirty-navigation guard. There is no fake “save” path.
- Six widths, 44px mobile targets, non-owner zero-request behavior, final confirmation, partial
  recovery, and pointer release are covered by dedicated Playwright tests and synthetic screenshots.

## Hard release gates

1. **Apply invariant parity:** a new reviewed database contract must use the real runtime initial
   order status, store default warranty semantics, and warranty reason/actor/timestamp audit fields.
2. **Transaction capacity:** prove the chosen maximum batch size against production-equivalent
   PostgreSQL. Reduce the cap or move to a resumable background job if 10,000 rows cannot complete
   safely within bounded time.
3. **Concurrency and limiting:** verify batch CAS/idempotency under concurrent Apply and add
   a streaming request-body hard limit plus distributed request limiting/observability before
   enabling upload, export, or bulk writes. Missing/chunked `Content-Length` must not bypass the cap.
4. **Retention:** Owner/legal/data approval must select the retention duration, scheduler,
   monitoring, failure alert, and operator runbook. Opportunity cleanup is not sufficient.
5. **Impact review:** before/after values and an auditable edge-level Apply summary require a safe
   contract before production bulk writes are exposed.
6. **Atomic staging:** the batch and every staged row must become previewable in one transaction or
   remain unusable; cleanup failure must not leave a partially staged `previewed` batch.
7. **Production proof:** linked migration history, RLS/grants, dry-run, post-apply metadata checks,
   cross-store rejection, rollback/conflict behavior, and synthetic production smoke require a
   separate release approval.

## Stop conditions

- Do not change or apply migrations, run linked Supabase commands, inspect production customer/order
  data, decide retention policy, enable Apply, push, deploy, or represent the feature as
  production-ready.
- A local commit may contain only the safe UI/API/performance/test/documentation slice after the
  final quality gate and independent P0/P1 review are green.

## Terminal corrections and validation

- Architecture review found that identifier-signature indexing could reorder interleaved repair
  rows. Candidate indexes are now merged and sorted by original row index before consumption, with
  a dedicated order-preservation regression.
- Error redaction initially made four safe Apply recovery mappings unreachable. Repository code now
  extracts only allowlisted typed codes while keeping the public message fixed; service mapping no
  longer depends on raw database text.
- UX review found a 32px no-permission return action and approximately 30px Select options. Both are
  now at least 44px after stable layout, and browser assertions cover 390/430px.
- Independent architecture/QA, security, and UI/UX final reviews: P0=0/P1=0. Production-only P1
  gates remain intentionally open and keep both real flags disabled.
- Focused unit/component/API/repository regression: 9 files / 104 tests passed.
- Full Vitest: 167 files / 1073 tests passed.
- Dedicated WP-07 Playwright: 10/10 passed across 390, 430, 768, 1024, 1280, and 1440 widths. A
  broader 56-case Settings run also recorded passed status; the final WP-07 delta was rerun 10/10.
- Five synthetic screenshots were generated and visually inspected; older WP03–WP06 screenshots
  automatically rewritten by the broad E2E run were restored to preserve evidence history.
- Full lint, typecheck, Agent rules, `git diff --check`, and production build passed. The build needed
  approved local process/port access because sandboxed Turbopack cannot bind its helper port.
- No migration, linked database access, production data, role/retention decision, push, deployment,
  or real feature enablement occurred.
