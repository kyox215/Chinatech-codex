---
schema_version: 1
task_id: "TASK-20260724-008-mobile-print-performance"
title: "移动端稳定打印与两秒固定PDF性能优化"
status: "active"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["FLOW", "ARCH", "FE", "API", "UX", "QA", "DOC", "INT"]
created_at: "2026-07-24T14:06:01Z"
updated_at: "2026-07-24T14:42:41Z"
---
# Task — 移动端稳定打印与两秒固定PDF性能优化

## Owner request

执行方案 B：修复手机端无法启动打印预览；固定尺寸 PDF 尽量控制在 2 秒以内；打印质量不得通过降低像素密度换取速度。

## Business value

让门店人员在桌面和手机端都能可靠打印订单，减少等待与失败重试，同时保持 A5/A4 四种纸张模式、固定二维码、现有内容和版式质量。

## Scope in

- 对固定尺寸 PDF 流程增加分阶段耗时测量与可验证的两秒目标。
- 消除手机端对隐藏 Blob PDF iframe `contentWindow.print()` 的强依赖。
- 保留 A5 横向、A4 横向铺满、A4 上半裁切、A4 双联。
- 保留每张订单固定二维码、当前打印内容、店铺身份与权限边界。
- 采用缓存/预准备与明确的移动端原生打印或分享后备流程。
- 更新打印声明、测试和任务证据。

## Scope out

- 不改变订单业务状态机、付款、客户公开查询权限或二维码安全模型。
- 不新增付费外部服务，不执行数据库迁移，不修改生产数据。
- 本轮不自动推送或部署；生产发布需要老板另行明确批准。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- 打印质量不得低于当前 3× 栅格基线；采用矢量输出时小字和二维码清晰度必须等于或优于当前基线。
- iOS 原生系统限制不能用虚假成功提示掩盖；失败必须有可操作的下载/分享/重试路径。
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 手机端不再因隐藏 PDF iframe 缺少 `contentWindow` 而显示“浏览器无法启动打印预览”。
- [x] 移动路径通过独立第二次用户点击打开系统可处理的 PDF/分享打印入口；桌面自动打印路径保持兼容。
- [x] 固定 PDF 生成包含 QR、布局、PDF 与端到端分阶段计时；暖缓存单次/连续自动化目标 <= 2 秒。
- [x] A5/A4 四模式页尺寸、单页、二维码、金额、客户/设备/服务内容保持不变。
- [x] 保留 `PRINT_CAPTURE_SCALE=3` 和约 288 有效 PPI 的最终 A5 栅格质量。
- [ ] 真实 iPhone/iPad AirPrint 烟测和最终 PDF 二维码自动解码仍待老板设备验证。
- [x] lint、typecheck、相关 unit、E2E、full test、production build 通过。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 当前固定 PDF 以 3× html2canvas 栅格生成 | observed | `src/features/orders/print/fixed-order-pdf.ts` | preserve quality floor |
| 当前移动打印使用隐藏 Blob iframe 并调用 `contentWindow.print()` | observed | same file lines 108-170 | replace mobile dependency |
| 当前移动 E2E mock 了 iframe `print()` | observed | `tests/e2e/print-safari-reliability.spec.ts` | add real fallback contract tests |
| iOS 原生打印窗口是否可完全自动唤起 | platform constraint | WebKit user activation / Apple PDF handling | provide explicit user-gesture fallback |

## Decision and approval points

- 老板已批准方案 B 的本地实施。
- 推送 main、生产部署或新增生产基础设施仍需另行明确批准。

## Work packages

1. ARCH/FLOW：确认客户端缓存、移动端原生入口与兼容后备的最小架构。
2. FE/API：实现分阶段计时、PDF 复用缓存和手机显式打印/分享路径。
3. QA：覆盖四纸型、桌面、移动 WebKit、错误恢复、性能预算和清晰度。
4. DOC/INT：同步打印声明、证据、回滚与发布边界。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
