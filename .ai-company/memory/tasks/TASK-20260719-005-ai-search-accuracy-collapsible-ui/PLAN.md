# Plan — 大模型搜索准确性与 AI 助手折叠布局

## Outcome

保留用户主动选择“大模型理解”的价值，但不再把模型生成的过滤器当作唯一事实来源。服务端从原始问题提取可证明的设备约束，与模型计划合并后再查询；界面把用量和处理说明默认收起，让结果区与输入区成为移动端主内容。

## Architecture decision

### Selected: provider planning plus deterministic semantic guard

1. 大模型模式仍调用现有 provider，继续经过出站审批、预算、用量与审计。
2. 在调用 provider 前后均保留原始用户问题；从中提取有限品牌词典下的品牌+型号约束。
3. 当 provider 返回 `search_orders` 时，可信设备约束覆盖 provider 的 `search` 与 `device_search`，其他结构化过滤器保持 provider 结果。
4. 当明确设备查询被 provider 错分为澄清或订单摘要时，降级为一个默认的受约束 `search_orders`，而不是返回整店列表。
5. 仓储查询继续使用现有 `deviceSearch` 严格匹配；响应前再校验卡片设备标签，任何不匹配视为协议/依赖异常并 fail closed。

### Why prompt-only is rejected

OpenAI Structured Outputs 能保证结构符合 schema，但官方文档明确说明值本身仍可能出现语义错误。提示词可加强意图，但不能代替应用层的确定性验证。

### Why broad post-filter-only is rejected

只在返回的第一页过滤会造成总数错误，也可能把后续页的正确结果遗漏。正确做法是在仓储查询前强制设备条件，并用响应后校验作为防线。

## Work packages

### WP-01 — Planning and contract

- 固化截图问题、根因、边界、验收标准和回滚。
- 明确折叠状态、权限、隐私和可访问性规则。
- 独立 API/Data、UX/FE、QA/Security/Release 只读审查后由主线程裁决。

### Independent review completed

- API/DATA/Architecture reviewer confirmed the repository device matcher already excludes Samsung and recommended service-boundary reconciliation plus a fail-closed result invariant.
- UX/Frontend reviewer confirmed the vertical-space cost comes from three independent `shrink-0` regions and recommended two independent Radix disclosures with 44px triggers.
- QA/Security/Release reviewer identified the missing explicit-model E2E, required one provider attempt/settlement, retained tenant/RBAC boundaries, and defined exact-SHA production rollback gates.
- All reviewers were read-only; the Integration Lead remains the sole writer and final decision owner.

### WP-02 — Query accuracy

- 扩展自然表达外壳，至少覆盖“有没有/有无 + 品牌型号 + 系列 + 单子/工单/订单”。
- 不接受只有品牌或只有数字的猜测；保持品牌和型号联合规范化。
- 新增模型计划 reconciliation helper，并升级策略/提示版本。
- 保留非设备条件、权限判断和 provider 计费事实。

### WP-03 — Collapsible UI

- 复用现有 Radix `Collapsible`，不增加依赖。
- 用量区收起时显示一行摘要；加载、失败与无权限保持可用。
- 处理方式收起时显示当前模式与短说明；展开后显示双选项及完整隐私/语音说明。
- storeKey 变化重置为收起；同一次打开期间保留用户展开状态。
- Sheet 关闭时重置为收起；有效提交开始时自动收起处理详情，但不改变选择的处理方式。

### WP-04 — Verification

- 相关 parser/service/component/repository tests。
- 目标 Playwright 覆盖模型模式 Apple 15、收起/展开、切换模式、用量和 390px overflow。
- `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`。
- 390px 和桌面截图，截图只使用 mock/E2E 脱敏数据。

### WP-05 — Release

- 发布前重新获取 integration lease，并复核 `origin/main` lineage。
- scoped commit，非强制推送 exact SHA 到 `main`。
- 观察 Vercel Git deployment READY，核对 commit SHA 与生产域名。
- 冒烟页面、静态资源和 AI API 安全响应；扫描 error-level 日志。

## Dependencies

- 现有 OpenAI Responses provider、runtime policy、egress、budget、usage、audit。
- 现有订单实体设备匹配及 repository `deviceSearch`。
- 现有 AI usage query 与 `finance:aggregate_read` 权限。
- 现有 Radix Collapsible 和 RepairDesk design tokens。

## Rollback

- 无 DDL、数据或配置回滚。
- 代码回滚到发布前 `origin/main` SHA，并重新提升该 SHA 对应的 READY deployment。
- 若准确性防线触发异常，用户仍可使用订单页手工查询；禁止静默放宽为整店结果。

## Change contract

- Expected files: AI device parser/tests, order assistant service/tests, prompt version/provider tests, AI assistant sheet/tests, targeted E2E, task/docs memory.
- Forbidden files: migrations, environment/secret files, pricing/budget/model policies, allowlists, production data scripts.
- Stop and reclassify if implementation requires schema, permission, dependency or external-data-scope changes.
