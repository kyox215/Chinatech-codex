---
schema_version: 1
task_id: "TASK-20260727-001-mobile-catalog-popover-scroll"
title: "修复手机端库存目录弹层滚动跳动"
status: "in_progress"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["UX", "FE", "QA", "INT"]
created_at: "2026-07-26T22:36:18Z"
updated_at: "2026-07-26T22:57:24Z"
---
# Task — 修复手机端库存目录弹层滚动跳动

## Owner request

修复手机端库存入库的品牌/型号搜索列表在键盘打开和手指滚动时乱跳的问题。

## Business value

确保店员在手机上能稳定浏览和搜索手机目录，避免误选、重复操作或无法完成入库。

## Scope in

- 手机端品牌与型号目录选择器的弹层容器、键盘交互和列表滚动。
- 保持现有目录搜索、手动录入、选择回调和桌面端交互不变。
- 增加手机触控滚动回归测试和最终截图证据。

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- 不修改手机目录数据、库存业务规则、数据库或 API。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 手机端选择器使用不依赖触发器坐标的固定容器，键盘/视口变化时不再上下翻转或重算锚点。
- [x] 搜索输入可用；列表能在弹层内独立触控滚动，不带动后方页面。
- [x] 弹层有清晰标题、关闭操作、键盘和屏幕阅读语义；选择结果与现有逻辑一致。
- [x] 桌面端仍使用现有 Popover，不发生布局回归。
- [x] 相关单元测试、手机 E2E、lint、typecheck 通过，并有手机截图证据。

## Facts, assumptions, and unknowns

| Item                                   | Type     | Evidence                                            | Status / next action         |
| -------------------------------------- | -------- | --------------------------------------------------- | ---------------------------- |
| 手机弹层是 Radix Popover 锚定定位      | observed | `inventory-phone-catalog-fields.tsx`, `popover.tsx` | 键盘/视口变化会触发重定位    |
| 列表是 cmdk 内部滚动容器               | observed | `command.tsx`                                       | 需阻断滚动传递和弹层拖动竞争 |
| 现有 Vaul Drawer 支持 `fixed` 键盘模式 | observed | installed `vaul` types, `drawer.tsx`                | 手机端可复用                 |

## Decision and approval points

- T1 / R1 / L2：局部、可逆的 UI 稳定性修复，无数据/API/权限变更。
- 本次未 spawn 子代理：问题集中在单一组件，顺序调试与单一写入者更高效；UX/FE/QA 由主线程执行。

## Work packages

- WP1：将手机选择器改为固定底部面板，桌面端保持 Popover。
- WP2：补充组件语义测试和手机触控滚动 E2E。
- WP3：运行局部与项目门禁，生成截图，同步记忆。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
