# Memory Delta

## Verified project rules

- Desktop beginner workflows expose at most one visually recommended action, but correction/advanced controls remain available and server capabilities remain authoritative.
- New order requires an explicit device-custody choice and exact missing-field focus; switching custody never clears entered unlock credentials.
- Ordinary offline drafts may keep only a boolean re-entry marker; raw PIN/password/pattern values remain excluded.
- Order list rows are read-first; responsibility/supplier edits belong in detail.
- Buyback query failure and true empty data are distinct states.
- A task with no migration diff and an up-to-date linked dry-run closes Supabase as a verified no-op; empty/dummy migrations are forbidden.

## Superseded facts

- Supersede all memory claiming customer-held custody clears or forbids stored unlock credentials. Migration `20260717182220` and the current order addendum retain credentials until an authorized explicit clear.
- Supersede the memory claim that new order visibly defaults to `with_shop`; the current UI starts unselected and requires staff confirmation.

## Department changes

- Product/Design/Frontend: simplified desktop task hierarchy, exact focus, role-filtered shortcuts and read-first lists.
- Backend/Security/Data: custody is independent from credential retention; credential visibility and mutation stay permissioned; this release has no schema write.
- QA/Documentation: 1024–1600 desktop matrix and readiness-before-screenshot become the evidence pattern for this workflow.

## Capability assessment

- Keep Integration Lead and read-only release reviewers at their existing C1/C2 levels. This is one successful cross-domain release candidate and does not change permission or autonomy.
- Candidate improvement: reuse the two-pass QA pattern—initial adversarial findings followed by a fresh read-only GO audit after fixes.
