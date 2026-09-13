# RepairDesk 项目优化执行路线图

编制日期：2026-09-04（Europe/Rome）

第 1–25 节业务输入：`docs/PROJECT_OPTIMIZATION_REPORT_2026-09-04.md`。2026-09-12 的 UI 一致性专项以最新用户要求补充在[第 26 节](#ui-consistency-20260912)，不替代原业务路线图。

文档性质：本路线图把既有优化报告转换成可分批授权、实施、验证、发布和回滚的执行合同。它不是实施授权，不证明任何候选功能已经完成，也不授权修改代码、配置、数据库、权限、生产数据、远端环境或部署。

## 1. 总体结论

未来 90 天不应以“增加最多功能”为目标，而应按以下顺序推进：

1. 先证明恢复、租户隔离、隐私默认值、API 安全和关键发布门禁。
2. 再补齐退款/冲正和库存分页两个会直接影响交易正确性与规模化的能力。
3. 随后提升门店日常效率，包括跨模块今日队列、真正全局搜索、采购工作台和 Quick Entry 完整状态。
4. 最后只选择少量闭环或试点，包括返修/保修、盘点、消息状态、日结，以及 Offline 或 Kiosk 中的一个受控试点。

当前优化报告没有证明 P0，故路线图从 P1 条件性门禁和 P2 高价值闭环开始。任何后续阶段一旦出现已证实的数据泄露、生产故障或越权写入，立即升级为 P0 并停止相关操作。

## 2. 目标、非目标与成功定义

### 2.1 90 天总体目标

- 建立一次可重复的 DB + Storage 隔离恢复证据，并明确真实 RPO/RTO。
- 完成生产租户/RLS/ACL/函数/Storage 的只读一致性结论，或清楚记录仍未获授权的缺口。
- 把短信同意默认值、客户搜索 PII URL、未知错误回显和 JSON body limit 纳入安全基线。
- 完成退款/冲正的产品与数据合同，并在门禁满足后形成可验证 Preview 候选。
- 将 Inventory/Buyback 的增长型读取改造成有界服务端分页候选，以真实或合成规模证据证明收益和兼容性。
- 建立风险导向、不可静默跳过的核心业务 E2E/数据库测试门禁。
- 至少交付一个直接改善门店每日效率的模块，并为后续闭环保留清晰回滚路径。

### 2.2 明确非目标

- 不拆微服务，不更换 Next.js、Supabase 或整体技术栈。
- 不重写全部 router、types、schema、API client 或订单详情页面。
- 不一次性打开 Offline、Buyback Sensitive、Kiosk、Lifecycle、Inventory V2 等所有开关。
- 不把 AI 扩到客户公网、图片 PII、支付、库存或权限写入。
- 不以 Knip、依赖告警或历史 backlog 为依据做批量自动删除或升级。
- 不在恢复与租户门禁未完成前关闭 Inventory V1 回退或扩展第二店。
- 不同时启动报价自助确认、预约、技师工时等全部增长项。
- 不把未验证的生产状态写成已发生事故，也不把计划写成完成证据。

### 2.3 组合级成功定义

90 天路线只有在以下条件全部满足时才算成功：

1. 每个进入实施的工作包都有冻结的范围、非目标、允许路径、验收、验证、回滚和停止条件。
2. 所有高风险写路径都能证明权限、店铺边界、幂等/CAS、审计和失败语义。
3. 所有生产发布都绑定 exact SHA、通过相称门禁、保留回滚锚点，并有明确观察窗口。
4. 未解决 P0 为 0；与当前发布验收直接相关的 P1 为 0。
5. 未经验证或未获授权的生产内部状态保持标记为“未知”，不会被成功叙述覆盖。
6. P2/P3 相邻发现被登记但不自动扩大当前工作包。

## 3. 执行原则与变更合同

### 3.1 优先级原则

1. 正确性与可恢复性优先于增长功能。
2. 支付、租户、权限、隐私和迁移优先于体验优化。
3. 先量测后重构；没有 row count、scanned rows 或 p95 证据时，不凭猜测改变 read model。
4. 先冻结产品/数据合同，再实施 UI、API、RPC 或 migration。
5. 优先 additive、兼容、可关闭的改动；删除旧路径必须有流量和回滚证据。
6. 保持模块化单体，通过 feature contract 渐进拆分，不把文件过大直接等同于必须拆服务。

### 3.2 默认变更预算

- 一个工作包只覆盖一个业务能力及其直接测试、文档和发布证据。
- 每个模块只有一个写入者；不同工作包只有在文件所有权不重叠时才能并行。
- 新增模块、公共接口、数据库对象、权限、租户语义、依赖或生产目标时，先提交 Plan Delta。
- 默认不允许破坏性 migration、批量数据回填、删除旧列/表、真实客户数据复制或生产 flag 切换。
- 新旧 API/数据路径需要兼容窗口；在 shadow compare、指标和回滚证明通过前，不移除旧路径。
- 每个阶段最多容纳 3–4 个相互关联模块；连续两个模块没有源码变化时停止扩展扫描。

### 3.3 角色与责任

| 角色 | 核心责任 | 不得自行决定 |
|---|---|---|
| Owner / 老板 | 批准方向性选择、生产只读检查、R3/R4 写入、发布和不可逆操作 | 不需要维护内部任务模板或测试细节 |
| Integration Lead | 维护唯一范围合同、顺序、验证基线、问题分级和最终集成结论 | 不因相邻 P2/P3 自动扩范围 |
| Product / Finance | 定义角色、状态机、金额不变量、失败/撤销语义和可测试验收 | 不直接授权生产数据修改 |
| Backend / Data | API、RPC、查询、事务、revision、审计和迁移设计 | 不绕过权限、备份或兼容门禁 |
| Frontend / UX | 页面状态、交互、响应式、键盘、错误恢复和角色可见性 | 不以 UI 隐藏替代服务端授权 |
| Security / Privacy | 租户、权限、AAL2、秘密、PII、同意、附件和威胁复核 | 只提交证据与阻塞建议，不自行扩大整改范围 |
| QA | 验收、边界、回归、失败注入、浏览器与 a11y 证据 | 不把范围外 P2/P3 自动变成发布阻塞 |
| Release / Ops | exact SHA、Preview、生产发布、观察、回滚锚点和运行证据 | 不在缺少批准或门禁时切换生产 |

### 3.4 估算口径

- S：约 2–5 个有效工作日。
- M：约 1–3 周。
- L：约 4–8 周。
- M/L：取决于生产只读授权、数据量、migration 范围和跨角色验收。

这些是工作量级，不是固定交付日期。若团队容量不足，保持阶段顺序并减少并行项，不压缩安全或恢复门禁。

## 4. 前置假设、未知项与决策点

### 4.1 当前假设

- 当前已上线版本可继续运行；现有报告没有证明 P0。
- 最近同日 lint、typecheck、全量测试、build 和浏览器证据可作为未变更源码的起始基线。
- 继续采用模块化单体和现有发布模式。
- 生产读、生产写、migration、权限、支付、隐私、外部消息和 feature flag 切换需要独立授权。
- 首月最多并行两条不重叠轨道：一条只读/隔离安全验证，一条产品与数据合同设计。

### 4.2 必须保持为未知的状态

| 未知项 | 需要的证据 | 决策影响 |
|---|---|---|
| Supabase 当前 PITR、backup 和恢复点 | 控制面只读证明、隔离恢复记录 | 决定 DB migration 和不可逆清理是否可启动 |
| 生产 RLS/ACL/函数/Storage 一致性 | 生产只读导出、双店拒绝矩阵 | 决定多店与新权限发布是否可启动 |
| 历史解锁凭据、consent、敏感审计和 orphan attachment 数量 | 经批准的最小化统计，不导出原始 PII | 决定清理、加密与保留方案规模 |
| Inventory/Orders 真实规模与 p95 | row count、scanned rows、p50/p95、内存与冷启动 | 决定分页阈值和 read model 优先级 |
| 多店 cookie 缺失/篡改行为 | 双店账号定向测试 | 决定显式店铺选择与 expectedStoreId 强制范围 |
| 真实 iPhone、VoiceOver/NVDA 与弱网行为 | 设备级流程证据 | 决定移动和 a11y 是否可正式关闭 |
| dormant feature 的实时开关状态 | 经批准的控制面只读检查 | 决定 Offline/Kiosk/Buyback/Lifecycle 试点可行性 |

### 4.3 决策窗口

- 第 2 个工作日前：Owner 决定是否授权生产控制面/权限的只读核查。
- 第 5 个工作日前：冻结退款/冲正合同中的现金退款、原路退款、部分退款、权限和报表语义。
- 第 10 个工作日前：根据量测方案决定分页性能阈值，不预先发明数字。
- 第 30 天：决定退款与分页能否进入实施 Preview。
- 第 60 天：从 Offline 与 Kiosk 中最多选择一个进入 61–90 天受控试点。
- 第 75 天：决定回收成交是否具备法律、隐私、保留和原子 Finalize 前置条件；不足则延期。
- 第 90 天：从报价自助确认、预约、技师工时中只选一个作为下一季度候选。

## 5. 阶段与里程碑总览

| 阶段 | 时间 | 主里程碑 | 主要优先级 | 进入条件 | 退出条件 |
|---|---:|---|---|---|---|
| Phase 0 | 第 0–2 天 | 范围、角色、证据基线冻结 | 治理 | 路线图获采用 | 所有首批工作包有 owner、验收、验证、回滚和授权边界 |
| Phase 1 | 第 1–10 天 | 高风险合同与只读/隔离计划完成 | P1 | Phase 0 完成 | 退款合同、恢复/租户方案、快速安全 allowlist、量测与 CI 合同可执行 |
| Phase 2 | 第 11–30 天 | 安全基线与证据基线落地 | P1 | 相应授权与 allowlist 完成 | 恢复/租户结论或明确阻塞；快速安全批、量测和首批门禁验收通过 |
| Phase 3 | 第 31–45 天 | 交易纠错与分页 Preview | P1 | Phase 2 门禁通过 | 退款与分页在 Preview 通过核心故事、失败注入和回滚演练 |
| Phase 4 | 第 46–60 天 | 门店效率模块交付 | P2 | Phase 3 没有未解决当前 P1 | 今日队列/搜索、采购或 Quick Entry 按容量完成 2–3 个，不强求全做 |
| Phase 5 | 第 61–75 天 | 返修、盘点和沟通闭环 | P2 | 退款/分页稳定，数据门禁允许 | 至少两个闭环达到 Preview/小范围发布条件 |
| Phase 6 | 第 76–90 天 | 单一受控试点与季度收口 | P2/P3 | kill switch、法律/安全/回滚批准 | Offline 或 Kiosk 最多一个试点；下一季度只选择一个增长项 |

## 6. Phase 0：动员与范围冻结（第 0–2 天）

### 6.1 范围与非目标

范围：把路线图拆成独立可验收工作包，确认负责人角色、依赖、风险、验证基线和批准边界。

非目标：不修改产品、不访问生产数据、不创建 migration、不切换 flag、不部署。

### 6.2 工作包

| WP | 工作内容 | 负责人角色 | 依赖 | 预计投入 | 完成产物 |
|---|---|---|---|---|---|
| WP0-1 | 建立组合看板与唯一 Done/Remaining/Blocked/Next | Integration Lead | 本路线图 | S | 工作包清单、状态、owner、目标日期 |
| WP0-2 | 为首批 6 个工作包冻结范围、非目标和允许路径 | Integration Lead + 各模块 owner | WP0-1 | S | 6 份最小变更合同 |
| WP0-3 | 冻结验证基线指纹 | QA + Release | 当前 exact SHA 与既有证据 | S | source/deps/config/schema/test-target/risk 基线 |
| WP0-4 | 整理 Owner 审批队列 | Integration Lead | WP0-2 | S | 生产只读、R3/R4、发布与外部写入的审批清单 |

### 6.3 验收标准

- 每个首批工作包都有一个业务结果，不按文件数量拆分。
- 每个工作包都写明唯一写入者和候选路径；未知路径必须在实施前重新审计。
- 生产只读、生产写、migration、权限、支付、外部消息和 flag 操作分别列出，不合并授权。
- 现有未跟踪文件、截图和其他任务资产被标记为非本任务所有，不清理、不覆盖。

### 6.4 定向验证

- 核对范围表与优化报告 P1/P2 的一一映射。
- 检查所有验收项都有对应测试或证据位置。
- 检查每个 R3/R4 工作包都有回滚/备份前置项。

### 6.5 风险升级与停止条件

- 出现两个可能的写入 owner、allowlist 重叠或现有 dirty ownership 不明：停止写入并由 Integration Lead 裁决。
- 需要新增数据库、权限、依赖或生产目标但合同未列出：记录 Plan Delta，不进入实施。
- 未映射验收或没有回滚证据的高风险工作包：不得排期。

## 7. Phase 1：合同、只读方案与实施准备（第 1–10 天）

### 7.1 范围与非目标

范围：完成退款/冲正产品与数据合同、恢复与租户审计方案、Privacy/API 快速安全批 allowlist、性能量测合同，以及风险导向 E2E/数据库 CI 设计。

非目标：不在本阶段直接执行生产 migration、退款、数据修复、权限修改或 feature flag 切换。

### 7.2 工作包与模块

| WP | 模块与范围 | 负责人角色 | 依赖 | 预计投入 | 完成产物 |
|---|---|---|---|---|---|
| WP1-1 | 退款/冲正：角色、原付款引用、部分/全额、金额不变量、幂等、CAS、不可变台账、余额/毛利/日结投影 | Product/Finance + Backend/Data + Security | 当前收款能力与 `payment:refund` 边界 | M | PRD、状态机、API/RPC 合同、威胁模型、测试矩阵、回滚设计 |
| WP1-2 | 恢复：PITR、当前 baseline、Postgres 17、三个私有 bucket、RPO/RTO、恢复顺序 | Data/Ops + Security | Owner 对控制面只读和隔离环境授权 | M | 恢复 Runbook、演练数据集、验收记录模板、季度复测计划 |
| WP1-3 | 租户一致性：RLS、ACL、default ACL、函数 grant、Storage policy、双店拒绝矩阵 | Security + Data | Owner 生产只读授权；两店测试身份 | M | 只读采集清单、拒绝矩阵、差异分级与 forward-fix 模板 |
| WP1-4 | Privacy/API 快速安全批：consent 默认拒绝、PII 不进 URL、安全 500 + requestId、默认 body limit 与 unsafe Cookie mutation 守卫 | Backend + Frontend + Privacy + QA | 精确源码 allowlist | M | 四个独立最小变更合同和定向测试计划 |
| WP1-5 | Inventory/Orders 量测：row count、scanned rows、p50/p95、内存、冷启动和分页阈值 | Backend/Data + Ops | 安全的匿名指标方案 | S/M | 指标字典、阈值决策规则、采样与 PII 禁止项 |
| WP1-6 | 风险导向 E2E/DB CI：Orders、Customers、Inventory、store switch、permission、migration/RLS/grant | QA + Data + Release | CI 环境和可信 baseline 设计 | M | touched-domain 映射、不可 skip 规则、失败注入方案 |

### 7.3 验收标准

- 退款合同能回答：谁可退、退哪一笔、最多退多少、部分退款如何累计、重复请求如何回放、并发如何 409、报表如何反映、失败如何保持原账不变。
- 恢复方案同时覆盖数据库和 Storage，不把数据库恢复成功等同于业务恢复成功。
- 租户矩阵至少定义同店允许、跨店读取拒绝、跨店写入拒绝、搜索/导出/附件拒绝和 service-role 边界。
- 四个 Privacy/API 改进各自可独立发布与回滚，不打成不可拆大包。
- 性能阈值由现有或合成证据决定；没有数据时只冻结量测方法，不承诺虚构 p95。
- CI 设计能证明关键 job 在环境缺失时失败，而不是静默 skip。

### 7.4 定向验证

- Product/Finance 对退款金额和状态机做桌面演练：现金、原路、部分、多次、超额、重复和并发。
- Security 对退款、租户、consent、错误信息和 body limit 做威胁复核。
- Data/Ops 对恢复 Runbook 做 dry-run，确认依赖、凭据边界和证据输出。
- QA 将每条验收映射到 unit、integration、SQL/pgTAP、browser 或人工检查之一。

### 7.5 风险分级与停止条件

- P0：只读核查发现正在发生的跨店泄露、越权写入或生产故障，立即停止当前路线并进入事件响应。
- P1：合同无法保证金额不变量、恢复无法闭环 DB+Storage、租户矩阵存在当前可复现越权，相关工作包停止发布准备。
- P2/P3：新增体验或增长建议只登记，不进入首批合同。
- 生产只读权限未获批准：WP1-2/WP1-3 保持“方案完成、实证阻塞”，不能用本地推断替代生产结论。
- 退款需要改变会计或法律方向且 Product/Finance 无一致决定：暂停，不让工程自行选择。

## 8. Phase 2：安全与证据基线落地（第 11–30 天）

### 8.1 范围与非目标

范围：在相应批准下执行隔离恢复演练、生产租户只读对账、四个最小 Privacy/API 改进、性能量测和第一批风险导向门禁。

非目标：不实施退款，不做破坏性数据修复，不清理历史 migration，不删除旧 API，不自动打开 dormant feature。

### 8.2 工作包与模块

| WP | 模块与范围 | 负责人角色 | 依赖 | 预计投入 | 完成产物 |
|---|---|---|---|---|---|
| WP2-1 | DB + Storage 隔离恢复演练 | Data/Ops + Security + QA | WP1-2、批准的隔离环境和最小化测试数据 | M/L | 可重复 Runbook、实际 RPO/RTO、校验清单、失败日志和改进项 |
| WP2-2 | 生产租户权限只读对账 | Security + Data | WP1-3、Owner 明确授权 | M | policy/grant 差异表、双店拒绝证据、P0/P1/P2 分类 |
| WP2-3 | consent 默认拒绝与生命周期最小修复 | Backend + Frontend + Privacy | WP1-4；历史存量处理另行授权 | M | 兼容代码、明确来源/时间/撤销语义、定向测试 |
| WP2-4 | 客户搜索 PII 不进 URL | Frontend + Privacy + QA | WP1-4 | S/M | 同标签页短期状态、刷新/导航语义、URL 证据和浏览器测试 |
| WP2-5 | API body/origin/error/requestId 基线 | Backend + Security + QA | WP1-4 | M | 默认守卫、安全错误 envelope、边界测试与日志字段合同 |
| WP2-6 | 性能量测与首批 E2E/DB CI | Backend/Data + QA + Release | WP1-5/WP1-6 | M/L | 指标基线、required job、SQL/pgTAP 入口、故意破坏证明 |

### 8.3 验收标准

- 恢复演练从已记录的备份/基线开始，在隔离环境恢复 DB 与三个私有 bucket，并验证关键对象关联；输出真实而非目标化的 RPO/RTO。
- 生产权限对账不写生产；任何差异只形成 forward-fix 建议，不在同一工作包执行 migration。
- 省略 `consent_sms` 不再自动得到同意；历史不确定数据不得伪装成已同意。
- 客户姓名/电话自由搜索不出现在 URL、浏览器历史或可共享链接中；非 PII 筛选仍可深链。
- 过大 JSON 在 schema 前被拒绝；unsafe Cookie mutation 校验 Origin/Content-Type；未知异常只返回安全错误和 requestId。
- touched-domain required job 能在故意破坏核心故事时失败；DB 测试能从可信 baseline 验证 RLS/grant/search path。

### 8.4 定向验证

- 恢复：一次正常恢复、一次缺失 Storage 或错误顺序的失败注入、对象关联抽样。
- 租户：双店 read/write/search/export/attachment 正反矩阵；原始 PII 不进入报告。
- Privacy/API：unit + API integration + 浏览器 URL/历史检查；安全日志检查不得包含 secret/完整 PII。
- CI：在隔离分支故意破坏四个关键故事，证明 required job 失败；恢复后只重跑相关门禁一次。
- 性能：记录 page size、scanned rows、round-trip、p50/p95、内存与 cold start；不在本阶段强行优化。

### 8.5 发布与停止条件

- Privacy/API 四项应拆成可独立回滚的小发布；不等待所有恢复/租户未知项才发布低耦合安全改进。
- 任何数据库默认值变化若需要 migration 或历史回填，必须另建 R3/R4 包并取得授权。
- 恢复演练失败两次后停止重复补丁，先做一次根因分析并向 Owner 提交可选路径。
- 生产租户对账发现 P0 时停止所有非事件工作；发现 P1 时阻塞相关多店/权限/DB 发布，不自动扩大到无关 UI。
- 四项快速修复若引入公共 API 破坏或老客户端不兼容，停止生产发布并保留兼容路径。

## 9. Phase 3：退款与服务端分页 Preview（第 31–45 天）

### 9.1 范围与非目标

范围：实现退款/冲正闭环的受控候选、Inventory/Buyback 服务端分页和第一批强一致 command envelope。

非目标：不自动推广日结、不关闭旧库存读取、不做全 router 重构、不一次覆盖所有业务 mutation。

### 9.2 工作包与模块

| WP | 模块与范围 | 负责人角色 | 依赖 | 预计投入 | 完成产物 |
|---|---|---|---|---|---|
| WP3-1 | 退款/冲正数据层：原子 RPC、不可变台账、operation id、幂等回放、CAS、审计/revision | Backend/Data + Security | WP1-1 合同；恢复与 DB 门禁达到约定条件 | L | additive schema/RPC 候选、测试、migration/rollback 包 |
| WP3-2 | 退款/冲正应用层：权限、部分/全额、pending/error/success、余额和报表投影 | Frontend + Product/Finance + QA | WP3-1 | M/L | Preview UI、角色故事、浏览器与 a11y 证据 |
| WP3-3 | Inventory/Buyback 分页 API 与 repository | Backend/Data | Phase 2 指标和阈值 | M/L | additive page/cursor contract、DB 筛选/排序/facet、兼容 adapter |
| WP3-4 | 分页 UI 与 current-page thumbnail | Frontend + QA | WP3-3 | M | 分页/无限滚动状态、筛选/排序兼容、loading/empty/error/offline |
| WP3-5 | 第一批 command envelope | Backend/Data + Security | WP3-1 模式 | M/L | 优先覆盖支付、客户 tag/message/update 和库存高风险命令的统一 receipt/CAS/audit 模式 |

### 9.3 验收标准

- 退款不能超过可退余额；多次部分退款总额正确；重复 operation id 返回同一 receipt；并发冲突返回可理解的 409。
- 退款业务写、审计和 revision 在同一事务边界；外部通知不阻塞台账提交并通过 outbox 表达。
- 无退款权限的角色在服务端被拒绝；UI 隐藏不是唯一防线。
- 余额、毛利和未来日结投影与退款台账一致；原支付不被改写或删除。
- 分页结果与旧读取在相同筛选/排序下 shadow compare 一致；thumbnail 只补当前页。
- 在 10k/50k synthetic 数据下记录 page size、p95、round-trip 和内存；是否达标使用 Phase 2 冻结阈值。
- 旧读取保持可回退，直到 Preview、shadow compare 和观察窗口通过。

### 9.4 定向验证

- 退款 unit/integration：现金、原路、部分、多次、超额、重复、并发、超时重试、权限拒绝、审计失败注入。
- 退款 browser：Owner/Manager/Front Desk/Technician 权限故事，pending/error/success、键盘与焦点、三语关键文案。
- 数据库：事务回滚、唯一约束、CAS、RLS/grant/search path、旧数据兼容。
- 分页：首/中/末页、空页、筛选、排序、删除/插入并发、cursor 过期、网络失败和旧/新结果比对。
- 性能：固定数据集与固定环境对比，禁止只报告单次最快值。

### 9.5 发布、回滚与停止条件

- DB 变更必须 additive，先部署兼容 reader/writer，再启用新路径；删除旧路径不属于本阶段。
- Preview 通过后仍需独立 Owner 生产发布授权。
- 退款出现金额不变量失败、重复退款、审计缺失或跨店访问，判为 P0/P1 并停止发布。
- 分页 shadow mismatch 超过冻结容忍度或 cursor 导致漏项/重复不可解释，关闭新路径并回到旧读取。
- rollback 首选关闭 feature flag/切回 adapter；数据库回退采用 forward-fix，不执行未演练的破坏性 down migration。

## 10. Phase 4：门店效率模块（第 46–60 天）

### 10.1 范围与非目标

范围：按容量从“今日要做”、真正全局搜索、采购/缺货工作台、Quick Entry 完整状态中完成 2–3 个，以每日效率和错误减少为目标。

非目标：不为了赶 60 天同时完成所有四项；不创建第二个全局搜索入口；不把移动 DOM 缩放成桌面布局或反向复用。

### 10.2 工作包与模块

| WP | 模块与范围 | 负责人角色 | 依赖 | 预计投入 | 完成产物 |
|---|---|---|---|---|---|
| WP4-1 | 跨模块“今日要做”：工单、客户跟进、备忘、回收、库存待取 | Product + Backend + Frontend + QA | 权限裁剪、部分失败策略 | M/L | 角色化聚合、优先级原因、去重、深链接与局部降级 |
| WP4-2 | 真正全局搜索：工单、客户、库存设备、备忘 | Product + Backend + Frontend + Privacy | WP4-1 可复用摘要；PII 不进 URL | L | 分组结果、权限安全摘要、键盘路径、唯一 shell trigger |
| WP4-3 | 配件数量分配与采购/缺货工作台 | Product/Operations + Backend/Data + Frontend | 库存一致性与供应商现有能力 | M/L | 数量分配、低库存、缺货工单、最近成本、收货/释放流程 |
| WP4-4 | Quick Entry 六宽度与状态矩阵 | Frontend/UX + QA | 现有 desktop/mobile 独立 DOM、Popover/Sheet 合同 | M | 390/430/768/1024/1280/1440 的状态与交互证据 |

### 10.3 验收标准

- 今日队列按角色裁剪，说明“为什么出现”，相同实体不重复轰炸；一个域失败不让整页失败。
- 全局搜索覆盖承诺的实体，结果不越权，搜索词不进 URL，桌面 shell 只保留一个入口并支持键盘。
- 采购数量分配不会产生负库存；并发失败可重试且失败原因可见；供应商成本权限受控。
- Quick Entry 覆盖默认、loading/disabled、empty、invalid、read failure、permission-limited、offline/conflict、save pending/error/success。
- 1024px Buyback 内部横滚获得真实浏览器结论；如确有缺陷，作为独立小修复，不顺带重构表格体系。

### 10.4 定向验证

- 今日队列：不同角色、空数据、大量数据、局部 API 失败、重复实体和深链接。
- 搜索：键盘、屏幕阅读器名称、跨域分组、权限拒绝、安全摘要、输入节流与失败恢复。
- 采购：数量边界、并发分配/释放、缺货、最近成本权限和事务失败。
- Quick Entry：六宽度、长标签、最后选项可达、Escape、焦点返回、软键盘、触摸/鼠标滚动。

### 10.5 风险升级与停止条件

- 搜索返回跨店或未经授权的客户/金额/设备信息：P0/P1，立即停止。
- 今日队列需要新增跨域公共 read model 或 DB schema：提交 Plan Delta，不在 UI 包中顺带实现。
- 采购分配需要改变库存事务语义：升级为 R3 数据合同，先停 UI。
- Quick Entry 需要 API、payload、权限、tenant、依赖或 schema 改动：按既有设计边界停止并请求新包。
- 60 天容量不足时优先保留今日队列与 Quick Entry/采购之一，全局搜索可顺延；不压缩 QA。

## 11. Phase 5：业务闭环（第 61–75 天）

### 11.1 范围与非目标

范围：返修/保修 Episode、库存盘点、消息发送状态，以及退款稳定后的日结设计或 Preview。

非目标：不把 RepairDesk 变成完整会计系统；不在返修中改写原工单历史；不自动合并客户；不在消息中心未经同意批量外发。

### 11.2 工作包与模块

| WP | 模块与范围 | 负责人角色 | 依赖 | 预计投入 | 完成产物 |
|---|---|---|---|---|---|
| WP5-1 | 一等返修/保修 Episode | Product + Backend/Data + Frontend + QA | 工单来源关系、权限和历史不可变合同 | L | 关联新工单、保修判定、原/新故障、disposition、时间线 |
| WP5-2 | 库存盘点/循环盘点 | Product/Operations + Backend/Data + Frontend | 分页稳定、库存 command envelope | L | 草稿盘点、扫码差异、经理批准、并发冲突与审计 |
| WP5-3 | 消息 opened/sent/delivered/read/failed 中心 | Product + Backend + Frontend + Privacy/Security | consent 生命周期；提供商回执设计 | M/L | 精确状态、验签、失败重试、人工确认语义 |
| WP5-4 | 日结/现金交班 | Product/Finance + Backend/Data + Frontend | 退款闭环稳定 | L | 按支付方式汇总、实点、差异原因、经理确认与审计重开 |

### 11.3 验收标准

- 返修创建新的关联 Episode/工单，原订单和原报价保持不可变；权限、状态和责任清晰。
- 盘点支持草稿、扫码、差异、批准和撤销；并发销售产生明确冲突，不能静默覆盖。
- 消息状态区分“打开外部应用”“人工确认已发”和真实 provider delivered/read/failed；回执必须验签。
- 日结只在退款投影稳定后启用；差异有原因、审批和审计，不声称是完整会计总账。

### 11.4 定向验证

- 返修：无来源、跨店来源、过期保修、重复创建、角色拒绝、原历史不可变。
- 盘点：空盘点、部分扫码、并发销售、重复扫码、批准失败、回滚与权限。
- 消息：无 consent、撤销 consent、回执重放/伪造、provider 超时、失败重试与人工状态。
- 日结：现金/非现金、部分退款、跨日退款、差异、重开和审计。

### 11.5 风险升级与停止条件

- 返修或盘点会改写历史业务事实、产生负库存或跨店引用：P0/P1，停止。
- provider 回执无法可靠验签或 consent 状态不可信：不启用自动发送/送达承诺。
- 退款尚未稳定或财务投影不一致：日结只保留设计，不进入发布。
- 任一模块需要批量历史回填：拆出单独 migration/backfill 包，先做 dry-run 和恢复证明。

## 12. Phase 6：单一受控试点与季度收口（第 76–90 天）

### 12.1 范围与非目标

范围：从 Offline 普通开单和 Kiosk 单店试点中最多选择一个；回收成交仅在所有前置门禁满足时进入设计/Preview；选定下一季度一个增长项。

非目标：不并行开启多个高风险 dormant feature，不把 canary 直接视为全面发布，不让回收成交绕过法律或隐私审批。

### 12.2 工作包与模块

| WP | 模块与范围 | 负责人角色 | 依赖 | 预计投入 | 完成产物 |
|---|---|---|---|---|---|
| WP6-1A | Offline 普通开单 canary | Product + Backend + Frontend + Security + QA/Ops | Outbox/冲突/RPC、安全设备存储、kill switch | L | 单店/少量账号 canary；付款、凭据、附件、消息明确排除 |
| WP6-1B | Kiosk 单店试点 | Product + Frontend/Backend + Privacy/Legal + QA/Ops | 配对、签名、撤销、法律文本、kill switch | M/L | 单店试点、客户提交审核、实时/恢复与撤销证据 |
| WP6-2 | 回收成交 Finalize 的条件性设计或 Preview | Product/Finance + Data + Security/Privacy/Legal | 法律、保留、付款、证据、原子写入全部通过 | L | 协议、付款、证据、库存的全回滚原子合同；条件不足则不实施 |
| WP6-3 | 下一季度增长项选择 | Owner + Integration Lead + Product | 90 天结果与容量 | S | 在报价自助确认、预约、技师工时中只选一个的决策记录 |

### 12.3 选择规则

- Offline 与 Kiosk 二选一；默认选择前置条件更完整、回滚更明确、客户和数据风险更低的一项。
- Buyback Sensitive 不参与二选一，只有法律、隐私、证据保留、付款和原子 Finalize 全部获批后才能单独进入。
- 若 Phase 1–5 仍有当前 P1，Phase 6 不启动新试点，改为清理已知阻塞。

### 12.4 验收标准

- Offline 仅允许普通开单；账号/店铺不匹配拒绝；冲突不静默覆盖；付款、凭据、附件和消息不进 Outbox。
- Kiosk 客户提交不能直接覆盖主数据；配对可撤销；法律文本、签名、实时恢复和 kill switch 可证明。
- 试点有明确门店、账号、时间窗、成功指标、失败阈值、观察负责人和一键关闭路径。
- 下一季度只选择一个 P3 增长项，并写出业务指标、隐私/安全门禁和不做项。

### 12.5 定向验证

- Offline：断网、重启、过期身份、换店、重复提交、冲突、服务端拒绝和恢复。
- Kiosk：配对过期、错误门店、客户修改、员工审核、签名、撤销、弱网和设备丢失。
- Buyback：原子失败注入，证明协议、付款、证据和库存不会半完成。
- canary：仅观察预先定义的成功/失败指标，不用主观“看起来正常”替代证据。

### 12.6 停止与回滚条件

- 任何跨店、越权、客户数据泄露、重复写入或无法关闭的行为立即 P0/P1 停止试点。
- kill switch 未被实测、回滚锚点不明确或值班责任人缺失：No-Go。
- canary 达到冻结的失败阈值：先关 flag，再保全证据；不在生产现场连续打补丁。
- 法律/隐私/保留任一未批准：Buyback Sensitive 保持关闭。

## 13. 30 / 60 / 90 天交付节奏

### 第 30 天检查点

必须完成：

- 退款/冲正合同冻结。
- 恢复与租户只读/隔离方案完成；若获授权，至少形成初次实证；未获授权则明确 Blocked。
- Privacy/API 四项最小变更完成或分别给出清晰阻塞。
- Inventory/Orders 量测基线与分页阈值决策规则完成。
- 首批风险导向 E2E/DB CI 有不可静默跳过的证明。

第 30 天 Go 条件：没有未处理 P0；退款金额/权限合同无方向冲突；分页已有量测；相应 DB/生产工作有授权与回滚前置。

### 第 60 天检查点

目标完成：

- 退款/冲正在 Preview 通过金额、幂等、CAS、权限、审计、报表和失败注入。
- Inventory/Buyback 新旧路径 shadow compare 通过冻结阈值，旧路径仍可回退。
- 今日队列、全局搜索、采购工作台、Quick Entry 中按容量完成 2–3 项。
- 第一批 command envelope 在最关键域落地，不要求一次覆盖全部 mutation。

第 60 天 Go 条件：退款无当前 P1；分页无不可解释 mismatch；没有为了赶进度合并高风险发布；Offline/Kiosk 只选一个候选。

### 第 90 天检查点

目标完成：

- 返修/保修 Episode、盘点、消息状态、日结中至少两个达到 Preview 或小范围发布条件。
- Offline 或 Kiosk 最多一个完成受控试点，或因门禁不足被正确停止。
- Buyback Sensitive 要么通过所有前置条件进入独立包，要么继续保持关闭。
- 下一季度只选一个增长项，并以实际 90 天证据重新排序剩余 backlog。

第 90 天完成条件：交付证据和未知项清晰分离；所有试点可关闭；所有未完成项保留 owner、原因和下一决策点。

## 14. 工作包依赖与编排

### 14.1 关键依赖链

1. 恢复合同 → 隔离恢复证据 → DB migration/不可逆操作资格。
2. 租户矩阵 → 生产只读对账 → 多店、权限和平台支持资格。
3. 退款合同 → 原子数据层 → 应用层 → 报表投影 → 日结。
4. 性能量测 → 分页阈值 → additive API → shadow compare → 新路径切换。
5. consent 生命周期 → 消息 provider 回执 → 发送/送达中心。
6. command envelope → 盘点、回收成交、Offline 等高风险写入。
7. Quick Entry 状态证据 → 扩大正式使用；任何 API/schema 耦合另建包。

### 14.2 允许的并行

- Phase 1：恢复/租户只读方案与退款合同可并行，二者不共享写入路径。
- Phase 2：Privacy/API 小包可按互斥文件所有权分开，但同一模块保持单一写入者。
- Phase 3：退款与分页可并行，前提是 API/schema/migration 所有权不重叠；否则顺序执行。
- QA/Security 可以独立只读复核，但不能代替 Integration Lead 改范围或写修复。

### 14.3 禁止的并行

- 退款数据 migration 与日结实现。
- 分页切换与旧读取删除。
- Offline、Kiosk、Buyback Sensitive 多项同时生产试点。
- 同一 router/schema/types 公共区域由多个 writer 同时修改。
- 生产权限修复与同一时间的多店扩张。

## 15. 测试与证据矩阵

| 能力 | 最小验证 | 模块完成验证 | 发布前验证 | 核心证据 |
|---|---|---|---|---|
| 恢复 | Runbook dry-run | 隔离 DB+Storage 恢复与失败注入 | RPO/RTO、关键对象抽样、恢复负责人签字 | 恢复日志、对象清单、时间戳、失败原因 |
| 租户/权限 | policy/grant 静态对账 | 双店正反矩阵 | 生产只读差异关闭或正式接受 | 脱敏矩阵、拒绝响应、policy hash |
| consent/API | unit + API integration | 浏览器 URL、body、Origin、错误 envelope | 受影响核心流程 smoke | 测试结果、requestId 样例、无 PII 日志检查 |
| 退款 | 金额/状态 unit | RPC/integration + 角色 browser | Preview E2E、失败注入、报表一致性 | operation receipt、台账/余额对账、审计 |
| 分页 | repository contract | 10k/50k、筛选/排序/cursor | shadow compare、p95 与回退演练 | 固定数据集、指标对比、mismatch 清单 |
| 今日队列/搜索 | selector/query unit | 角色、局部失败、权限 browser | 核心角色 smoke + a11y | 分组/去重/权限证据、URL 检查 |
| 采购/盘点 | 数量和状态机 unit | 并发 integration + 角色 browser | 负库存、批准/撤销、回滚演练 | 库存前后对账、冲突 receipt、审计 |
| Quick Entry | component state tests | 六宽度 browser + 键盘/触摸 | Preview 核心流程与 a11y | viewport 截图/几何、焦点与最后项证据 |
| Offline/Kiosk | 状态机与安全 unit | 弱网/重启/配对/冲突 E2E | 单店 canary + kill switch | canary 指标、关闭证明、异常清单 |

证据不得包含 secret、完整客户 PII、生产凭据或不必要的原始客户数据。

## 16. 发布决策门槛

### 16.1 Local / CI → Preview

全部满足才可进入 Preview：

- 范围合同未漂移；若漂移已有 Plan Delta 和风险重分类。
- 定向 lint/typecheck/test 或 SQL/browser 检查通过。
- 验收与失败路径都有证据；环境缺失没有被静默 skip。
- 高风险数据变化是 additive，兼容路径和回滚顺序已写明。
- 当前工作包没有未解决 P0/P1。

### 16.2 Preview → Production

全部满足才可建议生产发布：

- Owner 对生产发布有明确授权；Preview 成功不等于生产授权。
- exact SHA、部署目标、环境差异、migration/flag 顺序和回滚锚点已固定。
- 受影响模块完成一次模块 QA；高风险包完成一次 Security/Data/Release 独立复核。
- 若涉及 DB、权限、支付、隐私或外部消息，相应恢复/租户/法律/consent 门禁已满足。
- 观察指标、阈值、时间窗、负责人和停止条件已登记。

### 16.3 No-Go

任一条件成立即 No-Go：

- 已证实 P0，或直接破坏当前验收的 P1 未解决。
- 无法证明回滚，或需要未演练的破坏性 down migration。
- 生产目标、权限、store、数据范围或 feature flag 状态不明确。
- 测试环境缺失却被标记为通过。
- shadow compare 存在不可解释的数据漏项、重复或金额差异。
- 当前包引入未批准的新模块、依赖、公共接口、schema 或权限。

## 17. 回滚策略

### 17.1 应用代码

- 保留发布前 exact SHA 和上一 READY deployment。
- 优先通过 feature flag、adapter 或路由选择切回旧路径。
- 回滚后只验证受影响核心故事和数据一致性，不重复全站扫描。

### 17.2 数据库与数据

- migration 默认 additive：先新建、兼容读写、shadow compare，再考虑未来清理。
- 不以未演练的 destructive down migration 作为主要回滚。
- 写入错误优先 forward-fix；需要数据恢复时必须使用已验证备份并取得 Owner 授权。
- backfill 必须先 dry-run、计数、分批、可重入、可暂停，并保留前后对账。

### 17.3 Feature flag 与试点

- Offline、Kiosk、Buyback Sensitive、Lifecycle、Inventory V2 都需要已实测 kill switch。
- canary 触发失败阈值时先关闭 flag，再保全日志、operation receipt 和脱敏样本。
- 不在故障现场扩大账号、门店或功能范围。

### 17.4 外部消息与支付

- 消息 provider 失败不回滚已提交的核心业务；通过 outbox/retry 表达。
- 退款失败不得修改原付款或余额；只有原子 receipt 成功才视为完成。
- 不通过手工改账或删除台账“修复”退款问题。

## 18. P0–P3 升级准则

| 级别 | 定义 | 当前行动 | 是否扩大范围 |
|---|---|---|---|
| P0 | 已证实的数据泄露、生产故障、越权写入 | 立即停止相关操作，保全证据，进入事件响应并汇报 Owner | 只扩大到止损、恢复和证据所需范围 |
| P1 | 已证实会让当前验收不可用、产生错误写入或直接破坏本工作包 | 阻塞当前包；一次定向根因分析、一次修复和一次相关复验 | 仅修复直接原因；新模块/公共接口仍需 Plan Delta |
| P2 | 高价值体验、可靠性或业务闭环问题，但不破坏当前验收 | 登记 owner、证据与建议；不阻塞当前交付 | 不自动扩大 |
| P3 | 长期增长、架构卫生或优化候选 | 进入季度 backlog，按数据重新排序 | 不自动扩大 |

“可能有风险”“相邻模块也许受影响”不足以升级为 P1。升级必须给出受影响的当前验收、复现步骤、错误写入或明确证据。

## 19. 避免重复 QA 与范围蔓延

### 19.1 唯一验证基线

每个工作包记录以下六项指纹：

1. source SHA / diff；
2. dependency lock；
3. runtime/config；
4. schema/migration；
5. test target；
6. 风险与验收范围。

六项均未变化时，成功验证结果直接复用，不重复执行。

### 19.2 验证轮次预算

- 单次局部改动：一次定向验证。
- 模块完成：一次模块 QA，并验证一个核心用户流程。
- 发布前：一次最终 build/E2E/风险专项验证。
- 最终验证失败：只允许一次定向修复和一次相关复验。
- 同类第二次失败：停止盲目补丁，转为根因分析。

### 19.3 QA/Security 边界

- QA/Security 只验证当前范围、证据、风险和阻塞建议。
- 最终 QA 新发现的范围外 P2/P3 只登记，不开启下一轮全项目整改。
- 只有源码、依赖、配置、schema、测试目标或已证明风险范围发生实质变化时，才开启新验证轮。

### 19.4 Plan Delta

计划变化必须记录：

- 原范围与新范围；
- 变化原因和证据；
- 新增模块/API/schema/权限/依赖/生产影响；
- 风险从何级变为何级；
- 验收、验证和回滚如何变化；
- 是否需要 Owner 重新批准。

未经 Plan Delta，不允许以“顺手修一下”为理由扩大工作包。

## 20. 文件影响规划

现有优化报告只提供模块级证据，没有为未来实现授权精确文件 allowlist。因此每个实施包开始前必须重新审计并冻结路径；以下只表示候选模块，不是写入授权：

| 工作包 | 候选模块 | 必须隔离的区域 |
|---|---|---|
| Privacy/API | customer search state、customer repository/schema、API catch-all、error/requestId | 历史数据回填、生产配置另包 |
| 退款 | orders/payment types、schemas、router/repository/RPC、order detail、financial projection | 日结、外部 provider、旧台账清理另包 |
| 分页 | inventory/buyback repositories、API contracts、list screens、query keys、tests | 旧读取删除、Inventory V2 flag 另包 |
| 今日队列/搜索 | dashboard、command palette、domain search projections | 第二个 shell trigger、客户公网搜索禁止 |
| 采购/盘点 | parts/inventory domain、quantity allocation、approval UI、audit | 供应商付款与完整会计另包 |
| Quick Entry | 现有 inventory form/workspace/catalog fields、paired tests/stories | API/schema/permission/tenant/dependency 变化需新包 |
| Offline/Kiosk | 现有 Outbox/conflict 或 pairing/review/consent 模块 | payment、unlock credential、attachment、message 不进入 Offline 首期 |

若候选路径触及共享 router/schema/types，必须指定单一写入者并先做最小接口抽取；不得借机全面重构。

## 21. 首个 1–2 周可直接执行 Checklist

以下清单在相应 Owner 授权范围内可直接作为第一个 Sprint 的执行顺序；它本身不替代授权。

### Day 1：组合启动

- [ ] Integration Lead 创建唯一工作包看板，字段固定为 Done / Remaining / Blocked / Next。
- [ ] 为 WP1-1 至 WP1-6 指定角色 owner、唯一 writer 和 reviewer；不要求并行启动全部。
- [ ] 记录当前 source/deps/config/schema/test-target/risk 基线。
- [ ] 把现有未跟踪文件和其他任务资产列为“非本 Sprint 所有”。
- [ ] 向 Owner 只提交两个必要批准问题：生产控制面/权限只读核查；后续 R3/R4 实施是否只到 Preview。

完成条件：没有身份、所有权、允许路径或审批歧义。

### Day 2–3：退款/冲正合同

- [ ] Product/Finance 列出现金、原路、部分、多次、超额、重复和跨日退款故事。
- [ ] 冻结角色和权限：谁申请、谁执行、谁查看、谁能导出。
- [ ] 定义原付款引用、可退余额、operation id、CAS/409、不可变台账和审计/revision。
- [ ] 定义余额、毛利和未来日结投影；明确外部通知使用 outbox。
- [ ] Security/QA 用失败注入和越权故事复核。

完成条件：所有金额不变量、失败结果和回滚顺序都有可测试答案；不写生产。

### Day 2–4：恢复与租户计划

- [ ] Data/Ops 列出 DB、三个私有 bucket、密钥/凭据边界和恢复顺序。
- [ ] 定义隔离环境、最小化测试数据、RPO/RTO 计时方法和对象关联抽样。
- [ ] Security 定义 RLS/ACL/default ACL/function grant/Storage policy 只读采集字段。
- [ ] QA 建立双店 read/write/search/export/attachment 正反矩阵。
- [ ] 若未获生产只读授权，将状态标为 Blocked，不用本地推断代替。

完成条件：Runbook 与矩阵可由另一个执行者重复；没有生产写步骤。

### Day 4–6：Privacy/API 快速安全批准备

- [ ] 审计并冻结四个独立 allowlist：consent、PII URL、safe error/requestId、body/origin。
- [ ] 为 consent 定义省略、false、true、撤销和历史 unknown 语义。
- [ ] 为搜索定义 URL、刷新、后退、分享链接和同标签页状态。
- [ ] 为 API 定义默认 body 上限、Content-Type、Origin 和未知错误 envelope。
- [ ] 为每个小包建立 unit/integration/browser 验收，禁止合并成大重构。

完成条件：每项都能独立实施、验证、发布和回滚。

### Day 5–7：性能与分页合同

- [ ] 定义 Inventory/Orders 的 row count、scanned rows、round-trip、p50/p95、内存和 cold start 指标。
- [ ] 禁止记录搜索词、完整客户 PII 或解锁凭据。
- [ ] 建立 10k/50k synthetic 数据集规范。
- [ ] 定义旧/新筛选、排序、facet、cursor 和 thumbnail 的 shadow compare。
- [ ] 根据证据冻结阈值；没有证据时不拍脑袋填数字。

完成条件：分页实施有测量方法、兼容合同和切回旧路径的方法。

### Day 6–8：CI 与 a11y 门禁合同

- [ ] 映射 Orders、Customers、Inventory、store switch、permission 到 required story。
- [ ] 设计可信 baseline migration + RLS/grant/search-path SQL/pgTAP job。
- [ ] 为六个核心模块选取第一批 axe 常态/错误/Dialog/Sheet 故事。
- [ ] 设计故意破坏测试，证明环境缺失和关键回归不会静默 skip。
- [ ] 冻结验证轮次预算和证据复用规则。

完成条件：每条门禁都有失败示例、owner 和证据位置。

### Day 9–10：Sprint Gate Review

- [ ] Integration Lead 汇总 Done / Remaining / Blocked / Next，不汇报未执行命令为成功。
- [ ] Product/Finance 签认退款合同；Security/Data 签认恢复/租户/Privacy 风险。
- [ ] QA 确认所有验收映射到验证；Release 确认 Preview/生产门槛和回滚锚点。
- [ ] 将范围外 P2/P3 放入 backlog，不加入当前实施。
- [ ] Owner 只需决定：哪些包进入第 11–30 天实施、是否授权生产只读、是否只到 Preview。

完成条件：第 11 天可以在无方向歧义、无写入冲突和有明确回滚的情况下开始首个实施包。

## 22. 首批实施顺序建议

若第 10 天门禁通过，建议按以下顺序进入实施：

1. API safe error/requestId + 默认 body/origin 基线。
2. 客户搜索 PII 不进 URL。
3. consent 默认拒绝；若涉及 migration/历史数据，立即拆包并升级审批。
4. required E2E/DB CI 最小门禁。
5. Inventory/Orders 量测，不先做分页切换。
6. 隔离恢复演练与生产租户只读对账，取决于授权。
7. 第 30 天 Gate 后才开始退款与分页 Preview 实施。

这一路径让低耦合安全改进先交付，同时不给未经证明的数据库和生产状态附加成功结论。

## 23. 阶段关闭模板

每个阶段只用以下五项关闭：

### 完成

- 实际交付物、exact SHA/路径、通过的验收。

### 剩余

- 未完成工作、owner、下一决策日期。

### 阻塞

- 明确证据、受影响验收、需要的授权或外部状态。

### 下一步

- 唯一下一工作包，不把全部 backlog 同时启动。

### 验证

- 实际执行的命令/故事/环境、复用的证据及未运行原因、回滚证明和已知风险。

## 24. 本路线图当前状态

### Done

- 优化报告中的 P1、P2、P3 已编排为阶段、工作包、角色、依赖、投入、验收、验证、发布、回滚和停止条件。
- 30/60/90 天里程碑与首个 1–2 周执行清单已定义。
- 已明确如何避免重复 QA、范围蔓延、多个高风险 feature 并行和未经授权的生产操作。

### Remaining

- 所有实施、生产只读核查、Preview 和发布仍需按工作包分别授权和执行。
- 负责人姓名、实际团队容量、生产只读权限和性能阈值需要在 Phase 0/1 冻结。

### Blocked

- 路线图文档本身无阻塞。
- 恢复实证、生产租户对账和任何生产/数据库/支付/权限/隐私操作，在取得对应 Owner 授权前保持阻塞。

### Next

- 先执行 Phase 0 和 Day 1 checklist；随后并行推进退款合同与恢复/租户只读方案，最多两条不重叠轨道。

## 25. 文档验证说明

- 本路线图只依据 `docs/PROJECT_OPTIMIZATION_REPORT_2026-09-04.md` 编排，没有读取新的产品事实来扩大结论。
- 本轮只创建本 Markdown 文件，不修改产品代码、配置、数据库、远端或部署。
- 因没有源码、依赖、配置、schema 或测试目标变化，不重跑 lint、typecheck、test、build 或 browser QA。
- 本轮没有 UI 变更，无相关任务页面可截图；文档路径和文件级差异检查是替代证据。

<a id="ui-consistency-20260912"></a>

## 26. UI 一致性与渐进实施计划（2026-09-12）

### 26.1 目标与采用状态

用户要求：在上一轮方案上寻找更适合 UI 一致性的 Skill，加入项目并完善执行计划。2026-09-12 已完成 U0 与 U1/U2 的首个本地代表切片：桌面详情报价编辑器迁入既有共享报价行和三金额条，并统一中英意校验展示。U1/U2 其余范围及 U3–U7 仍待实施；这不代表全站迁移或部署完成。此次没有安装第三方 CLI、运行其安装脚本或修改依赖。

目标是“现代触控工作台”：浅灰背景、白色紧凑表面、蓝色主操作、清楚的状态和轻量反馈。手机/iPad/桌面复用同一视觉和业务控件，分别优化排版；保留用户既有功能、复杂业务逻辑与手机操作链。工单列表与详情保持独立层级。

沿用模块化单体、Next.js App Router、现有 Radix/shadcn、Tailwind、React Query、Storybook 和浏览器测试。以完整用户故事逐批迁移，避免用另一个大型组件替换当前大型页面。文件行数和 Hook 数量只用于定位维护热点，不单独构成缺陷或重写理由。

### 26.2 Skill 选型与使用边界

核验日期 2026-09-12，来源为官方/作者仓库；远端 main 可能变化，后续真正引入外部包时再核对版本、许可证、脚本和适配成本。

| 候选 | 结论 | 在项目中的实际落点 |
|---|---|---|
| [Impeccable](https://github.com/pbakaus/impeccable) | 更适合补强当前计划；Operate 强调任务完成、一致性与可扫读，audit/polish/harden 覆盖检查与整理 | 采纳方法到既有 ui-ux-review，避免整包生成新的 PRODUCT.md/DESIGN.md；当前公开版本不能把旧 normalize 名称当成已可执行命令 |
| [Vercel Web Design Guidelines](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md) | 采用可定位的代码检查方法 | 标签、焦点、触控、溢出、国际化等按业务场景检查；[规则源](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)不是所有项目通用的硬性产品决策 |
| [design-system-skill](https://github.com/apurvkhare/design-system-skill) | 借鉴“实际组件 API + 运行时渲染”共同验证的思路 | 不复制外部组件 API 快照；指向本仓库真实源码与 Storybook，避免快照过期 |
| [NewMediaStudio/design-system-skills](https://github.com/NewMediaStudio/design-system-skills) | 参考设计差异检查与文档映射思路 | 先用现有代码/stories建立基线，当前不引入整套 Figma 同步和额外生成链 |
| 现有 ui-design-workflow + 项目 ui-ux-review | 正式工作入口 | 前者负责设计和浏览器证据；后者提供项目组件、业务和三端约束 |
| Hallmark、frontend-design、Emil、UI/UX Pro Max | 延续上一轮选型，按需参考 | 不同时加载多套视觉指令，不替换品牌与项目规范 |
| GSAP、Scroll World、大量 React Bits 动效 | 暂不纳入后台实施 | 沿用现有动效栈；只有明确任务收益才增加效果 |

对外部规则的本地裁决：英文 Title Case 不强加给意大利语；敏感搜索词、客户资料、密码不能因“状态深链接”进入 URL；列表虚拟化依据实测而非固定条数；保存禁用策略、危险确认和自动保存遵循现有业务合同。不能靠隐藏 overflow 掩盖被裁掉的操作。

### 26.3 唯一来源与框架职责

| 层次 | 现有来源 | 后续维护约定 |
|---|---|---|
| 工作入口 | AGENTS.md → .agents/skills/ui-ux-review/SKILL.md | Skill 指向规范，不保存第二套色值、状态枚举或业务规则 |
| 视觉说明 | docs/DESIGN_SYSTEM.md | 记录品牌、尺寸角色、允许变体及已迁移组件；与实际实现冲突时先核验再同步 |
| 设计值 | src/styles.css | 保持唯一颜色源；以基础/语义/组件角色梳理现有变量，迁移期保留兼容别名 |
| 布局/控件配方 | src/lib/ui-patterns.ts、src/lib/component-patterns.ts | 前者管理布局，后者管理控件密度和表面；禁止在两个文件重复拥有同一职责 |
| 基础/领域控件 | src/components/ui/*、src/components/orders/*、src/features/*/components | 先复用再扩展；状态显示使用既有 meta，通用组件不承担业务 mutation |
| 编辑合同 | docs/GLOBAL_CONTENT_EDITING_STANDARD.md | 外壳与编辑会话分离；金额、权限、版本冲突、草稿保存仍由领域控制器负责 |
| 可运行证据 | 现有 *.stories.tsx、组件测试、E2E | Storybook 展示真实组件；渲染与完整操作都通过后才认定迁移完成 |
| 计划 | 本节 | 唯一 UI 专项执行清单；原业务路线图继续管理安全、数据与业务能力 |

Figma 后续若参与，作为组件和变体的设计映射；代码 tokens 与组件 API 保持实现来源。先整理代表组件再同步，当前不创建 Figma 文件或第二套变量值。

### 26.4 先处理的规范冲突

| 当前文本/历史建议 | 本专项采用的约束 | U0 应完成的同步 |
|---|---|---|
| RESPONSIVE_DENSITY_PLAN 的“桌面详情弹窗优先” | 用户已要求列表是列表、详情是详情；保留独立详情路由 | 将工单默认规则更新为独立详情；其他实体逐项核验，不全局改路由 |
| GLOBAL_CONTENT_EDITING_STANDARD 的“低于1024统一底部编辑器” | iPad 可复用桌面工作台并做触控适配，不能按宽度机械套手机壳 | 为新建/报价/身份编辑补充 iPad 竖横屏尺寸与短高度例外；保持同一编辑会话 |
| 旧库存合同把768列入手机/平板独立结构 | 本轮工单的最新目标不自动撤销库存特殊合同 | 轮到库存时独立验证并定向同步，不在工单批次修改历史库存证据 |
| 所有弹窗同大小 / 硬性三列 / 一屏绝不滚动 | 同层级一致，不等于所有内容同尺寸 | 简单选择、普通编辑、复杂工作台分档；长内容允许正文滚动；主要动作可达 |
| 上一轮直接提出全局 Overlay Controller | 先统一结构和生命周期约定，复用现有 Radix、mobileEditor 和键盘宿主 | 从一个报价/新建流程证明抽象；足够相同的行为才提取共享机制 |
| DESIGN_SYSTEM 中旧装饰组件/默认动效建议 | 使用已核验的真实调用与最新工作台视觉 | 核验未使用候选和实际视觉，标记废弃而非按扫描结果直接删除 |

这些裁决指导后续本专项；保留历史发布与审计记录。当前只登记冲突，实际规范迁移在 U0 完成后标注新版本和范围。

导航折叠、内容分栏、编辑表面三种阈值分别管理，不能通过全局修改 `md/lg` 一次解决。`ui-patterns.ts` 已有按容器680px切换的 `orderDetailWorkbenchGrid`，也保留按视口768px使用2:1布局的 `orderDetailGrid`；U0先确定调用范围。低于1024px使用底部编辑器属于编辑表面合同，并不意味着整张 iPad 页面必须使用手机布局。

### 26.5 执行工作包

所有候选路径均需在开工时 `rg` 核对真实调用和当前 Git 状态。各包只改变自己的目标；共享样式/配置串行写入。不以本节替代实施证据。

| 工作包/规模 | 依赖与范围 | 产物和退出条件 |
|---|---|---|
| U0 基线与规范对齐 / S | 最先执行；上述设计、响应式、编辑规范及相关 stories/E2E | 组件复用表、规范冲突裁决、三端三语言代表截图、状态/操作基线；明确哪些问题可复现、哪些已在当前代码修复 |
| U1 交互可靠性 / M | U0；new-order-screen、navigation-guard-provider、金额键盘及相关编辑器 | 修复复现的问题；放弃只执行一次、草稿不复活、背景不穿透、旋转不丢内容、关闭可达。保留敏感解锁信息仅内存保存的边界；通过相关组件及浏览器链路 |
| U2 组件与 token 收敛 / M | U0；styles、两类 patterns、badges、故障选择器及现有基础控件 | 现有控件职责/尺寸/状态统一，保留兼容别名；代表 stories 覆盖三端和语言；只迁移代表调用点，没有无关全站 CSS 重写 |
| U3 工单代表页迁移 / M | U1+U2；详情、新建、总览、报价/身份编辑组件 | controller 与展示面板逐块分离；列表/详情独立；报价摘要仅总额/定金/待付，报价项目编辑入口完整。三端入口→编辑→校验→保存→重开可用 |
| U4 其余页面渐进推广 / 按模块M | U3通过；先工单列表/AppShell，再客户，再库存/采购/回收/设置 | 每次一个模块，采用相同基础组件、各自布局；导航、筛选、分页、权限与返回位置保留，所有改动模块各有三端代表故事 |
| U5 性能与语言 / 分离S/M包 | U0测量后可独立准备，修改共享区域时与U2/U3串行 | 先核验打印加载链再按需加载；保留打印准备/恢复与浏览器手势时机。语言按域分批拆并保留类型、缺失键回退与加载行为。性能改动有同环境前后证据 |
| U6 差异门禁与清理 / S起步 | U2建立组件基线后；Storybook、已有E2E、knip及规则脚本 | 新增样式差异有可定位告警；允许的打印/图表/相机差异有说明；Knip排除历史产物后再确认未使用项。删除与迁移分批，可恢复 |
| U7 发布候选 / S | 本次纳入发布的所有工作包验收完成 | 发布范围、实际提交、CI、三端功能/视觉、回滚锚点与目标环境一致；按用户发布授权执行，记录真实部署与线上验证 |

S/M 仅表示相对工作量，不承诺固定日期。功能页仍在变化时先完成一个代表故事，不并行铺开全部模块。业务原路线图的安全/数据门禁不因本 UI 计划失效。

U5 的候选打印入口为 `src/features/orders/print/use-fixed-order-pdf-print.ts`；路由初始包不能只凭静态文件大小断言已提速。首次打印模块失败应可重试，不能因延迟 import 丢失浏览器打印窗口的用户手势许可。

### 26.6 三端布局与操作合同

- 桌面/iPad：以内容可用宽度为准，客户、设备、金额区域使用约束网格；空间足够时三栏，不足时两栏重排。短高屏和系统键盘出现后，标题/关闭/主要操作仍可达。不用固定列宽保证“等高”，不为填满空白增加无关内容。
- 手机：保留当前单列与操作链，字段直接进入相应编辑器。底部操作与安全区/键盘协调，正文有足够尾部空间，不能被固定按钮遮挡。
- 统一组件风格不等于统一 DOM 顺序；DOM 阅读/焦点顺序跟随布局任务。旋转/尺寸变化不改变实体会话，不使输入重置或光标跳动。
- 简单选项使用清楚的单选/多选视觉；随附物品包括无/已有/其他值的完整语义。已保存单值与本地草稿单值不同，不能全部套自动保存。
- 明确设备保管状态、工单维修状态与通知状态的区别；进度条使用真实流程映射，手动流转权限、时间线和审计继续沿用既有规则。
- 表格/列表/状态板共享数据分组与状态映射，布局各自表达；不因换视图改变队列数量、金额或下一步动作。

### 26.7 验收矩阵与衡量方式

| 范围 | 代表环境 | 必查结果 |
|---|---|---|
| 手机 | 390×844、430×932；触控/WebKit | 单列、草稿取消、键盘开合、随附物品、图形滑动及点击替代；关闭/保存/首个错误可达 |
| iPad | 820×1180、1180×820；补1024×650短高 | 竖横屏、抽屉导航、键盘与旋转、弹层内滚动、背景锁定、焦点不丢 |
| 桌面 | 1280×800、1440×900；鼠标/键盘 | 列宽、长文本、菜单、Tab/Escape、返回位置和打印 |
| 语言 | zh/en/it，至少每语言覆盖三设备类的代表故事 | 单一语言标签、长译文不遮挡、Intl格式正确；密码/标识符不被翻译或擅改大小写 |
| 状态 | 按受影响组件覆盖正常/空/加载/失败/无权限/保存中/冲突 | 禁用原因可解释，失败保留编辑、重复提交受控、错误不泄露敏感数据 |

日常批次选择受影响的组合；共享弹层、键盘或布局修改补足相关组合，发布候选覆盖纳入发布的三端三语言主要链路，不要求每次微调重跑全部笛卡尔积。浏览器模拟可验证视口与触控事件，真实 iPad/Safari 系统键盘仍需设备证据，不能混称完成。

优先复用下列测试，不重复建立同内容套件：`order-detail-responsive-single-renderer.spec.ts`、`order-detail-ui-preservation.spec.ts`、`order-detail-combined-save.spec.ts`、`i18n-order-detail-release-2b2.spec.ts`、`visual-overflow.spec.ts`（均在 `tests/e2e/`）。`order-detail-touch-workbench.spec.ts` 在 2026-09-12 独立抽样时已有 6/10 断言落后于当前页面类名、入口与布局，迁移整套断言前不作为本专项发布门禁，也不做单行补丁制造局部假通过。新代表闭环使用 `order-quote-consistency.spec.ts`。旧 single-renderer 测试把834归为compact、1024归为desktop；更新分类预期时保留单一渲染树、旋转不丢草稿的行为保护，并补768/834等实际边界宽度。三语言测试已有强制合成环境检查，不得绕过。Storybook 当前为4个 stories 文件，包含多个场景，不能误写成只有4个故事；扩展真实页面 fullscreen 容器及现有 a11y 配置，并以实际运行记录证明门禁生效。

衡量指标：新增未登记 token/重复状态映射为0；页面级横向溢出为0；被遮挡的关闭/主要操作为0；迁移故事的功能回归为0；每个新共享变体有真实调用及相应 story/测试。功能测试重点是行为不变量，不以固定文件行数或截图像素完全相同为完成标准。

记录同数据/同视口下的操作次数、主要任务滚动距离、菜单可达性与性能基线；预算在 U0 实测后确定。保护触控命中区，紧凑选择器若沿用已有小尺寸例外，必须验证相邻误触和完整标签，不能用“高密度”取消可用性检查。

### 26.8 首批执行与完成状态

已完成的第一批：核验当前草稿与键盘修复结果；形成共享组件复用表；将桌面详情报价编辑器迁入 `OrderWorkspaceQuoteRow` 与 `OrderWorkspaceMoneyStrip`；统一桌面、compact 和页面级报价校验展示；新增合成数据代表闭环。未改变业务保存条件、金额计算、权限、版本、审计、API、数据库或依赖。

第一批证据：组件测试 42/42；TypeScript、定向 ESLint、`agents:check` 与 `git diff --check` 通过；Chromium 390/820/1180/1440 × zh/en/it 为 12/12，WebKit 补充矩阵为 8/8。截图位于 `artifacts/TASK-20260912-002-ui-consistency-framework/writer/`。

下一批：补代表 Storybook 状态；收敛新建报价目录仍存在的意大利语次行重复；随后按工单列表/AppShell、客户、库存/采购/回收/设置分域推广。U1/U2 未覆盖部分和 U3–U7 仍未完成；物理 iOS/iPadOS 键盘、发布 build、提交、推送与部署均未执行。

### 26.9 2026-09-13 用户批准的全屏延续批次

用户批准细化全项目真实子菜单的思维导图并开始执行。本次优先级调整为先验证商品新增的完整页面入口，不代表工单及其余模块已完成迁移。完整任务采用全屏工作台，短选项与简短确认留在任务内；浏览器打印窗口、权限、交易和持久化合同保持不变。

- 已核对真实菜单及设置 section：配件采购当前在默认规则和工单配件流程中，不新建虚构一级菜单；消息模板不等于消息收件箱；库存预订、销售和售后按实际能力开关区分。
- Run 2 首个代码切片：商品列表及快捷新增入口统一到既有 `/inventory/new`；兼容旧 `workspace=new-product` 意图并保持权限检查。仅新增页 opt-in 全屏表单，iPad/桌面两列、手机单列，同一表单树；共享编辑页不自动迁移。
- 保留 IMEI2 当前可见性，成本继续遵守已有“不在销售工作台展示”的测试合同。本批不改表单校验、API、金额、幂等、离开保护、数据库、依赖或生产环境。
- 用户交付规划为工作区 `artifacts/fullscreen-inventory-plan-20260913/全屏工作台与商品录入设计方案.md` 第二版第17–19节；它是本节的细化交付附件，不另建项目级 roadmap。详细导图和截图随本批证据提供。
- 状态：本地商品新增切片已实现并完成定向验收；详细导图覆盖10个模块、60个子项。最终单测106项、独立保留合同测试29项、类型/定向ESLint与17个不同Chromium场景通过（含390/820触控选择器实际录入）。最后补修全屏失败/冲突/同步异常反馈置顶定位，390/820/1440复验通过。标识区域单列保证输入可读，返回状态仅使用按用户/门店/权限隔离的30分钟一次性标签页内存快照，不新增持久草稿。后续编辑/详情/销售、工单、客户/备忘/回收、设置等仍分批验收。物理iOS/iPadOS键盘未验证；此次无提交、推送或部署，证据见既有任务 EVIDENCE/HANDOFF。

### 26.10 2026-09-13 Run 3：全屏推广发布候选

用户已明确要求继续原完整规划、提供多个实页面预览，并在验证完成后推送main和部署。本节为最新状态，26.8–26.9的“本地/未发布”属于历史里程碑，不再作为本轮发布限制。

- 商品：新增与编辑使用既有独立路由和同一全屏表单；预设与手填收拢到同一选择器，保留品牌型号规范、IMEI2、校验、成本隐藏、幂等与失败草稿。主保存与连续录入仍保留原本的不同结果，不增加一步确认。
- 完整任务表面：复用现有Dialog/Sheet会话，显式选择`componentOverlay.taskWorkspace`；768px起采用贴近全屏的工作区、统一内容宽度和触控动作，手机保留既有紧凑操作链。不修改全局Dialog默认，也不按旋转重挂表单。
- 推广到客户新建/编辑/设备/跟进、备忘录、回收完整工作区、商品销售/验机、工单身份/报价/收款表面，以及设置成员/供应商/状态定义。客户默认详情回到既有独立路由；通知设置桌面/iPad采用编辑与静态预览并列，手机保留短预览。
- 短选择、危险确认、交易后果确认、扫码/相机、系统打印仍为有意例外；已有独立页的报表、工具、账号/平台和客户终端不为了“全屏”重写业务或开启能力开关。
- 修复这轮验证中定位到的键盘遮挡、客户返回上下文和通知重复ID；使用原tokens与状态元数据，不另建颜色体系或改变状态含义。
- 状态：源码候选已形成，最终门禁、模块覆盖矩阵和独立审查正在收尾，尚未发布。可运行合成预览位于3111；证据集中在当前任务`EVIDENCE.md`和`artifacts/TASK-20260912-002-ui-consistency-framework/fullscreen-run3/`。

完整菜单导图是能力与交互规划，不等于60个子项均新增代码或每个分支都已实机验收。U5性能/语言拆包、U6持续差异门禁等长期候选不自动混入本轮UI发布；真实iPhone/iPad系统键盘、相机和实体打印仍需实机确认。
