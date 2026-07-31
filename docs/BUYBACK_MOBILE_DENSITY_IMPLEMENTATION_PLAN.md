# Chinatech 回收管理：移动端高密度一页式优化计划

状态：已批准实施  
任务：`TASK-20260731-001-buyback-mobile-density-implementation`  
基线：`bb88cb099fc404543995b4dcbb46b502e1eabbdb`  
目标环境：Chinatech RepairDesk 生产 `/buyback`

## 1. 目标与成功定义

本轮继续完善已经上线的“透明协商报价”，把移动端从“可用的长页面”升级为“可快速扫读、可单手操作、尽量少滚动的一页式工作面”。

“一页式”在本任务中的准确含义是：

- 同一连续工作面完成查看、解释、选择和保存，不使用 Stepper、Tab 轨道或页面跳转拆分任务。
- `390/430px` 的常规详情首屏同时看见设备、报价对照、风险/有效期、三个客户答复和固定保存动作。
- 详细历史、超过两项的扣减、可选设备资料按需展开，但不会永久隐藏、丢失或切换到另一个流程。
- 不通过小于 `44px` 的触控区、低于 `16px` 的可编辑控件、横向滚动或不可读的小字换取密度。

成功信号：

- 移动列表首屏出现搜索/筛选/新建、三项摘要、安全边界和至少一张完整业务卡。
- 常规详情在选择客户答复前无需纵向滚动。
- 常规创建流程最多一次短纵向滑动即可到达最终报价与保存动作。
- 六个断点无页面级横向溢出，Quote-only 流程的付款、签名、成交和商品库存副作用为零。

## 2. 不可破坏的业务边界

- 回收报价与商品库存继续完全分开，不新增 `/inventory` 入口、自动入库、整备或销售动作。
- `accepted` 只表示店员记录客户对当前报价版本的口头接受，仍处于 `offer_made`；不付款、不签名、不成交、不进入 `purchased`。
- `deferred` 保留报价继续跟进；`rejected` 必须有原因并结束当前协商。
- 接受/拒绝后当前版本锁定，只有 Owner/Manager 发布新报价版本后才能重新答复。
- 过期、硬阻断或金额为零时禁止接受，仍允许暂缓或拒绝。
- 继续使用现有服务端权限、门店隔离、CAS、幂等键、不可变报价版本和原子答复命令。
- `BUYBACK_SENSITIVE_WORKFLOW_ENABLED` 保持关闭。
- 普通页面、Toast、ARIA 和截图只出现脱敏 IMEI/电话。

本任务不修改 API、DTO、RPC、数据库 schema、迁移、权限矩阵、回收状态机或生产数据。

## 3. 当前证据与根因

活跃执行链：

```text
src/app/buyback/page.tsx
  → src/features/buyback/index.ts
  → src/features/buyback/screens/transparent-buyback-screen.tsx
  → src/features/buyback/api/buyback-api.ts
  → 现有 BFF / 原子报价 RPC
```

已验证的密度问题：

1. 三张 KPI 在 `<640px` 纵向堆叠，约占 `200px`。
2. 报价卡 loading 高度为 `160px`，卡内三格 Tile 和重复间距使一屏只能看到少量记录。
3. 详情依次显示四张卡和最多四条历史，客户答复容易落到折叠线以下。
4. 创建页的品牌、型号、颜色、容量、IMEI、电池在手机端多数为单列，表单偏长。
5. 两个 `SheetContent` 错误复用 `repairOs.mobileFloatingPage`；该页面级 pattern 自带 `pb-20` 和动态顶部 padding，挤占约 `80px` 可用高度。
6. 主金额使用 `text-3xl/text-2xl`，高于 RepairOS 移动详情的紧凑金额层级。
7. `tests/e2e/business-desktop-overflow.spec.ts` 仍断言旧回收 UI，测试已漂移。

## 4. 最终页面设计

### 4.1 `/buyback` 列表

移动悬浮头保持现有两行结构：菜单、标题/筛选数量、新建、搜索、扫码、筛选。不得增加 chips、圆点连线轨道或第二个标题区。

