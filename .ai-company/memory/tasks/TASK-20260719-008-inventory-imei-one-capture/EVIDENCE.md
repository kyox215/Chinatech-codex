# Evidence Index — TASK-20260719-008

| ID    | Type           | Claim                                                 | Evidence                                                               | Result                                     |
| ----- | -------------- | ----------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| E-001 | owner          | 实施、推送 main、应用授权                             | 当前 Owner 指令与 Vision D4                                            | approved                                   |
| E-002 | git            | 隔离干净基线                                          | `origin/main@b8a1b6ba`; isolated worktree                              | root dirty state excluded                  |
| E-003 | architecture   | 完整标签与云端规格裁剪分流                            | image helper + V2 Vision card                                          | implemented                                |
| E-004 | privacy        | 同源 OCR 资产，无默认 CDN                             | local OCR helper + fixed asset script                                  | implemented                                |
| E-005 | compatibility  | iPhone 无 BarcodeDetector/TextDetector 时 Worker 回退 | real synthetic-label Playwright                                        | PASS                                       |
| E-006 | identifiers    | IMEI Luhn/slot/冲突/EAN 合并                          | recognition unit tests                                                 | PASS                                       |
| E-007 | draft safety   | 不覆盖手工字段/主标识                                 | merge helper unit tests                                                | PASS                                       |
| E-008 | focused tests  | 核心模型与组件回归                                    | Vitest 6 files / 35 tests                                              | PASS                                       |
| E-009 | responsive E2E | 本地、裁剪、pending 流程                              | Playwright Inventory V2 6/6                                            | PASS; zero inventory writes                |
| E-010 | visual         | 手机本地候选                                          | `inventory-imei-one-capture/vision-v2-390-local-spec-imei-review.png`  | inspected; no overflow                     |
| E-011 | visual         | 电脑本地候选                                          | `inventory-imei-one-capture/vision-v2-1280-local-spec-imei-review.png` | inspected; no overflow                     |
| E-012 | visual         | 手机裁剪合并                                          | `inventory-imei-one-capture/vision-v2-390-cloud-ready.png`             | inspected; no PII                          |
| E-013 | quality        | final lint/type/test/build                            | agents/lint/type PASS; 313 files / 2044 tests; build 26 pages          | PASS                                       |
| E-014 | database       | linked migration list/dry-run/push                    | Supabase `xluzcoduqsdvjoouqhkc`; 91/91; dry-run + push                 | up to date; verified zero-write no-op      |
| E-015 | release        | main/deployment/exact SHA                             | `main@facb79b9`; `dpl_3HZsEL9XraLy1McLeaTxHCwsxpKs`                    | READY; production aliases active           |
| E-016 | production     | authenticated mobile/desktop tenant gate              | `production-xutech-tenant-gate-390.png`; `...-1280.png`                | PASS for isolation; Chinatech smoke open   |
| E-017 | dependency     | production audit and asset provenance                 | `npm audit --omit=dev`; package licenses; SHA-256                      | 0 vulnerabilities; PASS                    |
| E-018 | review         | ARCH/SEC/UX/QA/DATA/OPS main-thread review            | `REVIEWS.md`; final checkpoint                                         | GO; no spawned agents claimed              |
| E-019 | assets         | production same-origin OCR runtime                    | five `/vendor/tesseract/v7.0.0/*` paths; English SHA-256               | HTTP 200; locked hash exact                |
| E-020 | runtime        | production errors near release                        | Vercel deployment log scan                                             | fatal/error/warning/5xx all zero           |
| E-021 | no-write       | release-window AI and inventory deltas                | Supabase read-only counts since `2026-07-19T21:59:00Z`                 | Vision reservations 0; intake writes 0     |
| E-022 | visual         | production non-allowlisted store behavior             | 390/1280 authorized `xutech` session                                   | legacy entry shown; no V2 cross-store leak |
