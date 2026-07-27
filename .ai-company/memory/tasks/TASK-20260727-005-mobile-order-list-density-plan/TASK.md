---
schema_version: 1
task_id: "TASK-20260727-005-mobile-order-list-density-plan"
title: "手机端工单分组栏与订单列表流体密度优化"
status: "in_progress"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["INT", "FLOW", "UX", "QA"]
created_at: "2026-07-27T02:14:34Z"
updated_at: "2026-07-27T04:34:13Z"
---
# Task — 手机端工单分组栏与订单列表流体密度优化

## Owner request

Owner 已批准实施：缩小手机端工单分组区域和订单卡，使更多订单在首屏可见。不按具体手机型号分支；应根据移动容器宽度使用有上下限的流体比例，连续调整间距、字号、图标、圆角和内边距，但保留 44px 触控与 16px 搜索输入安全底线。完成后推送到独立分支，不部署生产。

## Business value

减少手机端首屏被筛选/分组区域占用的高度，在不牺牲可读性和触控可用性的前提下，让店员更快看到并浏览更多工单。

## Scope in

- 盘点截图对应的订单列表移动端信息结构和现有实现文件。
- 规划顶部标题、搜索、主视图切换、状态分组栏的移动端密度与比例规则。
- 规划订单分组标题和单个订单卡片的压缩层级、保留信息与可隐藏信息。
- 定义 320、375、390、393、402、430 像素宽手机的响应式行为和触控底线。
- 给出实施阶段、文件影响、测试矩阵、截图验收和回滚方案。

## Scope out

- 不改变服务端、数据库、API、权限、订单状态或计数逻辑。
- 不改变订单状态、筛选语义、分页口径、权限、数据模型或 API。
- 不重做桌面端布局，不引入新组件库或依赖。
- 不部署、不迁移、不修改生产数据；只推送任务分支。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- 规划必须优先保证可读性、44px 级可点击区域或等效无障碍触控范围，不以简单整体缩放造成文字过小。
- 当前截图可能包含客户/工单信息；规划文档只引用布局事实，不重复写入完整客户 PII。

## Acceptance criteria

- [x] 明确当前页面高度占用问题、目标用户和业务成功信号。
- [x] 给出分组栏、分组标题、订单卡片三层的具体尺寸/间距/信息优先级规格。
- [x] 定义不同 iPhone 宽度上的一致比例策略，并说明不能使用单纯 `transform: scale()` 的原因和替代方案。
- [x] 给出默认、选中、长文案、大数字、加载、空、错误、离线和分页状态规则。
- [x] 给出实施工作包、候选文件、测试/截图矩阵、暂停条件与回滚边界。
- [x] Owner 已审阅规划并明确批准实施与推送分支。
- [x] 7 个活跃队列在移动端固定为四列两行，使用短标签但保留完整无障碍名称和真实数量。
- [x] 容器 320–440px 之间按有上下限的流体 token 调整，不使用整页 `transform: scale()` 或 CSS `zoom`。
- [x] 所有可见移动触控区域不小于 44px，搜索输入字号不小于 16px。
- [x] 结果分组标题不高于 40px，标准订单卡目标 112–122px，异常卡可受控增高。
- [x] 订单卡常显客户、工单号、设备、阶段/下一步、付款风险和异常；金额受限不泄漏真实金额。
- [x] 320/375/390/393/402/430/440px 无水平溢出，加载/离线/错误/空/长文案/大金额无布局跳动或语义回归。
- [x] 完成相关组件测试、E2E、lint、typecheck、test和 build，并保存移动端结果截图。
- [ ] 仅暂存任务文件，提交并推送独立 `agent/*` 分支，不夹带当前主工作区的无关改动。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 页面为手机端维修工单列表 | observed | Owner 截图 | 对照仓库实现定位 |
| 顶部分组区当前占用约三分之一可视内容高度 | observed | Owner 截图 | 量化组件高度和可压缩空间 |
| Owner 要求不同大小 iPhone 保持一致视觉比例 | required | Owner request | 采用流体尺寸 + 上下限，不做整页缩放 |
| Owner 更关注同屏订单条数而非每卡展示更多字段 | required | Owner request | 信息层级以“更多条目可见”为首要指标 |
| 具体组件/样式来源 | observed | `order-list-mobile-header.tsx`, `order-list-layout.ts`, `order-list-items.tsx`, `order-result-group-header.tsx`, `order-list-skeleton.tsx` | 实施时在这些边界内最小改动 |
| 顶部过高的主因 | observed | 44px 导航 + 44px 搜索 + 44px 范围切换 + 三行 44px 队列 | 把 7 个队列改为四列两行 |
| 订单卡过高的主因 | observed | 阶段、日期、付款和流程多处重复展示 | 保留关键摘要，合并/下沉低频信息 |

## Decision and approval points

- 当前为 T2 / R2 / L2 的已批准实施任务；仅允许前端密度、相关测试、证据与任务分支发布，不授权部署或生产改动。
- Owner 批准的响应式基线：不按手机型号分支，在 320–440px 容器内使用有上下限的流体比例，队列四列两行。
- Owner 批准的密度基线：顶部悬浮卡不含 safe-area 高度 `<=252px`，结果分组标题 `<=40px`，标准订单卡目标 `112–122px`。
- 不采用 `transform: scale()` / CSS `zoom` / 纯 `vw` 整页缩放；采用最大宽度、`clamp()` 有界尺寸与必要窄屏降级。
- 当前 `src/features/orders/screens/order-list-screen.tsx` 存在其他未提交打印逻辑改动；未来实施必须避开或先协调该文件，不得覆盖现有改动。

## Approved UI contract

- 队列排列：`[全部任务×2列][处理中][等配件] / [已到货][已通知][待通知][待取机]`，所有队列保持 44px 触控高度、不横向滚动。
- 响应式：按移动容器宽度连续调整非交互字号、间距、图标、圆角和内边距；变化受 `clamp()` 或等价 token 上下限约束，不缩小 44px 触控面与 16px 输入字号。
- 分组标题：保留组名、本页/总数与短说明，压缩为 38–40px；完整语义通过 `aria-label` 保留。
- 普通订单卡保留：客户、工单号、设备、当前阶段/下一步、负责人+日期摘要、付款状态/待收、异常/超期。
- 普通订单卡合并或下沉：重复阶段、双日期、默认门店保管、总额/定金/尾款三行拆分、解锁方式、随附物和非当前流程供应商；详情页继续完整展示。
- 异常卡允许 138–150px；异常、超期、客户持有设备和金额受限不得因密度优化被隐藏。

## Work packages

1. 完成只读定位、UX/FLOW/QA 规划与 Owner 审批。
2. 在独立 worktree 实现有界流体 token、四列两行队列和紧凑标题/订单卡/骨架屏。
3. 补齐组件测试和 Chromium/WebKit 移动端矩阵 E2E，保存 320–440px 截图。
4. 通过全量 lint、typecheck、2,405 项测试和 production build 后，只提交任务文件并推送独立分支。

## Agent plan

- `project_explorer`（只读）：定位真实渲染路径、组件、类名、测试和并行改动风险。
- `ux_reviewer`（只读）：输出移动端密度、比例、状态与可访问性规格。
- `product_analyst`（只读）：明确店员任务流、信息优先级、成功指标和 Given/When/Then 验收。
- 主线程负责去重、冲突裁决和最终规划；没有任何子代理拥有写入权。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
