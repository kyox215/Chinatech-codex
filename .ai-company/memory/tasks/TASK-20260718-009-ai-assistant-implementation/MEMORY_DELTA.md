# Memory Delta — TASK-20260718-009-ai-assistant-implementation

## Candidate project facts

- Source: `docs/AI_ASSISTANT_PHASE0_GATE.md`; status: verified; owner: Architecture/Product. 手机订单页同时隐藏 AppBar 与 MobileWorkspaceDock，Phase 1 必须接入订单 Floating Header。
- Source: `src/features/inventory/screens/inventory-screen.tsx`; status: verified; owner: Product/Frontend. 库存 IntakeDialog 当前为非受控 FormData，Phase 2 应先建立受控 draft/merge。
- Source: Supabase current changelog and local migration review; status: verified; owner: Data. 新 public 表必须显式 Grants；RLS 与 Grants 是独立防线。
- Source: OpenAI data-control docs; status: verified current 2026-07-18; owner: Security. `store:false` 不等于 ZDR，默认 abuse-monitoring retention 仍需审批。

## Candidate department updates

- Architecture: Phase 1 采用现有 BFF 的 bounded planner，业务卡由服务器构建；live SDK dependency remains pending.
- Security/Data: AI audit 使用事件级 allowlist；图片必须安全解码、清元数据、重编码；production DB broad gate remains conditional.
- Product/UX: 同时只允许一个 modal 宿主；人工值冲突时默认保留人工值；RAM/额外 identifiers 在 MVP 未映射。

## Candidate decisions / ADRs

- `ADR-20260718-001`: existing Next.js BFF + provider boundary + no write tools + server-built cards; default-off fake implementation accepted, live activation pending Owner gates.

## Candidate lessons and capability evidence

- Phase 0 strict contracts/flags/audit/fake provider passed 11 targeted tests and full typecheck; source `EVIDENCE.md` E-005/E-006.
- Phase 1 staff order assistant uses one workspace provider, service-projected capabilities, exact store allowlisting, actor-scoped repositories and server-built masked cards; source E-009–E-011; status verified; owner Backend/Security/Product; review trigger before live provider.
- A cancellation button inside the Radix Sheet is implemented through native form submitter intent so trusted browser clicks reliably reach the abort path; source E-016; status verified; owner Frontend/QA; review trigger if the shared Sheet/Button event stack changes.
- The current local quota is per-process and suitable only for default-off/fake validation; durable atomic enforcement is a live hard gate; source APPROVALS/E-011; status verified limitation; owner Backend/Data/Release.
- Phase 1 passed 250 test files / 1645 tests, Webpack production build and 6/6 browser flows; source E-013–E-016; status verified; owner QA/Release.
- Phase 2 image processing performs JPEG/PNG/WebP header-dimension checks before full decode and verifies decoded dimensions afterward; source E-022; status verified; owner Security/Frontend; review trigger if accepted formats or decoder changes.
- Browser OCR must not implicitly load third-party CDN workers/assets; current Tesseract fallback is disabled and OCR safely degrades when native TextDetector is absent; source E-023; status verified; owner Security/Frontend; review trigger only after same-origin assets, CSP and network assertions exist.
- AI review interaction contract: edit focuses/selects but only actual input marks `edited`; zero confirmed fields cannot apply; async results announce/focus; dirty close confirms; source E-025; status verified; owner Product/UX; review trigger when shared review UI changes.
- Phase 2 has no inventory/order/draft/image business persistence before ordinary save; aggregate allowlisted audit metadata is intentionally persisted and must not be mislabeled as “zero DB writes”; source E-024/E-026; status verified; owner Security/Docs.
- Phase 2 passed 257 test files / 1690 tests, Webpack build and a final combined 10/10 browser run after honestly recording and fixing first-run E2E stability assertions; source E-027–E-030; status verified; owner QA/Release.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
