# Memory Delta — TASK-20260718-001-order-cost-defaults

## Candidate project facts

- **Fact:** internal repair-line costs are stored outside `fault_prices`; only non-sensitive `line_id` and `catalog_key` join quote lines to immutable cost snapshots. **Status:** production verified. **Owner:** Orders/Data/Security. **Review trigger:** quote-line or cost-storage redesign.
- **Fact:** blank cost means unknown while numeric `0` is an explicit zero-cost value; parsers, DB RPCs and UI warnings must preserve the distinction. **Status:** PostgreSQL and UI verified. **Owner:** Orders/Finance. **Review trigger:** monetary parser or schema change.
- **Fact:** `finance:cost_manage` is inherent for Owner and only grantable to Manager; profit-read can read but not write; technician/sales/viewer forged grants fail closed. **Status:** independent security review PASS. **Owner:** Security/Stores. **Review trigger:** role matrix change.

## Candidate decisions

- Default costs are copied only when a new quote line/order snapshot is created. Later default edits never rewrite existing orders. **Status:** production schema and behavior verified. **Owner:** Product/Data. **Review trigger:** inventory or supplier cost integration.
- Sensitive permission replacement and `update_member_permissions` audit must remain one database transaction; never restore a fallible application-layer audit after the grant commit. **Status:** forced-failure rollback verified. **Owner:** Security/Data. **Review trigger:** member permission RPC change.
- Emergency rollback is feature-flag first. Additive cost tables and audit evidence remain in place; do not drop or erase them during routine rollback. **Status:** release plan verified. **Owner:** Release/Data. **Review trigger:** destructive retention proposal.

## Candidate capability evidence

- RepairDesk can deliver an additive sensitive-finance feature through isolated worktree, migration-first rollout, feature flag, database fault injection, independent security review, exact-SHA main push and production browser evidence. **Status:** repeated end-to-end success in this task. **Owner:** IntegrationLead. **Review trigger:** capability review or next R3 finance/permission release.