正文顺序：

1. 单个三列摘要条：`待答复 / 已接受（仅记录） / 需跟进`。
2. 单行紧凑安全说明：`仅记录报价与口头答复 · 不付款/成交/入库`。
3. 报价卡列表。

报价卡目标高度约 `104–120px`，三层结构：

- 第一层：回收单号、答复 badge、最终报价。
- 第二层：设备主名称；容量、颜色、脱敏标识合并为一行。
- 第三层：参考区间、扣减数量、有效期/风险与唯一下一动作，使用行式摘要，不再放三个高 Tile。

Loading skeleton 使用与最终卡一致的紧凑高度。空数据、筛选无结果和硬错误继续分开表达。

### 4.2 透明报价详情

详情继续使用接近全屏底部 Sheet，但 Sheet 外壳不再套用页面级 `mobileFloatingPage`。手机宽度保留至少 `8–12px` viewport 边距；正文单一纵向滚动，footer 不进入滚动区。

首屏结构：

1. 紧凑标题行：设备名称、回收单号、脱敏标识、答复 badge。
2. 一张决策卡：初估区间、系统建议、人工最终报价、差额、有效期、风险/阻断。
3. 报价依据摘要：扣减合计与最高优先 `1–2` 项；其余使用 `查看其余 N 项` 展开。人工调整原因始终可达。
4. 客户答复：接受报价、考虑中、拒绝，均为真实 RadioGroup，命中区至少 `44px`。
5. 持续可见的 Quote-only 说明。
6. 固定底部操作：持续显示最终价和所选答复，并提供改价、动态保存答复；关闭入口保留在 Sheet 顶部。

历史放在决策区之后：默认只展示最新报价版本和最新客户答复摘要，其余按需展开。历史加载失败不阻断当前报价和答复。

### 4.3 新建 / 改价工作台

保持同一 Sheet、同一 DOM 和键盘顺序，不加入 Stepper。

- 高频设备资料使用两列紧凑网格：品牌/型号、颜色/容量、电池。
- IMEI 扫码保持直接可见，避免门店高频录入多一步展开；仍不在列表、详情或截图暴露完整标识。
- 报价区使用两列金额网格：参考最低/最高、屏幕/电池扣减。
- 系统建议和“采用建议”合并为一条紧凑行。
- 最终报价与风险同排。
- 最终价等于系统建议时不常驻占用调整原因；偏离时自动显示且必填。
- 保存 footer 固定，保留安全区，键盘打开后仍可到达。

## 5. 响应式规则

| 宽度 | 列表 | 详情 / 工作台 |
|---|---|---|
| `360px` | 三列摘要不换行；单列 104–120px 卡 | 单列决策面；控件 44px；长文本换行 |
| `390/430px` | 首屏至少一张完整业务卡 | 常规详情无需滚动即可选择答复；底部动作不遮挡 |
| `768px` | 两列卡片 | Sheet 内容允许左右两列，但保持单一滚动上下文 |
| `1024px` | 两列紧凑卡片 | viewport-safe 双列决策区 |
| `1440px` | 三列高密度卡片 | 左报价依据、右客户答复/历史摘要 |

所有 flex/grid 子项使用 `min-w-0`；可变文本显式 truncate、line-clamp 或 break-words。列表、筛选、答复、历史和工作台禁止 `overflow-x-auto`、`snap-x` 或动态 `minWidth`。

## 6. 状态与交互

| 状态 | 页面行为 |
|---|---|
| Loading | 与最终结构等高 skeleton，不闪现旧报价 |
| 真空 | 新建报价入口；不伪装为筛选空 |
| 筛选空 | 显示当前筛选并允许清除 |
| 硬错误 | 明确加载失败并可重试 |
| 离线 | 可查看和继续本地编辑，保存禁用；恢复网络后不自动提交 |
| 无权限 | 只读或动作禁用；服务端仍为最终权威 |
| 历史失败 | 保留当前报价和答复，历史局部重试 |
| 过期 / hard block / 零报价 | 接受禁用并显示原因；暂缓/拒绝可用 |
| 已接受 / 已拒绝 | 当前版本答复锁定；Owner/Manager 可改价 |
| 缺少 revision id | 在提交前显示“需负责人先发布新版本”，答复禁用 |
| Pending | 禁止重复提交，按钮显示处理中 |
| 409/CAS | 保留草稿，不静默覆盖，提示刷新重开 |
| 成功 | 只说明报价或口头答复已保存，不说收购完成 |

