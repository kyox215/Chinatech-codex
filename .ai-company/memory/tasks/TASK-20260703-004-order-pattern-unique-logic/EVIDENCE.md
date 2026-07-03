# Evidence

## Validation Results

- PASS: `npx eslint src/features/orders/components/device-unlock-fields.tsx src/features/orders/screens/order-detail-screen.tsx src/features/orders/model/device-unlock.ts src/features/orders/model/device-unlock.test.ts src/server/api/repairdesk-schemas.ts src/server/api/repairdesk-schemas.test.ts src/features/orders/testing/mock-api.test.ts`.
- PASS: `npm run test -- src/features/orders/model/device-unlock.test.ts src/server/api/repairdesk-schemas.test.ts src/features/orders/testing/mock-api.test.ts` (3 files, 48 tests).
- PASS: `npm run lint`.
- PASS: `npm run typecheck`.
- PASS: `npm run test -- src/features/orders src/server/api/repairdesk-schemas.test.ts` (18 files, 100 tests).
- PASS: `npm run build` with approved local process permissions.
- PASS: `git diff --check`.

## Browser Evidence

Page:
- `http://127.0.0.1:3012/orders/ord_1`

Mobile viewport:
- 393 x 852

Duplicate-point verification:
- Sequence clicked: `1, 2, 3, 1`.
- Point text after duplicate tap: `1`, `2`, `3`; point 1 did not become step 4.
- Pattern text included: `起点 1 · 终点 3 · 已连接 3 / 9 点。`
- Pattern text included: `点 1 已在第 1 步，不会重复添加；要改顺序请点清除后重画。`
- Save disabled: true.
- Validation text: `图案密码需要连接 4-9 个点`.

Valid-pattern verification:
- Sequence clicked: `1, 2, 3, 4`.
- Pattern text included: `起点 1 · 终点 4 · 已连接 4 / 9 点。`
- Save disabled: false.
- Validation text: empty.

Screenshots:
- `screenshots/TASK-20260703-004-order-pattern-unique-logic/order-pattern-duplicate-ignored-393.png`
- `screenshots/TASK-20260703-004-order-pattern-unique-logic/order-pattern-valid-4-points-393.png`

## Diff Evidence

Scoped implementation files:
- `src/features/orders/components/device-unlock-fields.tsx`
- `src/features/orders/model/device-unlock.ts`
- `src/features/orders/model/device-unlock.test.ts`
- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/orders/testing/mock-api.test.ts`
- `src/server/api/repairdesk-schemas.ts`
- `src/server/api/repairdesk-schemas.test.ts`

The repository remains broadly dirty from pre-existing unrelated work. This task did not stage, commit, push, deploy, apply migrations, or revert unrelated changes.
