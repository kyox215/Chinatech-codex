# Checkpoints

## 2026-07-24 — intake and implementation start

- Phase: implementing.
- Owner approved fixed per-order QR, anonymous public status, authenticated authorized internal detail, and all-order-state printing.
- Production push and deployment are explicitly requested.
- Three read-only specialist reviews started; main thread remains the single writer.
- Dirty worktree recorded and must be integrated without reverting prior task changes.

## 2026-07-24 09:51 CEST — implementation and database release verified

- Stable v2 identity/token, legacy resolver, automatic identity routing and QR-required print lifecycle implemented.
- Independent QA P1 findings were fixed and re-reviewed; no open code-level P0/P1.
- Production HMAC configuration added without disclosing secret material.
- Migration 20260724071717 applied to linked production and verified at 6390/6390 identities, zero gaps and zero cross-store rows.
- Lint/typecheck/full test/build and Chromium/WebKit E2E passed; visual/PDF evidence generated.
- Remaining action: form exact integrated release candidate from the already verified multi-task worktree, commit/push main, deploy and run production smoke.
## 2026-07-24T07:53:15Z — 固定订单二维码实现、生产配置、迁移回填与跨浏览器验收完成；无开放代码级 P0/P1。

- **Phase:** releasing
- **Completed/current state:** 固定订单二维码实现、生产配置、迁移回填与跨浏览器验收完成；无开放代码级 P0/P1。
- **Next:** 形成精确集成候选，提交推送 main，部署 Vercel Production 并做生产冒烟。
- **Decision:** 每单一个稳定 v2 HMAC QR；匿名公开、授权员工自动内部详情；所有存在订单状态可打印且缺 QR 不打印。
- **Evidence:**
  - 生产 identity 6390/6390、missing 0、cross-store 0；lint/typecheck/full test/build；Chromium/WebKit E2E 5/5。
- **Recorded by:** IntegrationLead

## 2026-07-24 10:09 CEST — production release complete

- Phase: closed.
- Exact release candidate passed lint, typecheck, 350/350 test files with 2331/2331 tests, and production build.
- Commit `469803b78a7134b530b64433c2140de94715cb43` was pushed to `main`.
- Vercel deployment `dpl_5LyV5fUQZC5W3H1GgZbTj9rS7LcK` is READY and aliased to both production domains.
- Production smoke confirmed public entry availability, generic invalid-link behavior and the unauthenticated issue boundary.
- Remaining Owner acceptance is physical phone scanning and paper output on the shop printer; this is not a software release blocker.
## 2026-07-24T08:10:00Z — 固定订单二维码已推送 main 并完成 Vercel Production 部署；生产迁移、权限分流、全状态二维码打印与冒烟验证均完成。

- **Phase:** closed
- **Completed/current state:** 固定订单二维码已推送 main 并完成 Vercel Production 部署；生产迁移、权限分流、全状态二维码打印与冒烟验证均完成。
- **Next:** Owner 在门店使用真实手机扫描一张新旧工单票据，并用实际打印机确认纸张二维码可识别；如有设备特定问题按部署 ID 排查。
- **Decision:** 每单一个稳定 v2 HMAC QR；匿名公开进度，已登录且有权限自动内部详情；所有存在订单状态可打印且缺 QR 不调用打印。
- **Evidence:**
  - main 469803b78a7134b530b64433c2140de94715cb43；deployment dpl_5LyV5fUQZC5W3H1GgZbTj9rS7LcK READY；350/350 test files、2331/2331 tests、build PASS；生产 /r 200、invalid token 404、anonymous issue 401。
- **Recorded by:** IntegrationLead
