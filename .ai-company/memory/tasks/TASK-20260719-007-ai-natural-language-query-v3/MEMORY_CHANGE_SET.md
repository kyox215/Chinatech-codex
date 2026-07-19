# Memory Change Set — TASK-20260719-007

## Promoted durable rules

- External model plans are candidates only; final order filters must be compiled from independently recognized original-message evidence.
- Invalid, reversed or ambiguous dates fail closed with clarification and never degrade into a broader query.
- All-history/archive scope requires explicit `order:archive_browse`; there is no silent active-only fallback.
- Query UI separates processing mode from interpretation status and exposes exact applied scope/date/timezone/source in a compact disclosure.
- Result cards remain page-inline; only an explicit order link navigates.

## Department synchronization

- Architecture: closed-world compiler and arbitrary-date boundary.
- Frontend: compact mode/usage row, collapsible exact scope and explicit navigation.
- QA: exact regression, adversarial provider and honest dev-harness limitation.
- Security: original-text authority, archive permission and no-write/no-migration boundary.
- Documentation: V3 staff-order-assistant document is current behavior authority.
- Data: no durable update required because no schema, repository contract, migration or production data changed.

## Not promoted

- Temporary commands, ports, local browser sessions and fixture identities.
- A claim that every service quote proves work completion.
- Production write capability, broader store authority or a higher autonomy level.