## 7. 文件合同与变更预算

允许修改：

- `src/features/buyback/screens/transparent-buyback-screen.tsx`
- `tests/e2e/buyback-guided-flow.spec.ts`
- `tests/e2e/business-desktop-overflow.spec.ts`
- `src/app/buyback/page.tsx`（只修正 quote-only metadata）
- 本计划与本任务的 Task Memory 文件

允许在 `src/features/buyback/components/` 或 `src/features/buyback/model/` 抽取纯展示/纯 helper，前提是只服务活跃透明报价 screen，且不改变 API 合同。

禁止触碰：

- `src/features/buyback/api/*`
- `src/lib/repairdesk/api.ts`、`src/lib/repairdesk/types.ts`
- `src/server/*`
- `src/features/inventory/server/*`
- `supabase/migrations/*`、`supabase/tests/*`
- 旧的非活跃 `src/features/buyback/screens/buyback-screen.tsx`

任何需要上述禁止区的发现都构成 Plan Delta，必须停止并重新分级。

## 8. 工作包

### WP1 — 列表密度

- 把三张纵向 KPI 合并为三列摘要条。
- 把安全说明压缩为单行/两行状态带。
- 报价卡改为三层行式摘要并降低 skeleton 高度。
- 退出条件：`390×844` 首屏出现完整报价卡；无横向溢出。

### WP2 — 详情首屏决策

- 修正 Sheet shell，删除页面级 padding 污染。
- 合并金额对照、风险和有效期。
- 扣减与历史渐进展开；客户答复前置。
- 缺少 revision 时预先禁用答复。
- 退出条件：常规 390/430px 详情无需滚动即可选择答复。

### WP3 — 创建/改价压缩

- 手机必要字段两列；补充资料折叠。
- 建议价、最终价、风险和条件性原因压缩。
- 保持原有校验、CAS、幂等与权限。
- 退出条件：常规创建最多一次短滑动到达最终价和保存。

### WP4 — 测试纠偏与证据

- 补 `360px`，并分别运行 Chromium/WebKit。
- 断言 page/dialog 无横向 overflow、无 progress/stepper/chip rail。
- 断言移动触控区、输入字号、footer 遮挡、IMEI 脱敏和请求黑名单。
- 修复旧 desktop overflow 测试对回收页面的过期断言。
- 产出移动列表、详情、工作台和桌面截图。

## 9. 验收标准

1. `390×844` 列表首屏同时出现搜索/筛选/新建、摘要条、安全边界和至少一张完整业务卡。
2. 报价卡一眼可见设备、最终报价、答复、风险/有效期和唯一下一动作。
3. 常规 `390/430px` 详情首屏同时出现设备、价格对照、风险、有效期、三种答复和固定保存动作。
4. 超过两项扣减时默认只显示合计和前两项，展开后全部可读且不横溢。
5. 历史默认显示最新报价/答复摘要，展开后可追溯其余记录。
6. 创建页最终价等于建议时调整原因不常驻；偏离时自动显示并必填。
7. 拒绝未选原因时保存禁用。
8. 过期、硬阻断或零报价不能接受，暂缓/拒绝仍可选。
9. 已接受/拒绝锁定；Sales 无改价，Technician 无创建/答复。
10. 离线、保存失败、409 冲突均保留草稿，恢复网络不自动提交。
11. 透明报价请求不会调用 attachment、finalize、payment、signature、库存 transition 或商品创建/更新。
12. `360/390/430/768/1024/1440` 的列表、工作台、详情满足 `scrollWidth <= innerWidth`。
13. `<1024px` 可见主要操作和选择项命中区至少 `44×44px`；移动输入 computed font-size 至少 `16px`。
14. 普通页面、ARIA、Toast 和截图不出现完整 IMEI/电话。
15. 页面不存在 progressbar、Stepper、横向状态 rail 或商品库存联动入口。

