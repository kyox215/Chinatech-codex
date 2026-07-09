# Memory Delta — TASK-20260709-016-supplier-permission-mobile-picker

## Candidate project facts

- Supplier visibility is now controlled by store-scoped explicit grants: `supplier:read`, `supplier:assign`, and `supplier:manage`. Owner has all three by role; other roles are denied unless granted.
- `public.store_member_permission_grants` is service-role-only with RLS enabled. The app reads active grants in `getRequestActor` and strips supplier fields from orders when `supplier:read` is absent.
- Mobile order cards use a micro supplier picker embedded in the existing device card row; no separate bottom supplier row should be reintroduced.

## Candidate department updates

- DATA: Do not use `supabase db push --linked --include-all` to resolve historical migration drift. Use audit/repair, then dry-run the target migration.
- SEC: Supplier list/details are sensitive store information; UI hiding is not sufficient without API redaction.
- UX: Supplier controls in dense mobile order cards should remain micro-sized and live inside existing card content.

## Candidate decisions / ADRs

- Decision: Managers do not automatically receive supplier visibility or management rights. The owner must grant non-owner supplier permissions explicitly.
- Decision: `supplier:manage` implies assign/read; `supplier:assign` implies read.

## Candidate lessons and capability evidence

- `supabase db query --linked` may fail with pooler temp-role auth even when `db push` and `migration list` succeed; treat migration list as migration-history proof and retry SQL inspection separately if needed.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
