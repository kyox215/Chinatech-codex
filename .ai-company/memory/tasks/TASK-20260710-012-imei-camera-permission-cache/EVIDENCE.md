# Evidence

## Findings

- `ImeiScannerField` opened the scanner by running `decodeFromConstraints` with a fallback plan on every scanner open.
- Changing `activeCameraMode` after fallback could rebuild scanner callbacks if not held carefully, causing avoidable restarts.
- The browser/OS camera-use banner shown in the Owner screenshot is controlled by the user agent and cannot be suppressed by page code.

## Validation

| Check | Result |
|---|---|
| `npm run test -- src/components/imei-scanner-field.test.tsx` | PASS, 1 file / 23 tests |
| `npx eslint src/components/imei-scanner-field.tsx src/components/imei-scanner-field.test.tsx` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS after sandbox port escalation |

## Notes

- `npm install` in the clean worktree reported existing engine/audit warnings from the dependency graph; no dependency changes were committed.
- No screenshot was added because this change is permission/startup behavior. Browser camera indicators are outside app-rendered DOM and cannot be reliably captured or hidden by the app.
