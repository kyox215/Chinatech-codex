# Checkpoints — TASK-20260707-012-new-order-apple-model-suggestions

## 2026-07-07T19:28:07Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-07T19:28:20Z — Added Apple/iPhone model suggestions to the new repair order device model field and wired selection so Apple models can be chosen directly and normalize the brand to Apple.

- **Phase:** completed-local-verification
- **Completed/current state:** Added Apple/iPhone model suggestions to the new repair order device model field and wired selection so Apple models can be chosen directly and normalize the brand to Apple.
- **Next:** Ready for owner review. If shipping, stage only the scoped UI/model/test and task-memory files, avoiding unrelated dirty worktree changes.
- **Decision:** Use datalist suggestions rather than a custom picker to keep the existing compact field UI and preserve manual model input for unsupported devices; show Apple suggestions when brand is blank, Apple, 苹果, or iphone.
- **Evidence:**
  - src/features/orders/model/new-order-form.ts:103 adds 52 Apple iPhone model suggestions from current iPhone 17e/Air/17 family through legacy iPhone models, plus brand-scoped helper functions.
  - src/features/orders/forms/new-order-customer-device-section.tsx:56,122,177 wires a model datalist into the device information section and auto-normalizes the brand to Apple when an Apple model suggestion is selected.
  - src/features/orders/model/new-order-form.test.ts:62 adds tests for current/legacy Apple suggestions, blank/Apple/苹果 brand behavior, non-Apple suppression, and case-insensitive model recognition.
  - Validation passed: targeted eslint for touched files; npx vitest run src/features/orders/model/new-order-form.test.ts (1 file, 7 tests); npm run typecheck; npm run lint; npm run test (83 files, 539 tests); npm run build outside sandbox; git diff --check for scoped files.
  - Browser verification on http://localhost:3012/orders: new order dialog exposed model datalist repair-device-model-suggestions with 52 options, including iPhone 17e, iPhone Air, iPhone 17 Pro Max, iPhone 8, and iPhone (1st generation); filling iPhone 17 Pro Max set brandValue Apple and modelValue iPhone 17 Pro Max. Screenshot: /private/tmp/repairdesk-new-order-apple-model-options-20260707.png.
- **Recorded by:** CEO-Orchestrator
