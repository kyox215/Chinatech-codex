# CEO Report — ChinaTech AI 小助手 D4-v2 单店文字灰度

## 结论

**有条件关闭 / RELEASED。** `ai-runtime-v2` 已部署到生产，v2 policy 已创建、完整 attestation 并成为唯一 enabled policy。唯一一次追加的合成无 PII 计费 smoke 同时满足 HTTP、durable ledger 和 privacy-safe audit 三道门禁后，ChinaTech 单店员工订单文字 AI 才被开启。生产从 `2026-07-19T00:58:50.334Z` 起观察到 `2026-07-19T01:28:56Z`，未触发停止或回滚条件。

Vision、自动写入、公开/客户助手、PII 外发和其他店铺继续关闭。本次关闭是批准的 D4-v2 文字切片，不代表完整 AI/拍照入库路线完成。

## 验收矩阵

| 验收项                          | 结果        | 证据                                                                                                               |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| 复用现有加密密钥，不暴露明文    | PASS        | Vercel Production secret metadata；真实 v1/v2 provider attempt 成功鉴权；secret scan E-013/E-029                   |
| 部署 `ai-runtime-v2`            | PASS        | `main@152caa1ce5e415d464e0cfc73674ae4cda3cfa6a`; Vercel `dpl_946N6xMftqrRpKTzGmnDBmbjrR2y` READY                   |
| 创建并验证 v2 policy            | PASS        | v2 exact-copy contract；`policy_ready`；v2 enabled、v1 disabled、enabled policy count=1                            |
| 额外一次无 PII 计费 smoke       | PASS        | request `735769a5-8b17-47cc-9828-036368392539`; HTTP 200；ledger/audit succeeded；1 attempt；44 microUSD           |
| 只在三门全绿后激活              | PASS        | activation checkpoint commit `152caa1c` 晚于 E-033 三门证据                                                        |
| ChinaTech 单店员工订单文字      | PASS        | allowlist 仅 `5248dda1-2b32-46cd-8ed0-d15386a9e8ed`; master/order flags on；other-store requests=0                 |
| 观察 30 分钟                    | PASS        | 约 50 秒轮询；最终 `01:30:41Z` 聚合；0 open/bad/overrun/runtime error                                              |
| Vision/写入/公开/PII/其他店关闭 | PASS        | Vision/other-store ledger and activation audit counts=0；Vision/draft/public flags remain off                      |
| 生产登录态 UI 截图              | CONDITIONAL | 对 `www.chinatech.in` 的明确站点使用限制阻止浏览器验证；未绕过；使用本地合成截图和生产 HTTP/账本/审计/部署证据替代 |

## 生产结果

- v2 smoke：399 input / 60 output Token，1 provider attempt，结算 44 microUSD（约 `$0.000044`）。
- AI 账本累计：2 条已结算请求、2 provider attempts、167 microUSD（约 `$0.000167`）；0 未释放 reservation、0 failed-billable/stale/overrun、0 Vision、0 跨店。
- 30 分钟激活窗口没有真实员工新请求，所以窗口证明的是空闲稳定性、边界不漂移和无后台异常；实际服务路径由激活前的 v2 smoke 证明。
- Vercel：部署 READY，生产别名为 `www.chinatech.in` / `chinatech.in`，构建 errors-only 为 0，AI/maintenance 路由 runtime error cluster 为 0。
- Production 非秘密配置在激活部署前完成精确读回；关闭阶段 CLI 只返回项目检索提示而未返回值，因此最终配置证据采用已验证的部署输入、精确 SHA、数据库 policy/ledger/audit和运行结果组合，不把空 CLI 输出伪报为再次读回成功。

## 安全与数据

- 四张 AI 治理表均启用 RLS；`anon`、`authenticated`、`PUBLIC` 的表权限合计为 0，只有 `service_role` 保留所需权限。
- Supabase Advisor 对这些私有表报告 INFO 级 `RLS Enabled No Policy`；这与 service-role-only 设计一致，不是浏览器开放。项目中仍有与本切片无关的既有 WARN（部分 legacy permissive RLS、mutable function search path、leaked-password protection disabled），由 Security/Data/Owner 另开硬化任务处理，本次未越权修改。
- 账本和审计不保存 prompt、订单卡片、客户 PII、IMEI/SN 或密钥；smoke 只使用合成通用筛选语句。

## 文档影响矩阵

| 读者         | 权威文档                                                                       | 同步结果                                                                                      |
| ------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 运营/发布    | `docs/AI_ASSISTANT_LIVE_PILOT_RUNBOOK.md`                                      | 从 dormant/v2 pending 更新为 ChinaTech text live、30-minute passed、24-hour follow-up pending |
| 开发/QA/安全 | `TASK.md`, `CHECKPOINTS.md`, `EVIDENCE.md`, `HANDOFF.md`                       | 同步 exact SHA、三门、费用、观察、边界、回滚和限制                                            |
| 后续 Agent   | `ACTIVE_CONTEXT.md`, `PROJECT_MEMORY.md`, department memory, `MEMORY_INDEX.md` | 保留单店文字已上线与 Vision/PII/第二店仍需新 D4 的边界                                        |
| 能力治理     | `CAPABILITY_REGISTRY.md`                                                       | 仅新增 C1 candidate 证据；不升级 Permission 或 Autonomy                                       |

没有需要删除的旧权威文档；旧的 v1 失败记录保留为发布审计历史，不再作为当前运行状态。

## 视觉证据

- 本地合成员工订单助手：`evidence/ai-assistant-sheet-desktop.png`
- 本地合成 Vision 隐私提示（仅证明关闭前 UI 设计，不代表 Vision 已上线）：`evidence/inventory-vision-privacy-dialog-desktop.png`
- 生产截图未获取：浏览器受明确站点限制，未绕过。替代证据为 Vercel READY、HTTP 200 smoke、durable ledger/audit 和 30 分钟运行聚合。

## Agent 与能力评估

本轮未新 spawn 子 Agent。原因：Production secrets、policy mutation、唯一计费 dispatch、Git/main、部署和连续观察必须由 Integration Lead 串行执行，且此前独立 Architecture/Security/QA 只读评审已存在。部门工作在主线程按已批准合同执行，不把标签冒充新 AI 员工。

建议登记 `CAP-AI-LIVE-PILOT-20260719` 为 **C1 candidate**：已证明在明确 D4、单一写入者、硬门禁和回滚条件下执行一次单店文字 AI 灰度。一次成功不足以升级到 C2/C3，也不改变生产、密钥、数据库或发布权限。复审条件为 24 小时观察、下一次 AI provider release 或任何 Vision/第二店提案。

## 回滚与下一步

异常时按顺序关闭 `AI_ORDER_READ_TOOLS_ENABLED`、`AI_ASSISTANT_ENABLED`、maintenance 和 allowlist，部署新配置，再把 v2 policy 设为 disabled；保留账本，不执行破坏性 DROP。

1. Integration Lead 在激活后 24 小时执行一次只读 ledger/audit/runtime review。
2. 登录态生产 UI 截图仅在站点限制解除后补充，不以绕过方式取得。
3. Vision/照片、PII、自动写入、公开助手、第二店或模型/预算变化均新建 R4/D4 任务。
