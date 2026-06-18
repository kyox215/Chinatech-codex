# RepairDesk Department Roster

Use these departments when assigning sub-agent tasks. Every sub-agent prompt must name one primary department and its permission mode.

## INT: Integration Lead

Mode: `integration_write`

Owner: main thread only.

Responsibilities:

- Classify the task.
- Decide whether current web research is required.
- Spawn or reuse sub-agents.
- Own final patches.
- Resolve conflicts.
- Run final verification.
- Report what changed and what remains risky.

Never delegate final integration.

## FLOW: Product Workflow

Default mode: `read_only`

Use for:

- Order, buyback, customer, inventory, payment, pickup, repair, approval, and notification workflows.
- Role simulation: front desk, technician, store owner, customer.
- Allowed transitions, blocked transitions, next action wording.

Expected output:

- Workflow table.
- Allowed and forbidden actions.
- Edge cases.
- Acceptance criteria.

## DATA: Data Design

Default mode: `read_only`

Use for:

- Database schema.
- API contracts.
- Types.
- Mock data.
- Migrations.
- Query performance.
- Cache invalidation.

Expected output:

- Data contract findings.
- Required migration or API changes.
- Server/client/mock consistency risks.

## UX: Page Design

Default mode: `read_only`

Use for:

- RepairOS page layout.
- Mobile density.
- Dialog/Sheet/card/table design.
- Text hierarchy, overflow, a11y, color emphasis.

Must read:

- `docs/UI_PAGE_GENERATION_DECLARATION.md`
- `docs/COMPONENT_GENERATION_DECLARATION.md`
- `docs/RESPONSIVE_DENSITY_PLAN.md`
- `docs/REPAIROS_MOBILE_DETAIL_STANDARD.md`
- `src/lib/ui-patterns.ts`
- `src/lib/component-patterns.ts`
- `src/styles.css`

Expected output:

- UI risks.
- Pattern references.
- Responsive acceptance matrix.

## FE: Frontend Implementation

Default mode: `scoped_write` only when explicitly assigned.

Use for:

- Feature screens.
- React Query usage.
- Client components.
- UI state.
- Form logic.

Rules:

- Do not edit server code unless assigned.
- Do not import `src/server/*` into client code.
- Use `@/lib/repairdesk/api`.
- Use feature query keys.

## API: Backend/API

Default mode: `scoped_write` only when explicitly assigned.

Use for:

- API routes.
- Server services/repositories.
- Zod schemas.
- Server-side business enforcement.

Rules:

- Business-critical rules must be validated server-side.
- No client-only enforcement for payment, customer PII, inventory, or workflow transitions.

## QA: Verification

Default mode: `read_only`

Use for:

- Test plan.
- Regression matrix.
- Browser/mobile verification.
- Role walkthroughs.

Expected output:

- Commands to run.
- Manual checks.
- Pages and viewports.
- Residual risk.

## SEC: Security and Privacy

Default mode: `read_only`

Use for:

- Customer PII.
- Auth and store isolation.
- Payments.
- Attachments.
- Environment variables.
- External transmission such as WhatsApp.

Expected output:

- Sensitive data risks.
- Permission checks.
- Logging/storage restrictions.

## DOC: Documentation and Rules

Default mode: `scoped_write` only for assigned docs.

Use for:

- Updating project declarations.
- Writing long-term design rules.
- Recording research and decisions.

Rules:

- Rules must be actionable.
- No vague preferences.
- Do not contradict `AGENTS.md`.
