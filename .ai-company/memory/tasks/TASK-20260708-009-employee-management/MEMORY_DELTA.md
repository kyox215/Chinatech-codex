# Memory Delta — TASK-20260708-009-employee-management

- Employee management base lifecycle should reuse `store_memberships.role` and `store_memberships.status`; no base schema migration is required for role update, disable, or restore.
- `stores/members` is sensitive because it exposes member emails, invitations, and invite-link metadata; service access should require `member:manage_basic` unless a separate redacted directory API is built.
- Store managers may manage ordinary employees only; manager role grant/target-manager lifecycle remains owner-only.
- Owner transfer/removal remains out of scope and should use a separate elevated flow, not the ordinary member update/disable/restore API.
