# ADR — WP03 Customer-output identity recovery

- Status: accepted for local WP03-A implementation
- Date: 2026-07-12
- Scope: customer message, order notify/approval, and inventory receipt recovery UI
- Risk / autonomy: R3 / L2

## Context

WP-00 made customer-visible print and message output fail closed unless the active tenant has a complete, non-contaminated identity. The resolver clears every output field when loading fails, tenant context mismatches, required fields are missing, or a non-default tenant matches the quarantined legacy identity fingerprint.

That boundary is correct, but callers previously received only translated `blockReason` text. Four dialogs showed the reason and disabled their primary action without providing a safe recovery path. A fixed store-settings link would be wrong when only message signature or print footer is missing, and any Settings link is unsafe while the active store and settings row disagree.

## Architecture fact map

- `resolveStoreOutputIdentity` is the cross-feature business rule and remains the only source of `canOutput`.
- Store settings already expose `store_id`, readiness fields, and a scoped React Query retry path.
- Store shell already exposes server-computed `canReadStoreSettings` and `canUpdateStoreSettings`, plus a safe store-context retry.
- `/settings?section=store` and `/settings?section=notifications` are established deep-link protocols.
- Dialog drafts can be long; Settings recovery must open a new tab so the message/receipt context is preserved.
- Public Kiosk is unauthenticated and must never receive private Settings links.

## Options considered

### A. Fixed store-settings link

Add `/settings?section=store` beside every blocked message.

- Advantage: smallest diff.
- Rejected: misroutes notification-only gaps, cannot distinguish loading/error/mismatch, and risks a misleading link during tenant mismatch.

### B. Add semantic resolver metadata and one shared recovery component

Add stable block codes, missing fields, and a recovery target to the existing fail-closed resolver. Render actions through one reusable component whose callers provide existing capabilities and retry callbacks.

- Advantage: one business decision point, exact destinations, no string parsing, reusable accessible states, no new API/schema/dependency.
- Cost: additive shared interface and explicit caller props.
- Decision: accepted.

### C. Feature-specific recovery rules

Each dialog parses `blockReason` or reimplements readiness.

- Rejected: duplicated security rules, translated-string coupling, and predictable drift across print/message surfaces.

## Decision and contracts

`StoreOutputIdentity` adds:

- `blockCode`: stable machine-readable cause;
- `missingFields`: sanitized field identifiers only;
- `recoveryTarget`: `wait`, settings retry, store-context reload, store settings, or notification settings.

The resolver preserves these invariants:

1. `canOutput` requirements do not change.
2. Every blocked result clears store name, address, contact, signature, and footer.
3. No store ID, customer ID, field value, or legacy fingerprint value enters recovery metadata or URLs.
4. An active store requires a matching non-empty settings `store_id`; mismatch or missing binding never receives a Settings link.
5. Store-profile gaps take precedence over notification gaps; notification-only gaps target the notification section.

`StoreOutputIdentityRecovery` is presentational:

- ready: no render;
- loading: polite status, no action;
- settings error: caller-provided retry only;
- context mismatch: caller-provided context reload only;
- settings target: real Link only when server capability permits reading settings;
- settings target: caller-provided refetch remains available after returning from the new tab;
- read-only: explicit contact-owner/manager copy;
- dialog links: new tab with `noopener noreferrer`;
- mobile action: full width and at least 44px.

The component does not query data, mutate settings, infer role names, or weaken the caller's disabled primary action.

## Migration and rollout

- No database, API route, permission action, package, or production migration is required.
- First rollout surface is limited to the four existing inline blockers.
- Toast-only print/buyback, silent order-detail print, Messages health, and authenticated/public Kiosk behavior remain separate reviewed slices.
- Frontend rollback is deletion of the shared component calls and additive metadata; the WP-00 fail-closed resolver behavior remains intact.

## Verification

- Resolver unit matrix for ready, loading, error, mismatch, legacy, store gaps, notification gaps, and mixed gaps.
- Component matrix for permission, link, retry, context reload, accessibility, touch size, and PII-free URL behavior.
- Dialog integration tests keep send/print disabled while recovery is visible.
- Independent security and UI review before local commit.
- Lint, typecheck, bounded regression, visual verification, and `git diff --check` before checkpoint.

## Residual risks

- Other output surfaces still have toast-only or silent feedback and require later WP03-A follow-up.
- The legacy contamination block does not expose affected values by design; operators see only a sanitized recovery destination.
- Query and context retries are best effort; persistent server errors continue to fail closed.
