---
task_id: TASK-20260620-014006-repairdesk-figma-ui-system
title: RepairDesk Figma UI system and design-first refactor target
status: figma_blocked_local_motion_payloads_storyboard_ready
phase: motion_payloads_storyboard_prepared
risk_level: R2
autonomy_level: L2
created_at: 2026-06-20T01:40:06+02:00
owner_thread: CEO Agent / RepairDesk Integration Lead
---

# Task

Implement the owner-approved design-first plan for RepairDesk:

- Create a new Figma file for a RepairDesk UI system.
- Convert the current redesign direction into Figma foundations, components, and page targets.
- Use Figma as the source target before changing broad application code.
- Preserve the owner's protected mobile scope.
- Latest owner update: complete the Figma component/page design first, optimize both desktop and mobile for compact high-density information, and make desktop pages show complete task-critical information on one page where feasible.

# Protected Scope

Do not modify or replace these areas without a later explicit owner decision:

- Mobile order detail page.
- Mobile order work-order management.
- Mobile order task/workflow pages.
- Existing mobile order detail visual standard in `docs/REPAIROS_MOBILE_DETAIL_STANDARD.md`.

Known protected implementation surfaces include:

- `src/features/orders/screens/order-detail-screen.tsx` mobile detail sections.
- `src/features/orders/screens/order-list-screen.tsx` mobile list/management sections.
- `src/features/orders/components/order-list-mobile-header.tsx`.
- `src/features/orders/components/order-list-items.tsx` mobile card behavior.
- `src/features/orders/screens/order-task-screen.tsx`.

# Implementation Contract

- Use official Figma concepts from current research: auto layout, components, variants, variables, and component properties.
- Keep local code changes limited to task memory unless a later owner-approved implementation phase begins.
- Do not delete legacy route files in this task; legacy cleanup remains a separate owner decision.
- Do not alter production data, secrets, dependencies, payment, permission, or deployment settings.
- Maintain single-writer ownership in the main thread.
- After the latest owner update, do not expand broad code refactors before Figma resumes; only stabilize already-applied reversible local batches and keep protected mobile order surfaces locked.

# Department Handling

No sub-agents were spawned for this task because the available multi-agent tool policy requires an explicit user request for sub-agents or parallel agent work in the current turn. Department responsibilities are handled by the main Integration Lead thread:

- Product and UX: page target map and protected-scope interpretation.
- Design system: variables, components, and page frames in Figma.
- Engineering integration: codebase boundary check and later implementation handoff.
- QA: metadata and screenshot verification.

Current batch no-spawn reason: the customer tags selection-row migration was a small, low-risk, single-writer UI componentization change; spawning read-only department sub-agents would add overhead without improving file ownership or verification quality.

Current continuation no-spawn reason: the customer list InfoTile batch touched one non-protected customer list component plus shared slot support and documentation; it was low-risk, single-writer UI convergence with direct browser verification, so sub-agent spawning would add coordination overhead without improving ownership.

