# Memory Delta — TASK-20260719-001-ai-inventory-live-provider

## Candidate project facts

- **Fact:** the Vision release candidate uses a direct locked `sharp@0.34.5` server dependency to fully decode, bound, orient and re-encode one metadata-free JPEG before fingerprint/reserve/provider dispatch. Source: E-004/E-006/E-008; status: verified local candidate; owner: API/SEC; scope: inventory Vision; review trigger: dependency/model/image policy change.
- **Fact:** initial OpenAI Vision output is specification-only and must contain no identifiers; local scan/manual remains authoritative for IMEI/SN/EAN. Source: provider/service contracts and E-003/E-009; status: verified; owner: Product/SEC; scope: first Chinatech pilot; review trigger: any identifier schema expansion.
- **Fact:** desktop/mobile cloud fallback still applies only selected fields to an unsaved draft and issues no inventory-create request. Source: E-009/E-010; status: verified mocked-cloud; owner: UI/QA; review trigger: intake save-flow change.
- **Fact:** the mobile stall was caused by a React effect cleanup tied to `prepared`, which aborted the current controller after the preview rendered and returned while status remained working. Source: E-022/E-024 and incident record; status: reproduced and fixed; owner: UI/QA; review trigger: Vision operation lifecycle change.
- **Fact:** final hotfix gates pass 309 files / 1978 tests, 26-page build, production audit 0, legacy E2E 6/6 and V2 E2E 3/3. Source: E-025..E-030; status: verified local candidate; owner: Integration Lead; review trigger: remote drift or release-candidate change.
- **Fact:** the production ChinaTech Vision one-shot returned the five expected synthetic specification fields, settled one OpenAI attempt for `5713` micro-USD and left usage open/bad/cross-store counts at zero. Source: E-037; status: verified production; owner: Release/Data; scope: approved ChinaTech pilot; review trigger: 30-minute or 24-hour observation anomaly.
- **Fact:** human apply changed only the browser draft; the identifier input remained blank and ChinaTech inventory count stayed at `4`. Source: E-038; status: verified production; owner: UI/QA; scope: first production smoke; review trigger: intake save-flow or response-schema change.
- **Fact:** the 30-minute production observation passed from reservation `2026-07-19T13:11:21.021029Z` through final aggregate `2026-07-19T13:42:19.925504Z`: request/attempt/audit stayed `1/1/1`, open/non-success/cross-store/runtime errors stayed `0`, inventory stayed `4`, and the formal domain remained READY. Source: E-039; status: verified production; owner: Release/Data; scope: approved ChinaTech pilot; review trigger: 24-hour review or any anomaly.

## Candidate department updates

- Architecture / frontend reliability: final PASS; option A landed without new dependency.
- QA / UX: final local candidate PASS; 390/1280 evidence and manual Next/zero-write invariants verified.
- Security / release: PASS; dormant deploy, zero-ledger preflight, exactly-once smoke and 30-minute observation conditions are satisfied; 24-hour read-only review remains.

## Candidate decisions / ADRs

- **Decision:** Owner approved ChinaTech-only Vision D4 using the existing immutable `ai-runtime-v2` `$50/month`, 20 order/day, 10 Vision/day, 300 global/day and 30 actor/minute limits, one pre-inspected synthetic no-PII smoke and formal-domain test account. Source: E-016 and runbook; status: approved/frozen; owner: Owner; review trigger: any scope, model, budget, tenant or privacy expansion.
- **Decision:** use option A for this hotfix: ref/run-id lifecycle, native-only optional local detector, abortable FileReader and 75-second watchdog. Keep dedicated ZXing scanner; do not introduce a worker/dependency in the incident fix. Source: architecture review and remediation plan; status: implemented/verified; owner: Integration Lead; review trigger: material demand for photo barcode extraction.
- **Decision:** release sequence is dormant deploy/off, zero baseline, ChinaTech-only triple-gate activation, one formal UI smoke, exact ledger/audit `+1`, 30-minute single-operator observation and 24-hour review. Any unknown or mismatch is flags-first/no-retry. Source: E-030 and runbook; status: approved release contract; owner: Release; review trigger: smoke outcome.

## Candidate lessons and capability evidence

- Root-cause tests must include delayed async work across a state-changing render; immediate mocks can hide cleanup races.
- Mutually exclusive feature-flag routes must be browser-tested in separate configurations and reported as separate matrices, not forced into one impossible environment.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
