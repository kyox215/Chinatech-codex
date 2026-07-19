# Checkpoints — TASK-20260719-008

## 2026-07-19T21:00:00Z — baseline and approval

- Owner 批准按既有计划实施、推送 `main` 并应用；Vision D4 冻结为 Chinatech-only、共享 `$50/月`、图片 `10/日`、只外发人工确认规格裁剪。
- 根 checkout 含大量无关变化，排除写入/暂存/提交；隔离 worktree 基线 `origin/main@b8a1b6ba9d92a9cb2c8df6d417271a68cde909ba`。
- 现有 Inventory V2 已有 `imei1/imei2`、唯一性和校验约束；任务无需新 migration。

## 2026-07-19T21:50:00Z — implementation and focused verification

- 添加 iPhone 可用的 ZXing module Worker 和同源 Tesseract Worker；OCR 资产由锁定 npm 包在 predev/prebuild/prepreview 复制，不提交生成文件。
- 完整标签只走本地 re-encode、Detector/Worker 和结构化候选；原始 OCR/条码不返回、不记录。
- 本地不足时必须生成独立规格裁剪预览并明确确认无 IMEI/SN/EAN/PII 后才可调用 Vision；离线不排队。
- IMEI 候选默认遮罩并经 Luhn 校验；同图 EAN 先返回时仍把 IMEI 排为默认主标识。
- AI 候选合并不覆盖已有手工字段/标识；Step 3 继续提供专用扫描与手工输入。
- 聚焦 Vitest 6 files / 35 tests PASS；typecheck PASS。
- Inventory V2 Playwright 6/6 PASS：真实 Worker、同源资产、390/1280 本地流程、390/1280 裁剪云端流程、pending 可下一步；所有用例库存写入为零。
- 视觉证据保存在 Codex visualization 目录，已目检手机与电脑布局；无真实客户数据。
- 下一步：全量门禁与发布前 memory checkpoint。

## 2026-07-19T21:54:10Z — final source review and pre-release memory checkpoint

- Final source after review adds a privacy race defense: starting a replacement crop immediately revokes/disposes the previous preview and confirmation; crop controls and send are disabled while crop/cloud work is active. New unit coverage proves an old confirmed preview cannot be sent during replacement generation.
- Full final gates after that source correction: agents check PASS; lint PASS; typecheck PASS; Vitest 313 files / 2044 tests PASS; production build PASS and generated 26 pages.
- Inventory V2 Playwright rerun on final source: 6/6 PASS, including real iPhone-compatible Workers with same-origin Tesseract assets, 390/1280 local one-photo flow, 390/1280 reviewed-crop flow, and pending-cloud manual next. Every case records zero inventory create calls.
- Production dependency audit reports `found 0 vulnerabilities`; direct licenses are MIT/Apache-2.0. Locked English language source and built copy share SHA-256 `45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91`.
- Architecture review PASS: client-only model helpers, bounded Workers, thin screen integration, no server imports in client, no shared data contract/schema change, explicit rollback flag.
- Security review PASS: existing magic-byte/animation/dimension/decode checks and metadata-free re-encode remain; complete label never enters data-URL/BFF path; only a distinct reviewed crop can be serialized; raw OCR/barcodes are not returned/logged; secret scan and `git diff --check` pass.
- UX review PASS: optional progressive flow, masked identifiers, explicit primary choice, non-overwrite merge, always-available next/manual path, 390/1280 no overflow. Human crop review remains an intentional D4 boundary, not an automated PII guarantee.
- Database review PASS for candidate scope: `git diff --name-only -- supabase` is empty. No migration may be invented or replayed; linked history and dry-run remain mandatory release gates.
- Release review GO for an exact scoped commit, fresh fetch, non-force push and exact Vercel deployment. Stop on main movement with overlap, pending/unknown migration, non-READY deployment, unexpected Vision request, identifier network egress or inventory write.
- Build note: the first sandboxed build could not fetch the repository's existing Google Fonts; an approved network-enabled retry on the same final source compiled, typechecked and generated all pages.
- This is the required `memory-checkpoint` before Git/Vercel/Supabase external writes. Root dirty checkout and unrelated task memory remain untouched.