Current messages action-row no-spawn reason: the message template selection-row and variable insertion-row migration touched one non-protected page plus shared button typing and documentation; it was a small, low-risk, single-writer UI componentization change with direct browser verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current buyback choice/toggle no-spawn reason: the Buyback quote workspace choice-summary and boolean toggle-row migration touched one non-protected component plus documentation; it was a small, low-risk, single-writer UI componentization change with direct browser verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current buyback model-choice no-spawn reason: the Buyback quote workspace iPhone model selection-card migration touched one non-protected component plus documentation; it was a small, low-risk, single-writer UI componentization change with direct browser verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current buyback storage/battery no-spawn reason: the Buyback quote workspace storage-capacity and battery-health picker migration touched one non-protected component plus documentation; it was a small, low-risk, single-writer UI componentization change with direct browser verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current buyback series-picker no-spawn reason: the Buyback quote workspace iPhone series picker migration touched one non-protected component plus documentation; it was a small, low-risk, single-writer UI componentization change with direct browser verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current buyback choicegroup no-spawn reason: the Buyback quote workspace generic ChoiceGroup option-chip migration touched one non-protected component plus documentation; it was a small, low-risk, single-writer UI componentization change with direct browser verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current customer list badge internals no-spawn reason: the customer list badge/internal chip migration touched one non-protected customer list component plus documentation; it was a small, low-risk, single-writer UI componentization change with direct browser verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current buyback attachment capture no-spawn reason: the Buyback quote workspace attachment capture migration touched one non-protected component plus documentation and task memory; it was a small, low-risk, single-writer UI componentization change with direct screenshot verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current inventory import preview no-spawn reason: the Inventory SeaTable import preview migration touched one non-protected inventory screen plus documentation and task memory; it was a small, low-risk, single-writer UI componentization change with direct screenshot verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current inventory error-card no-spawn reason: the Inventory load and inline refresh error migration touched one non-protected inventory screen plus documentation and task memory; it was a small, low-risk, single-writer UI componentization change with direct screenshot verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current messages state-card no-spawn reason: the Messages template load-error, no-template empty-state, and no-match group-row migration touched one non-protected messages screen plus documentation and task memory; it was a small, low-risk, single-writer UI componentization change with direct screenshot verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current settings state-card no-spawn reason: the Settings load-error migration touched one non-protected settings screen plus documentation and task memory; it was a small, low-risk, single-writer UI componentization and reachable-error-state fix with direct screenshot verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current platform state-card no-spawn reason: the Platform onboarding queue load-error and empty-state migration touched one non-protected platform admin screen plus documentation and task memory; it was a small, low-risk, single-writer UI componentization change with direct screenshot verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current dashboard state-card no-spawn reason: the Dashboard partial-data warning and recent-orders empty-state migration touched one non-protected dashboard screen plus documentation and task memory; it was a small, low-risk, single-writer UI componentization change with direct screenshot verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current customer empty-line no-spawn reason: the Customer detail empty activity/order/follow-up line migration touched one non-protected customer shared component plus documentation and task memory; it was a small, low-risk, single-writer UI componentization change with direct screenshot verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current inventory detail empty-line no-spawn reason: the Inventory detail attachment, timeline, risk/deduction, and financial-ledger empty-line migration touched one non-protected inventory screen plus documentation and task memory; it was a small, low-risk, single-writer UI componentization change with direct screenshot verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current customer detail state-card no-spawn reason: the Customer detail full-load error and inline refresh warning migration touched one non-protected customer detail screen plus documentation and task memory; it was a small, low-risk, single-writer UI componentization change with direct screenshot verification for the full-load state, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current buyback empty-state no-spawn reason: the Buyback empty-state and mobile side-metric convergence touched one non-protected buyback screen plus documentation and task memory; it was a small, low-risk, single-writer UI componentization change with direct screenshot verification, so spawning read-only department sub-agents would add overhead without improving file ownership or validation quality.

Current Figma blueprint runner no-spawn reason: Figma MCP is blocked by the Starter call limit, so live multi-agent Figma review cannot inspect or mutate the file. The main Integration Lead prepared local, reversible, non-production Figma blueprint artifacts and recorded them as pending Figma execution rather than claiming visual completion.

Current Figma payload/storyboard no-spawn reason: the live Figma file remains inaccessible due to the same Starter call limit. The main Integration Lead generated deterministic payloads and a local storyboard preview from the existing blueprint; this was a local documentation/tooling batch with no code refactor and no production risk.

Current Figma motion/storyboard no-spawn reason: the owner asked to implement the approved plan, but the live Figma MCP tool remains blocked by the Starter call limit. The main Integration Lead updated the deterministic local Figma blueprint, staged `use_figma` payloads, storyboard preview, motion-state specification, and evidence without touching protected order mobile source files.

# Acceptance Criteria

