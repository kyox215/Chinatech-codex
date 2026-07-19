# RepairDesk 员工订单 AI 助手运行说明

## 当前能力

- 已登录员工可从桌面 AppBar、手机订单浮动标题或其他手机模块的快捷操作打开 AI Sheet。
- 助手仅规划 `search_orders`、`get_order_summary` 与安全澄清三类只读意图；`actor`、当前门店与权限始终由服务端注入。
- 完整工单号、固定队列查询、受控品牌+型号和明确的“金额异常/金额不一致”表达会在权限与短窗限流后直接解析，命中时不创建 provider、不扣付费额度；姓名、电话、IMEI、部分编号和含糊组合仍交给 planner，绝不猜测。
- 用户显式选择“大模型理解”时仍会真实调用现有受控 provider，但模型生成的过滤器只是一份计划。服务端会从原始问题提取受控品牌+型号约束，在仓储查询前强制合并，并校验返回设备标签；模型不能把“苹果 15”放宽成数字 `15`、空过滤器或 Samsung。严格 tool schema 保证结构，不替代应用层语义校验，参见 [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)。
- `search_orders.financial_review=amount_anomaly` 只触发 RepairDesk 服务端一致性复核：检查非法/负金额、定金加尾款超过报价、结清标记与尾款矛盾、付款状态与金额口径矛盾。它只表示需要人工核对，不是欺诈或会计结论，也不会自动修改工单。
- 金额异常列表属于整店财务推断，必须具备 `finance:aggregate_read`；服务层和订单仓库双重拒绝无权限 actor。模型和结果卡均不接收或显示具体金额，空结果会说明实际检查范围，不再误导员工补充订单号、客户或设备。
- 真实 provider fallback 已实现，但只接受经过独立外发批准且未命中敏感模式的通用筛选文字。邮箱、电话、IMEI、完整 UUID/工单号、引号内容和常见姓名查询会在费用预留及外发前拒绝；完整工单号继续走本地直查。
- 订单卡由 RepairDesk 业务服务构造。客户姓名会脱敏，且不返回电话、IMEI、财务明细或模型自由生成的订单字段。
- 会话仅保存在当前页面内；关闭、门店/权限指纹变化或取消操作会中止请求。浏览器生成稳定 `client_request_id`，同一次错误重试不会重复 dispatch/扣费。
- AI Sheet 的今日用量和处理方式详情默认收起为两条 44px 摘要。当前模式始终可见；大模型模式在收起状态仍显示“发送至 OpenAI · 计入用量”。展开后保留请求/Token/费用、双模式选择、隐私和语音说明，不改变权限或请求参数。

## 默认关闭与放行顺序

所有部署必须先保持：

```dotenv
AI_ASSISTANT_ENABLED=0
AI_ORDER_READ_TOOLS_ENABLED=0
AI_ASSISTANT_PROVIDER=fake
AI_ASSISTANT_STORE_ALLOWLIST=
AI_ASSISTANT_REQUESTS_PER_STORE_DAY=0
AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE=30
AI_ASSISTANT_EXTERNAL_DATA_APPROVED=0
AI_ASSISTANT_ORDER_EXTERNAL_DATA_APPROVED=0
AI_ASSISTANT_BUDGET_APPROVED=0
```

本地合成数据验证可把 provider 保持为 `fake`，同时为测试门店设置主开关、订单工具开关和精确门店白名单。生产 live provider 在以下条件全部满足前必须保持不可用：

1. 批准明确的每日/每月预算与门店限额；
2. 批准真实数据的 DPA、ZDR/MAM、区域、隐私告知和删除策略；
3. 应用、数据库政策与精确模型/价格/Token/额度一致性证明通过，服务器 AbortSignal 与 durable atomic quota 可用；
4. 完成安全、权限、审计、E2E、发布和回滚复核。

当前原生 server-side Responses API 适配器已经完成；只有 provider、两级数据批准、预算批准、精确模型、密钥、两个 HMAC secret、Supabase durable backend、政策版本、门店 allowlist 与功能旗标全部匹配后才可能 dispatch。生产配置尚未满足，因此仍安全失败并保留手工查询。

`store:false` 只是不创建可继续读取的 Responses 应用状态，不等于 Zero Data Retention。除非账户获得并启用相应控制，OpenAI 默认 abuse-monitoring 日志仍可能保留输入/输出最多约 30 天；因此订单文字外发仍是独立 D4 隐私决定。UI 明确提示员工不要输入姓名、电话、邮箱、IMEI、证件或支付信息。

成本、模型 snapshot、Safety ID、门店时区日桶、durable quota 和所有新 fail-closed 变量的权威说明见 `docs/AI_ASSISTANT_COST_GOVERNANCE.md`。

照片识别到库存表单草稿的独立边界、图片限制与验证步骤见
`docs/AI_ASSISTANT_INVENTORY_VISION.md`。

## API 与失败语义

- `GET /api/repairdesk/ai/capabilities`：返回当前 actor/store 的服务端 capability projection。
- `POST /api/repairdesk/ai/order/turn`：接受最多 800 字的自然语言问题；Next route 对该端点额外执行认证前置和 4096 字节请求上限。
- 超时、provider 不可用、审计不可用、依赖不可用、配额耗尽和配置错误只返回稳定短错误码，不返回内部错误正文。
- API 只调用一次且无自动 fallback/retry。只有能够证明尚未发送的失败才释放预留；HTTP、断线或结果未知会保守持有，随后按 TTL 上限结算。返回 usage 的协议错误按实际 usage 结算。
- 审计只允许事件名、解析路径、版本、工具名、数量、Token/估算 micro-USD 聚合、延迟桶、预算状态与短错误码；禁止问题正文、工具参数/结果、客户 PII、标识符、Safety ID、图片或 secret。

## 验证与回滚

发布前运行：

```bash
npm run lint
npm run typecheck
npm run test
npx next build --webpack
```

再运行 `tests/e2e/ai-assistant-staff.spec.ts` 的 fake-provider 流程，覆盖桌面、390/430px、金额异常本地查询、显式大模型“有没有苹果15系列的单子”、上下折叠、取消、离线、权限拒绝、敏感输入提示和手机快捷入口顺序。真实计费 smoke 必须在 durable 数据库政策启用后，用一条无 PII 的合成查询执行一次；不得绕过预算网关直接调用 provider。

紧急回滚首先设置 `AI_ASSISTANT_ENABLED=0` 并重新部署；如仍有影响，再回退部署。不要通过删除业务表处理应用级故障。API Key 若疑似泄露，应在 provider 控制台轮换，且不得在日志或任务文件记录旧值。
