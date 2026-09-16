# RepairDesk 项目工作规则

状态：当前入口。最后精简：2026-09-15。历史入口见 [治理归档](docs/archive/governance-20260915/README.md)。

## 1. 任务入口与授权

- 中文沟通；老板用自然语言给目标即可，不需要填写模板、选择部门或维护内部状态。
- 先确认本项目 canonical root，保护已有未提交改动；不访问兄弟项目，不混用环境、凭据或业务数据。
- 规则优先级：最新老板指令 → 适用 AGENTS → 当前业务/安全声明 → 按需技能。历史任务状态和归档不能自动成为新任务授权。
- 默认 L2：范围明确、可逆的本地代码和文档修改直接推进。生产写入、发布、迁移、不可逆删除、真实支付/权限/隐私变更、秘密处理、付费服务、重大架构或依赖变更仍需明确授权；已有授权不重复询问。
- 验证事实、推断、方案、mock 与真实后台结果分开；不伪造完成、审批、测试或截图。

## 2. 并发与连续性

- 跨会话运行控制继续使用 [.ai-company/orchestration.json](.ai-company/orchestration.json) 与 [调度声明](docs/CROSS_SESSION_ORCHESTRATION_DECLARATION.md)。新顶层窗口/可能重叠的非微小任务先加载 `cross-session-orchestration`，核对 Registry、绑定身份并验证不可变 Context Packet。身份失败时保持只读。
- 身份来源：SQLite Registry → 已核验 Context Packet → 对应 Task Memory；`ACTIVE_CONTEXT.md` 只是前台提示。后台 new-task/checkpoint 保持它不变，除非明确 activate。
- 仅持有效项目 integration lease 的窗口可作为最终 Integration Lead 集成、关闭自身任务或报告最终完成。绑定/lease 不赋予写路径、Git、发布、迁移或生产权限；不得抢占有效 lease。
- 同模块单写。委派只传目标、路径、约束、验收和必要上下文；子代理默认只读，写入必须指定互斥所有权。
- Sub-agents report blockers to the Integration Lead. 子代理不直接向老板索取扩权，不 stage/commit/push/deploy、不处理秘密、不做最终集成。
- 能独立节省时间或提高质量才委派；不为“部门齐全”启动代理。默认 1 个附属代理，独立工作可并行 2–3 个，活跃子代理硬上限 3，禁止递归派单；长任务按 guard 更严格上限。
- 主线程与代理使用 `gpt-6-astra`；常规执行按难度选 low/medium/high，复杂跨模块 xhigh，关键风险至少 max。UI设计、样式实施及视觉复核必须实际运行 max；主线程未满足则显式委派 max。
- 预计超过30分钟、Goal/自动续跑、超过2个子代理或重复等待时，加载 `~/.codex/skills/long-running-task-guard/SKILL.md`；服从时间、等待和停止边界。
- 恢复先读当前任务的可靠检查点，仅补相关证据。复用 `.ai-company/memory/tasks/` 和现有状态源，不为普通问答另建日志，不存秘密、完整客户PII或隐藏推理。
- `.ai-company/policies/`、旧“AI部门管理”与部门名册均为按需参考；不再要求每个任务预读整套制度、生成RACI或做能力评级。

## 3. 按改动选择文档