- [x] A Figma design file exists and is linked in evidence.
- [x] Figma foundations include variables/styles for RepairDesk UI work.
- [ ] Figma components include reusable desktop-oriented primitives and business UI blocks.
- [ ] Figma page targets exist for the non-protected areas to be refactored later.
- [x] Protected mobile order detail and mobile work-order management are not edited by this task.
- [x] Visual evidence blocker is recorded: Figma MCP Starter call limit blocked page generation and screenshot capture.
- [x] Local non-protected shared header refactor batches are browser-screenshot verified.
- [x] Shared list scaffold now supports default desktop headers for consistent non-protected page states.
- [x] Shared list scaffold now supports KPI/Metric header addons for non-protected dense desktop pages.
- [x] Shared dense section header exists and is adopted by Dashboard, Settings, Messages, Platform admin, and Buyback record detail sections.
- [x] Customer detail and Inventory detail section headers use the shared dense section header pattern.
- [x] Shared dense info primitives `RepairOsInfoTile` and `RepairOsInfoGrid` exist for Figma Info Card, Metric Card, and Data Row targets.
- [x] Customer detail metrics/profile blocks and Inventory detail finance/product/check blocks use the shared dense info primitives.
- [x] Shared dense info line primitive `RepairOsInfoLine` exists for single Data Row usage.
- [x] Buyback quote workspace section titles, info metrics, metric pills, and sidebar info lines delegate to shared RepairOS primitives.
- [x] Customer detail mobile floating-header metrics and desktop summary-rail metrics use `RepairOsInfoTile`.
- [x] Buyback record detail quote/device/proof metric tiles use `RepairOsInfoTile`.
- [x] Dashboard KPI metric cards and Platform approval dialog info fields use `RepairOsInfoTile`.
- [x] Buyback mobile inline customer/device/quote info blocks use `RepairOsInfoTile` leading/meta slots.
- [x] Shared `RepairOsBusinessCard` supports leading/body/trailing slots for Figma Business Card and Action Row targets.
- [x] Dashboard task cards, quick module links, recent order cards, and loading skeletons use `RepairOsBusinessCard`.
- [x] Customer detail device cards, order rows, contact records, and followup rows use `RepairOsBusinessCard`.
- [x] Settings page section titles use `RepairOsSectionHeader` directly and settings member/readiness rows use `RepairOsBusinessCard`.
- [x] Dashboard section titles call `RepairOsSectionHeader` directly without a local `SectionTitle` wrapper.
- [x] Platform admin mobile request cards use `RepairOsBusinessCard` while approval/reject logic remains unchanged.
- [x] Inventory mobile list cards use `RepairOsBusinessCard` while inventory queries, status actions, and detail flows remain unchanged.
- [x] Customer tag selection rows use `RepairOsBusinessCard as="label"` with native checkbox semantics while tag save/mutation logic remains unchanged.
- [x] Customer list KPI cards and mobile next-step blocks use `RepairOsInfoTile` while customer list query, pagination, detail preview, and create flows remain unchanged.
- [x] Message template list rows and variable insertion rows use `RepairOsBusinessCard as="button"` while template save/reset/insert logic remains unchanged.
- [x] Buyback quote selected-estimate summary rows and boolean inspection toggle rows use `RepairOsBusinessCard` while quote calculation, attachments, save, and inventory handoff logic remain unchanged.
- [x] Buyback quote iPhone model selection cards use `RepairOsBusinessCard as="button"` while model selection, capacity reset, market price reset, quote calculation, and inventory handoff logic remain unchanged.
- [x] Buyback quote storage-capacity and battery-health picker cards use `RepairOsBusinessCard as="button"` while storage market suggestion, battery deduction, quote calculation, and inventory handoff logic remain unchanged.
- [x] Buyback quote iPhone series picker cards use `RepairOsBusinessCard as="button"` while selected-series filtering, model list display, quote calculation, and inventory handoff logic remain unchanged.
- [x] Buyback quote generic ChoiceGroup option chips use `RepairOsBusinessCard as="button"` while screen/body condition, document type, signature status, quote calculation, and inventory handoff logic remain unchanged.
- [x] Customer list mobile device-count, work-state, payment-state, and tag chips use `RepairOsBadge` while customer list queries, pagination, preview dialog, create flow, and detail links remain unchanged.
- [x] Buyback quote attachment capture cards use `RepairOsBusinessCard as="label"` while file input, camera capture, reset action, attachment state, quote save/defer/reject, and inventory handoff behavior remain unchanged.
- [x] Inventory SeaTable import preview uses `RepairOsBusinessCard` and `RepairOsInfoTile` summary metrics while CSV preview/apply mutations, import mapping, inventory queries, and order screens remain unchanged.
- [x] Settings load error uses `RepairOsBusinessCard as="div"` and is reachable before the `!draft` loading fallback while settings retry/API behavior and order screens remain unchanged.
- [x] Platform onboarding queue load error and empty state use `RepairOsBusinessCard as="div"` while approve/reject mutations, platform API behavior, and order screens remain unchanged.
- [x] Dashboard partial-data warning and recent-orders empty state use `RepairOsBusinessCard as="div"` while dashboard queries, fallback stats, task links, and order screens remain unchanged.
- [x] Customer detail empty activity/order/follow-up lines use `RepairOsBusinessCard as="div"` while customer detail queries, tabs, follow-up actions, order links, and order screens remain unchanged.
- [x] Inventory detail attachment, timeline, risk/deduction, and financial-ledger empty lines use `RepairOsBusinessCard as="div"` while inventory detail queries, action dialogs, import flow, transaction rendering, and order screens remain unchanged.
- [x] Customer detail full-load error and inline refresh warning use `RepairOsBusinessCard as="div"` while retry, back-link, tabs, dialogs, customer detail query behavior, and order screens remain unchanged.
- [x] Buyback list empty state uses `RepairOsBusinessCard as="div"` and mobile buyback card side metrics use `RepairOsInfoTile` while quote creation, filters, record detail, inventory handoff, and order screens remain unchanged.
- [x] Local Figma-first blueprint exists for desktop/mobile page targets, component targets, protected order boundaries, and a staged `use_figma` runner script.
- [x] Generated `use_figma` payloads exist for all 10 staged run modes, plus a local desktop/mobile storyboard preview and screenshot.
- [x] Local Figma-first blueprint includes visual polish rules, motion tokens, interaction-state requirements, reduced-motion guidance, and Prototype flow targets.
- [x] Generated `use_figma` payloads include motion-token boards, component interaction-state boards, and page-level Prototype flow boards.
- [x] Local storyboard preview includes motion token cards, interaction-state matrix, Prototype flow cards, and a screenshot evidence file.
- [ ] Latest owner Figma-first page targets for compact desktop one-page density remain blocked by the Figma MCP Starter call limit.
