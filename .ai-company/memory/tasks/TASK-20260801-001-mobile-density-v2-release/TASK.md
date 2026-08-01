---
schema_version: 1
task_id: "TASK-20260801-001-mobile-density-v2-release"
title: "全站移动端分级高密度控件体系生产发布"
status: "closed"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["PRODUCT", "UX", "ARCH", "FE", "QA", "DOC", "RELEASE", "INT"]
created_at: "2026-08-01T01:19:21Z"
updated_at: "2026-08-01T02:38:45Z"
closed_at: "2026-08-01T02:38:45Z"
---
# Task — 全站移动端分级高密度控件体系生产发布

## Owner request

按已确认的高密度规划建立更完整任务，设为目标并开始执行；取消“所有移动端控件必须至少 44x44px”的全局硬性规定，重建更紧凑、高密度的移动信息展示，完成后推送并部署到生产。

## Business outcome

Chinatech 店员在 320–430px 手机屏幕上能用更少滚动扫读和处理更多工单、客户、库存、回收和设置信息；同时保留 iOS 输入缩放防护、键盘/读屏语义、危险操作隔离与可回滚生产发布。

## Scope in

- 将移动控件从单一 44px 硬门禁改为 `micro / dense / standard / input / primary / danger` 语义尺寸等级。
- 保留移动可编辑控件 16px 字号防 iOS 自动缩放规则。
- 优先重构 `/orders` 移动浮动页头、搜索、范围切换、队列筛选、空/加载/错误状态和标准工单卡。
- 在共享 pattern/primitive 层建立分级密度，然后按页面族迁移高频工作台、表单、Tabs/Chips、Dialog/Sheet 和设置页。
- 更新权威 UI/响应式文档、新增长期 ADR，保留历史任务证据原文。
- 重写移动触控 E2E 门禁：通用指针目标符合 WCAG 2.2 AA 24px/间距规则，主操作和危险操作按语义等级单独验证。
- 完成 Chromium/WebKit 端到端、截图、全量 lint/typecheck/test/build。
- 在最新 `origin/main` 隔离工作树实施，完成审查后推送 `main`，观察并验证 Vercel 生产部署。

## Scope out

- 不修改数据库、Supabase migration、API 合约、租户隔离、权限或业务状态语义。
- 不新增生产依赖、环境变量、密钥、支付或客户通知。
- 不修改打印媒介样式，不清理当前根工作区或其他任务改动。
- 不将历史 TASK/EVIDENCE 中当时真实的 44px 验收记录改写为新规则。

## Approved density contract

| Level | Target size | Usage |
| --- | --- | --- |
| micro | 24–28px | 行内链接、低频辅助图标，与相邻目标保持间距 |
| dense | 32px | Tabs、Chips、状态/队列筛选、列表菜单 |
| standard | 36px | 普通按钮、图标按钮、选择器 |
| input | 38px | 搜索、Input、Select；可编辑文字保持 16px |
| primary | 40px | 新建、保存、下一步、收款、提交 |
| danger | 40–44px | 删除、退款、关店、覆盖等危险操作 |

44px 不再是全局必须，而是可按风险/单手主操作保留的上层规格。所有指针目标不得低于 WCAG 2.2 AA 24x24 CSS px，除非明确满足其间距/等效/行内例外。

## Acceptance criteria

- [x] 权威文档已删除“<1024px 所有可见操作必须 44px”的全局硬门禁，并定义分级密度、例外、间距、输入字号与危险操作规则。
- [x] `ui-patterns` / `component-patterns` / UI primitives 提供可复用语义尺寸，新移动 UI 不需继续手写 `h-11/size-11`。
- [x] `/orders` 390x844 展开顶部高度 <=185px，滚动后常驻高度 <=44px；七个队列计数仍完整可达。
- [x] `/orders` 标准工单卡目标 92–108px，展开工具区的 390x844 首屏至少显示 3 张，工具区收起后可见 5–6 张（异常/长文案卡允许受控增高）。
- [x] 工单空状态顶部间距 <=24px，图标 <=44px，不再出现大面积无价值留白。
- [x] 高频移动页面族（orders/customers/inventory/buyback/memos/messages/settings 及共享 overlays）迁移到新分级尺寸，紧凑且不改变业务行为。
- [x] 320/390/430/768/834/1024/1440 无页面级水平溢出，固定页头/底部操作不遮挡主要内容。
- [x] 移动 input/textarea/select/contenteditable computed font-size >=16px，页面不使用 `user-scalable=no`/`maximum-scale=1`。
- [x] 通用指针目标通过 24px/间距规则；主操作 >=40px；危险操作的确认、隔离和焦点语义不回归。
- [x] 默认、加载、空、错误、无权限、离线、局部成功、长文案、大计数、小屏输入状态都有验证。
- [x] 相关组件测试、Chromium/WebKit E2E、`npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` 全部通过。
- [x] 保存无客户 PII 的 `/orders` 与代表性页面实施后截图，并与基线尺寸对比。
- [x] 仅任务范围 diff 被提交；推送 `main` 前重新核对远端未前进、integration lease 有效和回滚点。
- [x] Vercel 生产 deployment `READY`，已登录 `/orders` 实路径、关键页面、错误日志和无溢出通过；异常时立即停止并回滚。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
| --- | --- | --- | --- |
| 生产 `/orders` 顶部在 500x771 实测为 253px，搜索/范围/队列均为 44px | verified | 已登录 Chrome 只读 DOM/computed style | 作为基线 |
| 历史 390x844 生产证据顶部 247.9px | verified | TASK-20260728-007 release evidence | 作为基线 |
| WCAG 2.2 AA 2.5.8 通用目标为 24x24px 并含间距等例外 | verified | W3C official Understanding 2.5.8 | 用于新 QA 底线 |
| 最新实施基线 | verified | `origin/main@11ca3b3e` at intake | 创建工作树前 fetch/reverify |
| 根工作区落后且含大量其他改动 | verified | `main@71b2d925`, behind 65, dirty | 禁止在根工作区实施/暂存 |
| 共享源码中约 112 文件直接引用 44px 类尺寸 | observed | `git grep origin/main` | 分级迁移，禁止机械全替换 |
| GitHub CLI auth | verified limitation | `gh auth status` | 未登录；推送优先使用已配置 SSH remote，无 PR 要求 |
| Vercel CLI | verified | `Vercel CLI 53.1.1` | 发布前核对项目/身份，不显示 secret |