## 10. 验证与证据矩阵

必须执行：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

UI 门禁：

- Playwright Chromium + WebKit。
- viewports：`360×780`、`390×844`、`430×932`、`768×1024`、`1024×768`、`1440×900`。
- 状态：列表、filled workspace、详情、长内容、错误、离线、无权限、冲突。
- 每个视口断言 page/dialog overflow；手机断言触控区、输入字号、footer 安全区。
- 截图仅使用合成/脱敏数据，文件名包含 browser、viewport、state。

发布阻断条件：跨店/无权限泄漏、完整 PII、静默覆盖、重复写入、敏感/付款/库存副作用、手机严重溢出或底部动作被遮挡。

## 11. 发布与回滚

本轮为 app-only 发布，无数据库迁移、回填或生产数据写入步骤。

发布顺序：

1. 在最终 SHA 完成全部质量与浏览器门禁。
2. 获取并验证 integration lease。
3. 提交并推送 `codex/buyback-mobile-density-20260731`。
4. Vercel 生产构建先以不切域名方式完成 Ready 验证。
5. 验证 `/buyback` HTTP、桌面和 390px 登录态流程后再 promote。
6. promote 后复核 console、overflow、主要交互和截图。

回滚：

- 应用 UI 异常时回退到上一生产 deployment，但必须保持透明报价账本和“通用 quote_payload 拒绝”服务端护栏。
- 写入异常第一止损仍是关闭 `REPAIRDESK_BUYBACK_TRANSPARENT_QUOTE_WRITE_ENABLED`。
- 不删除报价账本，不执行反向迁移，不清除生产报价数据。

## 12. 多代理分工与决策

- FLOW / `buyback_density_product`：定义“一页式”的业务边界、首屏优先级和状态验收。
- UX / `buyback_density_ux`：定义移动密度、响应式、触控与可访问性规范。
- Explorer / `buyback_density_code_map`：确认活跃执行链、最小 app-only 文件范围和 Sheet padding 根因。
- QA / `buyback_density_qa`：定义六宽度、双浏览器、异常状态、请求边界和回滚门禁。
- INT / 主线程：唯一业务代码写入者、最终集成、测试、推送和部署负责人。

所有子代理只读，无文件所有权、无提交/推送/部署/数据库权限。

## 13. 实施结果与计划差异

截至 2026-07-31，本计划的 app-only 实施已完成并通过发布前门禁。

- 顶部三张纵向 KPI 已合并为单个三列摘要条；安全边界和离线状态均压缩为紧凑状态带。
- 列表卡改为三层行式摘要，最终报价、答复、设备、脱敏 IMEI、参考区间、扣减数、有效期和下一动作一眼可见。
- 详情和创建 Sheet 已移除错误的 `mobileFloatingPage` 页面级 padding；手机接近全屏、桌面显式双列，footer 独立并保留 safe-area。
- 详情默认只展示前两项扣减，历史和备注按需展开；缺少 revision id 时预先禁用答复。
- 创建页使用两列设备与报价网格，手动偏离建议价时才显示必填调整说明。
- 计划原建议把颜色和 IMEI 放入折叠区。视觉与操作验证后保留为直接可见：这是门店面对客户快速录入的高频资料，360px 仍保持一次连续短滚动、无遮挡、无横向溢出，避免多一次展开动作。
- 当前数据合同只提供报价版本历史；“最新客户答复摘要”和完整检测摘要没有独立 DTO。本轮不伪造数据，保留为后续独立 API/DTO 任务。

验证摘要：Chromium 与 WebKit 覆盖 `360/390/430/768/1024/1440` 的创建、列表、详情、答复、权限、离线、遮罩和副作用黑名单；Chromium 另覆盖 `1024/1280/1440/1600` 桌面页面与弹窗溢出。完整证据见本任务 `EVIDENCE.md`。
