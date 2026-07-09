# TASK-20260709-005-mobile-numeric-keyboards

## Status

verified_ready_to_commit

## Owner Goal

手机端新建工单和订单编辑中，涉及数字的字段应自动调出合适的手机数字键盘，减少切换输入法。

## Scope

- 新建工单报价金额、定金。
- 编辑工单报价金额、押金。
- 客户电话查找输入。
- IMEI / 序列号扫码字段的手动输入。
- 测试和移动端可视证据。

## Out Of Scope

- 数据库、Supabase migration、生产数据。
- 真实手机系统键盘截图；Playwright 无法捕获 OS 键盘，只验证 DOM input hints。
- 改变序列号/SN 的存储规则。

## Decisions

- 金额字段不用 `type="number"`，改为 `type="text"` + `inputMode="decimal"`，避免移动端和 locale 行为不稳定。
- 电话查找使用 `inputMode="tel"`，仍保持文本输入值，不过滤客户名或粘贴内容。
- IMEI 手动输入使用 `inputMode="numeric"`，但不做纯数字过滤，避免破坏 SN/序列号。

## Acceptance Criteria

- 手机端金额字段请求 decimal 键盘。
- 手机端电话字段请求 tel 键盘。
- 手机端 IMEI 手动字段请求 numeric 键盘。
- 金额解析兼容空值、欧元符号、逗号小数和点小数。
- lint、typecheck、全量 Vitest、build、移动端 E2E 通过。

## Files

- `src/shared/lib/mobile-input.ts`
- `src/shared/lib/mobile-input.test.ts`
- `src/components/imei-scanner-field.tsx`
- `src/components/imei-scanner-field.test.tsx`
- `src/features/orders/forms/customer-intake-lookup.tsx`
- `src/features/orders/forms/customer-phone-lookup.tsx`
- `src/features/orders/forms/edit-order-dialog.tsx`
- `src/features/orders/forms/new-order-quotation-section.tsx`
- `tests/e2e/mobile-input-keyboard.spec.ts`
- `screenshots/TASK-20260709-005-mobile-numeric-keyboards/new-order-mobile-keyboard-fields-chromium.png`
