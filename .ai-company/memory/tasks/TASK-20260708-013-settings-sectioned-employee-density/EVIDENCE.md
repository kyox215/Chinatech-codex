# Evidence — TASK-20260708-013-settings-sectioned-employee-density

## Startup

- 2026-07-08T20:34:30Z: Goal created in Codex thread.
- Read project startup and multi-agent rules.
- Worktree was already heavily dirty before this task; task changes must stay scoped.

## Subagents

- `019f436f-e057-7360-93db-5d633c32b87e` / Trace / project_explorer / read_only.
- `019f4370-0651-7e93-a72d-cae0e711d4a4` / Lumen / ux_reviewer / read_only.
- `019f4370-23e2-7581-b317-dfbb9692d6a5` / Verity / qa_reviewer / read_only.
- `019f4388-73d2-7422-8d46-b9ab61bdf909` / Pixel / ux_reviewer / read_only / workflow compactness follow-up.
- `019f4388-9c89-7d80-876d-42974776f971` / Gauge / qa_reviewer / read_only / workflow validation follow-up.

The first three completed and were closed by the Integration Lead. Follow-up agents completed and reported that `/settings?section=workflow` requires direct viewport validation because existing E2E checks only cover default `/settings`.

## Code Evidence

- `src/features/settings/screens/settings-screen.tsx` contains `SettingsScreen`, settings queries, mutations, and `StoreMembersSection`.
- `src/lib/ui-patterns.ts` contains `repairOs`, `controls`, `dataDisplay`, and density layout contracts.
- `src/app/settings/page.tsx` now wraps `SettingsScreen` in `Suspense` for `useSearchParams`.
- `src/features/settings/screens/settings-screen.tsx` now has URL-backed settings sections and a `SettingsSectionNav`.
- `StoreMembersSection` now has compact metrics, search/filter controls, desktop table, and mobile card list.
- Workflow settings compactness pass removed duplicated mobile/header KPI chips from the workflow path, hides global draft save actions on non-draft sections, keeps status cards compact on mobile, and uses a desktop two-column workbench: status rows on the left and transition rules on the right.
- `WorkflowTransitionsPanel` now uses compact right-column layout on desktop and adds distinct accessible names for transition checkbox and primary-target buttons.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test -- src/features/settings/model/store-settings-readiness.test.ts src/features/stores/api/query-keys.test.ts src/features/stores/api/tenant-cache.test.ts src/features/stores/server/store.repository.test.ts src/server/api/repairdesk-router.test.ts src/server/api/repairdesk-schemas.test.ts`: passed, 6 files / 58 tests.
- `npm run test`: passed, 87 files / 580 tests.
- `npm run build`: first sandbox run failed with Turbopack port-binding permission error; escalated rerun passed.
- 2026-07-08T21:07Z follow-up validation: `npm run typecheck` passed.
- 2026-07-08T21:09Z follow-up validation: `npm run lint` passed.
- 2026-07-08T21:09Z follow-up validation: `npm run test -- src/features/settings/model/store-settings-readiness.test.ts src/features/stores/api/query-keys.test.ts src/features/stores/api/tenant-cache.test.ts src/server/api/repairdesk-router.test.ts` passed, 4 files / 14 tests.
- 2026-07-08T21:10Z follow-up validation: `git diff --check -- src/features/settings/screens/settings-screen.tsx src/app/settings/page.tsx` passed.
- 2026-07-08T21:10Z follow-up validation: `npm run build` failed in sandbox with the known Turbopack internal port-binding permission error, then escalated `npm run build` passed.

## Visual Evidence

- Local server: `http://localhost:3016`.
- Desktop verified with Computer Use at `/settings?section=members&v=20260708`: section nav visible; employee group selected; employee metrics, search/filter, invite tools, and dense member table rendered.
- Desktop verified with Computer Use at `/settings?section=store&v=20260708-store`: store group selected; only store management and store profile sections rendered.
- Mobile/narrow verified with Computer Use at `/settings?section=members&v=20260708-mobile`: section nav is horizontally compact; employee metrics, filters, and mobile member cards rendered without visible overlap.
- Mobile/narrow verified with Computer Use at `/settings?section=workflow&v=20260708-workflow`: workflow group selected and mobile status cards rendered.
- File screenshot saving blocked by macOS permissions: `screencapture -x` returned `could not create image from display`; window-specific capture returned `could not create image from window`.
- Chrome JavaScript layout metric via AppleScript was blocked because Chrome has "Allow JavaScript from Apple Events" disabled.
- Follow-up found `http://localhost:3016` was running from `/private/tmp/repairdesk-xutech-onboarding`, not this repository. Current-repo preview was started at `http://localhost:3017`.
- Current-repo mobile visual check with Computer Use at `http://localhost:3017/settings?section=workflow&v=20260708-current-mobile-final`: workflow section only, no duplicated header KPI strip, no inactive save action, compact section nav, two-column status cards, transition panel collapsed.
- Current-repo desktop visual check with Computer Use at `http://localhost:3017/settings?section=workflow&v=20260708-current-desktop-final`: duplicated top KPI strip removed; section nav remains one row; workflow content uses left status rows and right transition rules in the same first viewport.
- Playwright unauthenticated screenshots were attempted, but they captured the login page rather than the logged-in settings UI and are not acceptance evidence.
- System screenshot saving for logged-in Chrome still blocked by macOS: `screencapture -x screenshots/TASK-20260708-013-settings-sectioned-employee-density/workflow-desktop-1440-logged-in.png` returned `could not create image from display`.

## Notes

- Worktree was already heavily dirty. `src/features/settings/screens/settings-screen.tsx` contained prior employee/access-request and tenant-cache edits before this task; this task preserved and built on them.
- The workflow page intentionally uses compact mobile two-column cards because the owner explicitly prioritized high-density one-page visibility; this is recorded as a task-specific density decision.
