# Checkpoints

## 2026-07-03T07:17:58Z — Payment summary clarity implemented

- **Phase:** verification
- **Completed/current state:** Mobile order detail payment summary now shows three rows: `总金额`, `已付押金`, and `待收尾款`. The previous `已付金额` row and the paid-status badge beside the balance were removed to avoid confusing the balance as already paid.
- **Evidence:** `src/features/orders/screens/order-detail-screen.tsx`; `./node_modules/.bin/eslint src/features/orders/screens/order-detail-screen.tsx` passed; `./node_modules/.bin/tsc --noEmit` passed; `git diff --check -- src/features/orders/screens/order-detail-screen.tsx` passed.
- **Visual evidence:** Updated screenshot could not be captured by the agent. The local page requires authenticated preview state; unauthenticated shell/browser access redirects to login, and Computer Use is not allowed to read the Codex app preview.
- **Next:** Owner can review `http://localhost:3012/orders/ord_31` in the existing authenticated preview. If shipping, stage only this payment-summary hunk plus this task memory.
- **Recorded by:** CEO-Orchestrator

## 2026-07-03T07:18:50Z — Mobile order detail payment summary now shows only three rows: total amount, paid deposit, and outstanding balance. Removed the separate paid amount row and removed the paid-deposit status badge beside the balance to avoid misreading the balance as already paid.

- **Phase:** verification
- **Completed/current state:** Mobile order detail payment summary now shows only three rows: total amount, paid deposit, and outstanding balance. Removed the separate paid amount row and removed the paid-deposit status badge beside the balance to avoid misreading the balance as already paid.
- **Next:** Owner can review http://localhost:3012/orders/ord_31 in the existing authenticated preview. If shipping, stage only the payment-summary hunk plus TASK-20260703-006 memory files; keep unrelated signal/workflow-grid WIP unstaged.
- **Evidence:**
  - Changed src/features/orders/screens/order-detail-screen.tsx. Focused ESLint passed. Full TypeScript check passed. git diff --check for the file passed. Local dev server log showed GET /orders/ord_31 200, but updated screenshot capture was blocked because unauthenticated access redirects to login and Computer Use cannot read the Codex preview.
- **Recorded by:** CEO-Orchestrator
## 2026-07-03T18:53:47Z — Pre-push checkpoint: payment summary clarity change is implemented and validated. The mobile payment card now uses total amount, paid deposit, and outstanding balance rows only; unrelated signal/workflow-grid hunks in order-detail-screen remain out of scope.

- **Phase:** ready_to_push
- **Completed/current state:** Pre-push checkpoint: payment summary clarity change is implemented and validated. The mobile payment card now uses total amount, paid deposit, and outstanding balance rows only; unrelated signal/workflow-grid hunks in order-detail-screen remain out of scope.
- **Next:** Stage scoped hunk and memory files, verify staged diff excludes signal/workflow-grid WIP, commit, and push origin/main.
- **Evidence:**
  - Validation already passed this turn: focused ESLint for order-detail-screen, full TypeScript check, and git diff --check for the target file. Final staging must include only the payment-summary hunk plus TASK-20260703-006 memory files and ACTIVE_CONTEXT.
- **Recorded by:** CEO-Orchestrator
