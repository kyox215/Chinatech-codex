# ADR-20260801: Balanced Dense Spacing Rhythm

- Status: Accepted
- Date: 2026-08-01
- Owners: Product, UX, Frontend, QA

## Context

RepairDesk 的移动页面曾把“所有控件至少 44×44px”和间距压缩混为一谈，导致部分列表首屏信息不足，也让 Header、筛选和卡片之间缺少稳定层级。不同模块还存在 12px 到 24px 的断点突跳、重复搜索/返回入口及 Sheet 双重滚动。

## Decision

采用分级高密度体系：关系间距统一为 inline 4px、control cluster 6px、content row 8px、group 12px、mobile module 16px、desktop module 24px、dense stack 6–8px。控件尺寸由独立 density contract 管理：微型辅助动作 24px、dense 32px、standard 36px、输入 38px、主/危险动作 40px；不再要求所有移动控件一律 44px。

Header/Filter/Tab 不使用横向滚动或装饰性 stepper。状态选择使用 compact grid/wrap、Select 或 Sheet。业务 Sheet 采用固定 header/footer 与单一滚动 body。`RepairOsBusinessCard` 通过向后兼容的 `density` prop 表达标准/紧凑卡片。

## Consequences

- 移动列表能提高首屏业务密度，同时保留关键操作的可触达性。
- 页面不得用任意 margin/gap 抵消共享契约；例外需记录业务原因。
- 390px 证据必须验证页面无横向溢出。Orders 额外验证展开 header ≤208px、普通卡 ≤112px、折叠 header ≤44px、首屏至少 3 张完整普通卡。
- 该决定只改变展示契约，不改变权限、数据、API、路由或生产 schema。

## Verification

- Unit: shared RepairOS chip、business-card density 与 spacing contract。
- E2E: `orders-mobile-queue-loading.spec.ts` 与显式 env gate 的 `sitewide-spacing-rhythm-evidence.spec.ts`。
- Visual evidence: `.ai-company/memory/tasks/TASK-20260801-002-sitewide-spacing-rhythm-plan/screenshots/`。
