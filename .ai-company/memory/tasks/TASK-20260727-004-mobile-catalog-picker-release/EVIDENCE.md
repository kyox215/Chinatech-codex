# Evidence Index — TASK-20260727-004-mobile-catalog-picker-release

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-27T02:12:08Z | CEO-Orchestrator |
| E-002 | prior implementation | fixed mobile Drawer baseline exists locally and is not yet published | commits `bd8573b0`, `89e2b1f8`; prior task `TASK-20260727-001-mobile-catalog-popover-scroll` | observed | 2026-07-27 | IntegrationLead |
| E-003 | code audit | mobile Drawer still places `CommandInput` first and old E2E uses programmatic `scrollTop` | `src/features/inventory/components/inventory-phone-catalog-fields.tsx`; `tests/e2e/inventory-mobile-catalog-scroll.spec.ts` | observed; remediation required | 2026-07-27 | IntegrationLead |
| E-004 | implementation | compact phone/iPad picker explicitly disables autofocus, preserves the top search/manual field and gives the list a contained scroll owner; desktop remains Popover | `src/features/inventory/components/inventory-phone-catalog-fields.tsx` | implemented | 2026-07-27 | IntegrationLead |
| E-005 | unit | mobile no-focus, iPad fixed picker, desktop Popover and existing catalog behavior | `npm run test -- src/features/inventory/components/inventory-phone-catalog-fields.test.tsx src/features/inventory/model/eu-phone-catalog.test.ts` | 2 files / 12 tests passed | 2026-07-27 | IntegrationLead |
| E-006 | regression | full Vitest project suite | `npm run test` | 361 files / 2403 tests passed | 2026-07-27 | IntegrationLead |
| E-007 | static/build | lint, TypeScript, diff hygiene and production build | `npm run lint`; `npm run typecheck`; `git diff --check`; `npm run build` | passed; build generated 27/27 static pages | 2026-07-27 | IntegrationLead |
| E-008 | browser | phone no-autofocus, Chromium native touch gesture, iPad fixed surface and desktop Popover | `tests/e2e/inventory-mobile-catalog-scroll.spec.ts` under Chromium | 3/3 passed | 2026-07-27 | IntegrationLead |
| E-009 | browser | WebKit phone no-autofocus/list scroll ownership, iPad fixed surface and desktop Popover | same E2E with `PLAYWRIGHT_BROWSER=webkit` | 3/3 passed; mobile WebKit uses programmatic scroll because Playwright exposes no mobile wheel/swipe primitive | 2026-07-27 | IntegrationLead |
| E-010 | visual | list-first mobile picker with top manual/search input and no keyboard | `screenshots/TASK-20260727-004-mobile-catalog-picker-release/inventory-brand-picker-list-first-mobile-390-chromium.png`; `...-webkit.png` | visually inspected; no horizontal overflow or field obstruction | 2026-07-27 | IntegrationLead |

## Quality gate

- **Conclusion:** PASS for implementation and pre-release validation.
- **Data/API/permissions:** unchanged; database, migration and security review gates are not applicable.
- **Browser evidence boundary:** Chromium uses a browser-native synthesized touch gesture. Playwright mobile WebKit cannot synthesize swipe/wheel, so WebKit verifies focus, fixed surface, independent scroll ownership and layout; final iPhone physical-keyboard behavior remains a post-release Owner-device smoke.
- **Rollback:** revert the scoped release commit and redeploy the previous production commit.

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
