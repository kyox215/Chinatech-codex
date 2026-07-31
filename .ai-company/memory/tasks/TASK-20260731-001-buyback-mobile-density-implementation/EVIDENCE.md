# Evidence — TASK-20260731-001-buyback-mobile-density-implementation

## Baseline

- Production code SHA: `bb88cb099fc404543995b4dcbb46b502e1eabbdb`.
- Worktree: `/private/tmp/repairdesk-buyback-mobile-density-20260731`.
- Branch: `codex/buyback-mobile-density-20260731`.
- Registry identity: `RUN-20260731-001-IMPLEMENT-001` / `WINDOW-019FAC30-BUYBACK-MOBILE-DENSITY`.
- Verified Context Packet v2 SHA-256: `dc464bc6158fdba6c666275020ddaf32e30ca20bb31422aceca8c7cad7d147e2`.

## Agent evidence

- FLOW: `buyback_density_product` — one-page definition, priority, state and acceptance.
- UX: `buyback_density_ux` — mobile density, responsive and accessibility review.
- Explorer: `buyback_density_code_map` — active path, app-only file contract and Sheet padding root cause.
- QA: `buyback_density_qa` — six-width, dual-browser and failure-state release gates.

Second-round independent review after remediation:

- FLOW: `GO`, no P0/P1; decision summary, quote-only boundary, revisions/responses and inventory isolation confirmed.
- UX: `GO`, no P0/P1; fixed footer, inline conflict/permission states, semantics, density and mobile constraints confirmed.
- QA: `PASS`, no P0/P1; independently verified typecheck, targeted lint, 2531/2531 tests, production build, final scope and the 19-test acceptance matrix.

## Implementation and verification

### Changed files

- `src/features/buyback/screens/transparent-buyback-screen.tsx`: compact list summary/cards, defensive IMEI masking, mobile/desktop detail and workspace density, progressive deductions/history/note, revision guard and safe-area footer.
- `src/app/buyback/page.tsx`: quote-only metadata; removed payment/inventory claim.
- `tests/e2e/buyback-guided-flow.spec.ts`: added 360px, dual-browser screenshots, all-primary-control touch/input-size checks, footer geometry, 409 draft retention, six-width long content, 403 history isolation, product-inventory before/after snapshot, PII and forbidden-call checks.
- `tests/e2e/business-desktop-overflow.spec.ts`: replaced stale six-step/table assertions with the active transparent-quote work surface.

### Quality matrix

| Gate | Result | Evidence |
|---|---|---|
| Formatting / diff | PASS | Prettier targeted files; `git diff --check` clean |
| TypeScript | PASS | `npm run typecheck` |
| Lint | PASS | `npm run lint` |
| Unit/integration | PASS | `npm run test`: 387 files / 2531 tests |
| Production build | PASS | Node 22.12.0, `npm run build -- --webpack`; 28 static pages generated |
| Chromium buyback flow | PASS | 19/19 on final code: loading/empty/error, six widths, roles, offline, 409, six-width long content, inventory isolation and 403 history |
| WebKit buyback flow | PASS | 19/19 on final code; same acceptance matrix as Chromium |
| Desktop overflow | PASS | Chromium 8/8 at 1024/1280/1440/1600 |

### Runtime and visual evidence

- Screenshot directory: `/private/tmp/repairdesk-buyback-mobile-density-evidence/remediated/` (36 Chromium/WebKit files).
- Mobile list: `buyback-transparent-webkit-mobile-small-list.png`.
- Mobile detail: `buyback-transparent-webkit-mobile-small-detail.png`.
- Mobile workspace: `buyback-transparent-webkit-mobile-small-workspace.png`.
- Desktop detail/workspace: `buyback-transparent-chromium-desktop-detail.png`, `buyback-transparent-chromium-desktop-workspace.png`.
- All screenshot data is synthetic; full IMEI is absent from list/detail screenshots.

### Quality conclusion

Local implementation gates are `PASS`. The first independent review blocked release for missing persistent decision context and incomplete high-risk evidence; those issues were remediated. Chromium and WebKit now each pass 19/19 on the final test code. A WebKit 44px assertion used a `43.9px` measurement tolerance solely for WebKit's `43.99997px` device-pixel rounding; the CSS target remains 44px and no product assertion was removed.

An attempted unfiltered desktop-overflow suite exposed a pre-existing unrelated `/inventory` marker failure and was stopped after 9 unrelated passes; the scoped buyback subset then passed 8/8 at all four desktop widths. This unrelated inventory result is not attributed to this app-only buyback diff.

### Remaining release steps

- Acquire and verify the project integration lease.
- Commit/push the isolated branch.
- Blue/green Vercel deployment, protected preview smoke, promote, production smoke/screenshots.