## Risk and autonomy

- **T3 / R3 / L2**: 跨全站共享 UI 与客户可见生产发布；代码/Git revert 可回滚，无数据迁移。
- **D1/D2 delegated**: 具体 token、页面移除重复 padding、无业务语义的视觉密度调整、测试修复。
- **D3 controlled**: 共享 primitive 公开 variant、页头收缩交互与历史兼容；必须保持 API 和业务行为不变。
- **D4 approved this turn**: 任务范围提交、推送 `main` 并触发/验证 Vercel 生产部署。
- **D4 not approved**: 数据库/权限/支付/秘密/依赖/客户通知或不可逆数据操作。

## Work packages

1. **WP-01 Contract and architecture**: 任务合同、ADR、权威密度/可访问性规则、迁移地图。
2. **WP-02 Shared density system**: 语义 token、Button/Input/Tabs/Dialog/Sheet/Accordion 及 RepairOS 共享模式，保留临时 legacy 兼容。
3. **WP-03 Orders pilot**: 顶部展开/滚动收起、搜索/范围/队列、卡片和状态密度，及组件/E2E 定量验证。
4. **WP-04 High-frequency migration**: orders/customers/inventory/buyback/memos/messages/settings/overlays 页面族语义迁移，不改业务语义。
5. **WP-05 Quality and evidence**: 狭测试、组件测试、响应式端到端、Chromium/WebKit、截图、全量门禁、diff/秘密审查。
6. **WP-06 Release and closeout**: 获取/validate integration lease，提交、推送 main，验证 Vercel READY/实页面/日志，更新文档与记忆并关闭。

## Change budget

- 允许：UI 权威文档、ADR、共享密度 patterns/primitives、高频移动页面的类名/结构最小调整、相关测试与任务证据。
- 禁止：数据/API/权限/路由/依赖/设计颜色体系/无关格式化或重构。
- 暂停条件：需要业务流程变更、新依赖、任何数据/权限变更、最新 main 冲突、无法保持 16px 输入、关键门禁失败或生产异常。

## Verification and evidence matrix

| Acceptance family | Verification | Evidence |
| --- | --- | --- |
| Policy/token contract | docs diff, component tests, `rg` legacy inventory | TASK EVIDENCE + ADR |
| Orders density | DOM bounding boxes at 320/390/430, screenshots, orders E2E | screenshots + Playwright output |
| Sitewide layout | 27+ routes at mobile/tablet/desktop, overflow assertions | visual-overflow suites |
| Accessibility | target size/spacing policy, focus/ARIA, input 16px | Chromium + WebKit tests |
| Regression | lint, typecheck, full Vitest, production build | command outputs |
| Release | remote SHA, Vercel deployment, authenticated smoke, error scan | release record + screenshots |

## Release and rollback

- 以发布前 `origin/main` SHA 为回滚点；提交和推送前再次 fetch 并验证远端未前进。
- Git/Vercel 发布失败阈值：构建错误、关键路由不可用、页面水平溢出、登录后主路径无法操作、新 error 级日志或严重视觉回归。
- 发布后异常时对任务提交执行正常 `git revert`，推送 main 触发前一代稳定生产代码；无数据恢复步骤。

## Agent plan

- No sub-agents spawned: the owner did not request delegation, and current runtime policy forbids proactive spawning. Main Integration Lead is the sole writer and reviewer; QA evidence must therefore come from reproducible automated/runtime checks rather than a claimed independent Agent review.

## Definition of done

- 所有验收标准有可复现证据，质量门禁 PASS。
- 范围外数据/API/权限/依赖不变，任务 diff 无秘密或无关文件。
- `origin/main` 指向任务发布提交，Vercel 生产 READY 且真实移动页面验证通过。
- 文档、ADR、任务 EVIDENCE/CHECKPOINTS/MEMORY_DELTA 与实际结果同步，残余风险有 owner 和解除条件。
