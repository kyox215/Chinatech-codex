# Checkpoints

## 2026-07-19T08:58:00Z — incident scoped / implementation ready

- Base: isolated branch from `origin/main@7d817067`; dirty root checkout untouched.
- Observed failure: production `苹果15` returned `SAMSUNG A12`.
- Working hypothesis: lossy provider search plus generic identifier matching; exact tool args unavailable by privacy design.
- Decision: create a separate device-query field and local brand/model parser, rather than weakening all order search or relying only on prompt wording.
- Next: implement pure parser/matcher and fail-before-integration tests.

## 2026-07-19T09:15:18Z — local candidate verified / release approval pending

- Implemented a dedicated `device_search` contract, deterministic brand/model parser, device-label-only repository filter, mock parity and provider guardrails.
- Exact regression `苹果15` uses `device_search=iPhone 15`, `search=null`, and bypasses provider/quota.
- Verification passed: lint, typecheck, 8 focused files/159 tests, final full 306 files/1951 tests, Webpack production build and targeted mobile Playwright 1/1.
- Visual proof: `screenshots/TASK-20260719-003-ai-device-search-relevance/apple-15-mobile-390.png`; 390px browser showed Apple iPhone 15 only, no Samsung A12 and no horizontal overflow.
- Residual unknown: historical live provider arguments are unavailable by privacy-safe audit design; working cause remains an evidence-backed hypothesis, while the vulnerable code path is closed.
- No production change, push, deployment, database, key or configuration action has been taken.
- Next: Owner explicitly approves release; then commit this isolated candidate, push exact lineage, deploy, and repeat the exact production mobile query with rollback ready.
## 2026-07-19T09:15:58Z — 设备型号专用查询候选已完成并通过 lint、typecheck、159 个聚焦测试、1951 个最终全量测试、Webpack 生产构建及 390px Playwright；苹果15 仅返回 iPhone 15，Samsung A12 为 0。未推送或部署。

- **Phase:** implementation
- **Completed/current state:** 设备型号专用查询候选已完成并通过 lint、typecheck、159 个聚焦测试、1951 个最终全量测试、Webpack 生产构建及 390px Playwright；苹果15 仅返回 iPhone 15，Samsung A12 为 0。未推送或部署。
- **Next:** 等待 Owner 明确批准本任务上线；批准后仅提交隔离工作树候选，推送 exact lineage，部署并用生产手机端复测苹果15。
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
## 2026-07-19T09:18:35Z — 最终候选加入 Redmi 品牌保持并重新通过 lint、typecheck、306 个文件/1951 个全量测试；既有生产构建、390px 浏览器和 Playwright 证据保持通过。未推送或部署。

- **Phase:** implementation
- **Completed/current state:** 最终候选加入 Redmi 品牌保持并重新通过 lint、typecheck、306 个文件/1951 个全量测试；既有生产构建、390px 浏览器和 Playwright 证据保持通过。未推送或部署。
- **Next:** 等待 Owner 明确批准本任务上线；批准后提交隔离候选、推送 exact lineage、部署并生产复测苹果15。
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