| 改动 | 必要来源 |
|---|---|
| 跨模块逻辑/重构 | [ARCHITECTURE](docs/ARCHITECTURE.md) |
| mutation、React Query、跨设备同步 | [数据一致性](docs/REALTIME_DATA_CONSISTENCY_DECLARATION.md) |
| AppShell、Provider、预加载、租户清理、打印准备 | [启动与打印](docs/STARTUP_PERFORMANCE_AND_PRINT_READINESS_DECLARATION.md) |
| 页面/布局/控件 | [页面规范](docs/UI_PAGE_GENERATION_DECLARATION.md)、[组件规范](docs/COMPONENT_GENERATION_DECLARATION.md)、[响应式](docs/RESPONSIVE_DENSITY_PLAN.md)中实际相关章节 |
| UI一致性/编辑交互 | `ui-design-workflow`、[ui-ux-review](.agents/skills/ui-ux-review/SKILL.md)、[路线图§26](docs/PROJECT_EXECUTION_ROADMAP_2026-09-04.md#ui-consistency-20260912)、[编辑标准A](docs/GLOBAL_CONTENT_EDITING_STANDARD.md) |
| 手机详情/任务/报价/支付 | [RepairOS移动详情](docs/REPAIROS_MOBILE_DETAIL_STANDARD.md)、[浮动卡片](docs/REPAIROS_COMPACT_ARCHITECTURE.md) |
| 订单扫码/设备识别 | [扫码边界](docs/SCANNER_COMPONENT_BOUNDARY_DECLARATION.md) |
| 库存设备/Quick Entry | 对应当前业务声明及 [旧合同精确记录](docs/archive/governance-20260915/root-AGENTS.snapshot.md.txt)，核对适用范围后使用 |

## 4. 工程与业务底线

- 写代码前用 `rg` 查复用；Next.js App Router 的 `src/app/*` 保持薄路由，业务在 `src/features/*`，纯函数在 `src/shared/lib`，跨域实体规则在 `src/entities/*`。
- 客户端数据走 `@/lib/repairdesk/api` 或现有 feature facade；不得导入 `src/server/*`。缓存键复用 `ordersKeys`/`customersKeys` 等工厂。
- 认证、权限、租户、金额、状态转移由服务端校验；关键写入保留幂等、并发版本和审计语义。不得用前端隐藏或mock通过替代真实权限验证。数据/权限变更须核对migration、RLS、服务端授权及客户端/服务端/mock契约；高权限密钥仅服务端使用，角色来源不得使用用户可编辑metadata。
- 查询保持门店隔离、字段最小化、服务端搜索与明确 limit；客户选择不得暗中改变工单 customer_id，金额保留 string draft，空值不自动变0。
- UI复用 `src/components/ui/*`、`src/components/orders/badges.tsx`、`src/lib/ui-patterns.ts`、`src/lib/component-patterns.ts`；颜色只来自 `src/styles.css`，不新建平行设计体系。
- 新导航页面同步 AppSidebar、AppBar 和 CommandPalette。实体返回复用 AppBar 确定性 href，不调用 history.back；全局搜索保留一个桌面壳入口及⌘K。
- 订单QR只识别可信订单payload；设备自动识别仅校验有效的15位IMEI，不混入SN/EID/EAN/SKU。
- 库存的IMEI必填按设备类别决定，成本受现有权限限制；Apple颜色按批准映射，不批量认可泛色表，不覆盖已存在的待映射颜色。
- 不重新引入旧路由/构建入口。M16仍保持原暂停状态；归档不重封、不回退旧RC或其他worktree。
- 不自动发客户消息、不运行不可审查脚本，不把密钥、完整客户PII放入日志、截图、浏览器公开存储或任务文档。

## 5. 验收与交付

- 按实际风险验证：文案/规则做定向与链接检查，局部逻辑做相关测试，公共接口/配置/依赖做必要集成检查；高风险、权限/数据/生产工作保留独立专项审查与正式门禁。高风险变更与发布须明确可执行的回滚/恢复点及停止条件；发布阻断问题未处置时不得宣称可发布。
- 新UI、可运行里程碑和发布候选执行适用 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` 及既有CI，不因规则精简关闭检查。
- 用户可见变更必须验证手机、iPad、桌面完整受影响流程，包括输入、校验、保存、反馈、重开/刷新、权限与错误恢复。iPad检查触控、宽高、旋转、滚动与操作位置，不能当缩小桌面。
- 三端检查页面溢出、长文本、zh/en/it、焦点/Escape、键盘、弹层正文滚动和底部按钮可达；截图不能替代功能验证。
- 成功验证在源码/配置/环境和风险未变时不机械重跑。失败先查根因，不用放松断言掩盖问题。
- 最终说明结果、证据、实际验证、剩余问题。有相关页面必须给脱敏截图/路径；无相关任务页面可截图时说明原因和替代证据。登录/环境阻塞如实报告。
- 历史完整规则保存在 `docs/archive/governance-20260915/`。只归档重复流程和任务沿革，未删除历史证据、运行态、CI或安全控制。
