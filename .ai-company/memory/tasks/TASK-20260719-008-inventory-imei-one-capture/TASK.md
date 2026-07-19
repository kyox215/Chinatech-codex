---
schema_version: 1
task_id: "TASK-20260719-008-inventory-imei-one-capture"
title: "Inventory V2 单张包装标签本地识别 IMEI"
status: "conditional"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
departments: ["INT", "ARCH", "FE", "UX", "SEC", "QA", "OPS", "DATA"]
created_at: "2026-07-19T21:00:00Z"
updated_at: "2026-07-19T22:14:30Z"
---

# Task — Inventory V2 单张标签识别 IMEI

## Owner request

> 这边的识别还要带上 imei 识别，这样直接一次性解决。开始执行计划，完成后推送并应用。

## Objective

员工在 Inventory V2 第 2 步拍一张完整包装标签，本机一次性生成规格、IMEI、SN 与 EAN 候选；IMEI 默认遮罩、校验、人工确认并优先作为手机主标识。完整标签和设备标识不得发送 OpenAI，识别结果不得自动写入库存。

## Scope in

- 原生 Detector 快路径与 iPhone 可用的同源 ZXing/Tesseract Worker 回退。
- 固定版本、锁文件来源、同源提供的 OCR Worker/core/language 资产。
- 本地 IMEI1/IMEI2、SN、EAN 解析、Luhn/GTIN 校验、冲突与主标识选择。
- 仅本地规格不足时，由员工调整、预览并确认的独立规格裁剪才可进入既有 Vision BFF。
- Inventory V2 草稿合并不覆盖手工内容，专用扫描/手工兜底继续可用。
- 手机/电脑专项 E2E、全仓质量门、生产发布与只读数据库闸门。

## Scope out

- Supabase schema、migration、RLS、grant、预算、模型、provider、门店 allowlist 和每日额度变化。
- 自动保存库存、后台排队上传、客户公开 AI、第二门店或真实客户/设备图片测试。
- 删除旧库存数据或回放已应用 migration。

## Acceptance criteria

- [x] 真实 Worker 使用同源固定资产读取无 PII 合成标签，且没有外部 OCR CDN 请求。
- [x] 同一张照片的规格与校验通过的 IMEI 同时成为人工候选；IMEI 优先于 EAN 作为默认主标识。
- [x] 完整照片、原始 OCR 与完整条码不进入 Vision 请求、日志或持久化；只有显式确认的独立规格裁剪可发送。
- [x] 无效 IMEI 阻止应用；有效标识默认遮罩，可查看、取消、选主标识。
- [x] 草稿合并不覆盖已有手工字段或已有手工主标识；正式库存写入保持为零直到最终复核保存。
- [x] 离线、超时、取消和云端 pending 都能直接进入手工下一步，不排队上传。
- [x] 390x844 与 1280x800 无横向溢出，流程与现有 RepairOS 风格一致。
- [x] lint、typecheck、全量 test、build、diff、安全和依赖检查全部通过。
- [x] fresh fetch 后非强制推送 exact reviewed SHA 到 `main`，Vercel 正式部署 READY。
- [x] Supabase migration history/dry-run 证明无待应用 SQL；本次数据库应用为安全 no-op。
- [ ] 正式域名 Chinatech 登录态手机与电脑端无 PII smoke。当前获授权测试账号只属于 `xutech`，已证明非 Chinatech 门店不会进入 V2，但不得冒充 Chinatech 验收；发布后 Vision reservation 与库存写入均为零。

## Frozen production boundary

- 仅 Chinatech；继续复用 `ai-runtime-v2` 的 `$50/月` 共享硬预算与库存图片 `10 次/日`。
- 完整标签仅本地处理；外发仍只允许员工确认的规格裁剪。
- 使用既有 OpenAI Key 和既有 Vision BFF；不创建、复制或展示 secret。
- 数据库没有设计变化；若 linked migration 不是精确对齐，停止发布而不是修复历史。

## Multi-agent record

No spawn。Owner 本次没有明确要求子代理/多代理；当前运行规则禁止在未明确要求时启动子代理，并且 Git、Vercel 与 Supabase 发布必须由单一 Integration Lead 串行控制。ARCH/SEC/UX/QA/DATA/OPS 复核由主线程按各 Skill 清单执行；不得把这些部门标签描述为已派出的 AI 员工。

## Rollback

- 本地 Worker 局部问题：设置 `NEXT_PUBLIC_INVENTORY_LOCAL_IMEI_RECOGNITION=0` 并重新部署，保留手工扫描与录入。
- 怀疑完整标签外发：立即关闭 Vision intake/draft/external-data 三项开关并重新部署，保留账本与证据调查。
- Web 回滚：在最新 `main` 上前向 revert 精确提交并重新验证；不执行数据库 down。

## Current state

任务以有条件发布状态关闭。业务源码提交 `facb79b984de5ffdc596210cd9ba33883343053e` 已经 fresh fetch 后非强制推送到 `main`，Vercel 正式部署 `dpl_3HZsEL9XraLy1McLeaTxHCwsxpKs` 为 `READY` 并服务 `www.chinatech.in` / `chinatech.in`。Supabase 项目 `xluzcoduqsdvjoouqhkc` 的本地/远端 migration 91/91 对齐，dry-run 与正式 `db push` 都返回 `Remote database is up to date`，因此本次数据库应用是零写入 no-op。生产 OCR 五项同源资产均 HTTP 200，英语模型哈希与锁定来源一致；发布后 Vision reservation 和库存 intake 写入都是零，生产日志 fatal/error/warning/5xx 均为零。

唯一未闭环项是正式 Chinatech 登录态功能 smoke：当前获授权测试会话只属于 `xutech`，页面正确回退旧入库入口并证明 Chinatech-only 隔离，但不能据此声称 Chinatech V2 已登录验收。后续仅需让该测试账号获得 Chinatech membership，或使用已授权的 Chinatech 员工账号，再以一张无 PII 合成标签执行本地-only 手机/电脑 smoke；不得扩大 allowlist、不得发送完整标签、不得写库存。该证据缺口不影响代码部署和数据库 no-op 结论，但阻止“完整生产 UI 验收通过”的表述。
