# WP-03 Context Packet — 账号、店铺、通知与默认规则

- Rehydrated at: 2026-07-12T12:26:49Z
- Current branch: `codex/settings-center-v2-20260712`
- Current HEAD: `19895c2d`
- Risk / autonomy: R3 / L2
- Status: active, local and reversible

## Authority and provenance

The full Owner-approved planning source is preserved in the original dirty checkout at:

`/Users/kyox215/Documents/文稿 - kyox215的MacBook Pro/Codex/2026-05-17/zip-github/.ai-company/memory/tasks/TASK-20260712-004-settings-center-master-plan/SETTINGS_CENTER_MASTER_PLAN.md`

SHA-256 at rehydration: `ee8f684699465235b927a756327bad3f892b83e9984a5a60072905bd5d6e6100`.

Its header says `proposed`, but the later Owner instruction recorded in the original task checkpoint and the active goal explicitly approved execution of WP-00 through WP-08. This packet preserves the executable subset so future sessions do not depend on the dirty checkout.

## Verified current state

- WP-00, WP-01, and WP-02 are committed locally as `6851117c`, `c62223b0`, and `19895c2d`.
- The isolated worktree was clean at rehydration and is three commits ahead of the planning baseline.
- WP-02 provides strict section updates, actor-bound store context, `updated_at` CAS, three-way conflict rebase, multiple-draft navigation protection, 16-case Settings E2E, and independent security/UI PASS conclusions.
- `settings-screen.tsx` is still a large orchestration file; `src/features/settings/sections/` does not yet exist.
- No production database action, migration, role-semantics change, data-retention change, push, or deployment has occurred.

## Approved work-package mapping

| Work package | Approved settings domains                                               |
| ------------ | ----------------------------------------------------------------------- |
| WP-03        | Account, store, notifications/print, default rules                      |
| WP-04        | Members/permissions and suppliers                                       |
| WP-05        | Customer iPad / Kiosk                                                   |
| WP-06        | Order workflow                                                          |
| WP-07        | Order data center                                                       |
| WP-08        | Full quality gate, screenshots, documentation, release/rollback package |

## WP-03 approved outcomes

### Account

- Keep display-name editing and its independent save/error/dirty behavior.
- Show account nature, email verification, and current-store role as read-only summaries when already available from the current account/store contracts.
- Keep email, password, and contact-phone credential changes in `/account`; do not duplicate Auth workflows in Settings.
- All authenticated users may modify only their own display name.

### Store

- Separate current-store switching/creation from business-profile editing.
- Owner/manager edit; staff/viewer receive explicit read-only information rather than misleading disabled management controls.
- Show readiness, missing fields, and which print/receipt/message actions are blocked.
- Preserve strict store-section payload, server validation, CAS, active-store scoping, dirty guard, and store-switch late-response protection.
- Do not add VAT, hours, time zone, currency, or other new schema fields.

### Notifications and print

- Keep live message/print previews while saving only notification fields.
- Provide a real `/messages` link; do not copy the template editor into Settings.
- Template-health data may be added only if it can use an existing safe contract; a new BFF/API requires a separate boundary review.
- Do not send test WhatsApp/SMS as part of this work package.

### Default rules

- State clearly that defaults apply only to newly created business objects and never rewrite existing orders or inventory.
- Preserve server-defined month ranges, zero semantics, section-only save, and CAS.
- A restore-default action must preview the values and require confirmation.
- Modifier/audit summaries may appear only when supported by an existing minimal-data contract; do not invent data or expose raw audit payloads.

## First executable slice

1. Add machine-readable output-identity recovery metadata without changing readiness requirements.
2. Add one shared responsive recovery alert/action under the store entity UI boundary.
3. Replace the four existing inline blockers in customer message, order notify, order approval, and inventory receipt dialogs.
4. Loading and store-context mismatch must not offer a misleading Settings action. Store-profile gaps recover to `/settings?section=store`; notification-only gaps recover to `/settings?section=notifications`.
5. The public Kiosk surface must never link to private Settings. Toast-only and disabled-print surfaces are a separately verified follow-up slice.

