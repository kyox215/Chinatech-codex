# Phase 3A Plan — Cost Governance and Live Readiness

## Plan Delta

Owner 的最新关注点是 10 家门店的运行费用。原 master plan 的 Phase 3 同时包含成本硬化与持久草稿/RAM/多标识符，爆炸半径过大。本任务把它拆成：

1. **Phase 3A（本任务）**：零模型路径、成本/配额/runtime 合同、durable quota migration 草案和 dormant release。
2. **Phase 3B（后续任务）**：持久 AI 草稿、RAM、多标识符、field reviews 和正式幂等应用。

拆分不删除原范围，也不授权生产迁移或真实第三方调用。

## Global execution protocol

每个微阶段执行：重读 master plan 与本文件 → 检查 Git/批准状态 → 主线程单一写入 → 最窄测试 → 只读 Reviewer 复核 → Evidence/Checkpoint → 才进入下一步。

## 3A0 — Contract, evidence and review

Deliverables:

- 新 R4/L2 task、Context Packet、Approval Register、Agent Packages、Release Plan。
- 当前 provider/quota/audit/route/data contract 事实图。
- OpenAI 当前价格/缓存/图像成本与 Supabase RLS/Grants 官方依据。
- 三组真实 read-only Agent：Architecture/API、Data/Security、Product/QA/Release。

Exit:

- 分歧已由 Integration Lead 裁决；范围、文件预算、验证和 D4 stop points 可实施。

## 3A1 — Deterministic zero-model order routing

Deliverables:

- 把明确订单引用和锁定的高置信筛选从 fake provider 中提取为纯、可测试、保守的 deterministic planner。
- `runAiOrderAssistantTurn` 在 provider quota/reservation 之前尝试确定性解析；命中时 provider call = 0。
- 所有请求先经过独立 actor/store 短窗防滥用限流；该限流与付费 provider 配额分离。
- 图片改为 local-first 顺序；关键标签候选充分时不创建 data URL、不调用服务端视觉接口。
- 未命中、含糊或未支持表达保持既有 provider planner 行为。
- 权限/capability 必须始终先于解析；Repository 仍使用当前 actor/store 权限。
- 审计区分 `provider=none`、deterministic policy version 和真实 provider usage。

Exit:

- 测试证明 exact order、锁定筛选、多语言保守命中、含糊 fallback、权限拒绝、repository failure 和审计语义。
- 确定性/本地命中不消耗 provider quota；所有请求仍受新短窗 guard，live 多实例前再接 durable/distributed guard。

Rollback: 通过单一策略开关或回退提交恢复所有请求走 provider；业务查询合同不变。

## 3A2 — Cost and runtime policy

Deliverables:

- 请求类别：`order_text`、`inventory_vision`；分场景 daily/global limits 和月度 micro-USD budget 合同。
- 推荐但未激活的路由：text `gpt-5-nano`、vision `gpt-4o-mini`、controlled fallback `gpt-5-mini`。
- 模型、价格版本、输入/缓存/输出费率、max output tokens、deadline、fallback 次数均由服务端策略配置并严格校验。
- 纯函数从 provider usage 计算整数 micro-USD；拒绝负数、NaN、溢出和未知模型。
- provider interface 接收 AbortSignal 和 privacy-preserving safety identifier；fake 测试可观察传递，不触发外部调用。
- audit 只增加 allowlist 聚合字段：request kind、policy version、cached/write/input/output token counts、estimated micro-USD、budget outcome。

Exit:

- 缺少预算、durable backend、模型、费率或 deadline 时 openai provider 继续 `AI_MISCONFIGURED`。
- 估算使用整数和向上取整，不低估已知费率；价格变化只需更新有版本的服务端配置。

Rollback: 全局 `AI_ASSISTANT_ENABLED=0`；删除/忽略新增配置不会误开功能。

## 3A3 — Durable quota contract and migration draft

Deliverables:

- `reserve → finalize/release` repository contract，使用 request id 幂等。
- additive 数据对象只保存 store、actor hash、request kind、bucket、预留/实际 micro-USD、Token 聚合、状态和过期时间；不保存正文、图片、订单/工具 payload 或完整标识符。
- 原子检查：每店文字/图片日限额、全局调用日限额、全局月度 micro-USD；任何一项超限均不预留。
- UTC 时间戳存储；日/月桶使用策略中的门店 IANA timezone 计算，数据库时钟为准，正确覆盖 DST 23/25 小时日期。
- public 表显式 RLS；anon/authenticated 零直接 DML/SELECT；只给必要 server role/RPC 最小权限；function 默认 revoke `PUBLIC` execute。
- 索引、唯一幂等、reservation TTL、失败释放、最终结算、过期清理与监控查询。
- migration 通过 `supabase migration new` 创建，只做 local/schema-clone/dry-run；不得 linked production apply。

Exit:

- 并发测试证明不能超额；重试返回同一 reservation；跨店访问为 0；失败/超时不会永久吃掉额度。
- linked apply 仍有明确 D4 批准包和恢复/观察要求。

Rollback: 应用层 flags 先关闭；若以后已迁移，保留 additive 表，不紧急 DROP；旧代码不依赖新对象。

## 3A4 — Verification and independent review

Verification order:

1. focused Vitest for deterministic planner, cost policy, runtime guards and quota contract;
2. migration static/schema-clone/RLS/Grants/concurrency tests where environment permits;
3. `npm run lint`;
4. `npm run typecheck`;
5. `npm run test`;
6. `npx next build --webpack`;
7. Phase 1/2 fake Playwright regression;
8. secret/identifier/diff scan;
9. final Architecture, Security/Data and QA/Release re-review.

Exit: default-off slice P0=0/P1=0; skipped linked/live checks are explicitly blocked, not marked pass.

## 3A5 — Dormant release and observation

- Scope-only commit on isolated branch.
- Fetch and require fast-forward ancestry from current `origin/main`.
- Push recovery branch and main only under the existing gated deployment authorization.
- Deploy exact SHA with all AI/OpenAI production variables absent/off; no migration apply and no key sync.
- Smoke unauthenticated auth boundary, ordinary manual routes and AI capability denial; inspect error logs; retain previous READY rollback.
- If any release gate or authorization is unclear, stop at a release-ready package and request Owner approval.

## Success signals for a later live pilot

- OpenAI spend hard cap explicitly approved; recommended start `$50/month`.
- Per-store provider fallback proposed `20 text + 10 vision/day`; global proposed `300/day`.
- deterministic order routing rate measured; target ≥70% of exact/common order requests without provider.
- local OCR/barcode resolution ≥70% 仅为支持浏览器上的锁定清晰标签集目标；先测 baseline，不作为 dormant release 阻断或生产承诺。
- cross-store success, unconfirmed write and high-confidence wrong identifier accepted all equal 0.
- manual workflow available during every AI/provider/quota failure.