## Planned WP-03 sequence

- WP03-A: plan continuity plus shared output recovery action.
- WP03-B: extract and complete account/store sections without changing API semantics.
- WP03-C: extract and complete notifications/rules, including `/messages` link and default-impact explanation.
- WP03-QA: role projection, error/read-only states, six viewports, screenshots, full gates, independent review, checkpoint, and local commit(s).

The sequence is an implementation proposal inside the approved WP-03 scope; it is not a new Owner decision about product behavior.

## Context status labels

### Verified

- The WP-03 domain scope and role/readiness acceptance come from the approved master plan.
- Existing output identity blocks customer-visible output rather than borrowing another tenant identity.
- The first recovery CTA was already recorded as a WP-03 follow-up in the WP-00 checkpoint.

### Observed

- Existing dialog blockers show only text and a disabled primary action; they do not provide a recovery link.
- Order-list print and buyback quote currently use Toast-only feedback; order-detail print is disabled without a persistent recovery action.
- The full master-plan file is absent from the isolated branch and exists only in the original dirty checkout.

### Inferred

- The first shared recovery slice requires no migration or permission change.
- A semantic recovery target derived from the existing missing-field categories improves reachability without weakening readiness.

### Proposed

- Introduce stable output block codes/missing fields/recovery section and a shared entity-level UI component.
- Stage Toast-only and public-Kiosk follow-ups after the four existing inline blockers pass independent review.

## Hard stops and unresolved decisions

Stop and request Owner approval before any of the following:

- changing role or Kiosk capability semantics;
- changing self-service store-creation policy;
- adding fields, migrations, RPCs, indexes, Cron, or retention behavior;
- adding account multi-table atomic updates, transactional workflow/Kiosk writes, or audit visibility;
- external test messages, production data, `main` push, or deployment.

WP-05 and WP-06 cannot meet their final transaction guarantees without a later database approval. WP-07 retention monitoring remains behind the data-retention gate.

## Validation contract

- Resolver tests for every block code, missing-field set, and recovery target.
- Shared recovery component tests for ready/blocked/no-action states, exact href, accessible alert text, and 44px mobile action.
- Dialog integration tests ensure the action is visible only when output is blocked and contains no store/customer PII in the URL.
- Account/store/notifications/rules tests cover owner/manager edit, staff/viewer read-only, loading/error/retry, dirty/saving/saved/validation/conflict, cache refresh, and active-store isolation.
- Browser verification at 390, 430, 768, 1024, 1280, and 1440 with no page overflow or pointer-lock residue.
- Required gates: agents check, lint, typecheck, bounded full tests, Settings E2E, and production build.

## Agent team and integration ownership

- `/root/wp03_plan_recovery`: read-only recovery of the approved mapping, completion inventory, and stop gates.
- `/root/wp03_output_identity`: read-only inventory of output blockers, recovery contract, and test surfaces.
- A third independent UX/security spawn was attempted but the thread limit was reached; the Integration Lead owns that analysis until a slot is available.
- `/root` remains the sole writer and final integration owner. Sub-agents may not stage, commit, push, deploy, or perform database actions.

## Architecture decision

WP03-A uses the additive semantic-contract option documented in `ADR-WP03-OUTPUT-IDENTITY-RECOVERY.md`:

- resolver: block code, missing fields, and recovery target;
- shared component: permission-aware presentation and safe recovery action;
- callers: provide existing settings-query retry, store-context retry, and server-derived read/update capabilities.

Rejected alternatives are a fixed `/settings?section=store` link and per-feature error parsing. Both would misroute notification-only gaps; per-feature parsing would also couple behavior to translated copy.

## Next action

Complete independent security/UI review of the WP03-A snapshot, fix any P0/P1, run broader gates and visual verification, then checkpoint and commit locally. Stop if later work would change readiness meaning, expose private Settings to Kiosk, or require a new API/schema.
