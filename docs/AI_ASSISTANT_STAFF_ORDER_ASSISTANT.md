# RepairDesk 员工订单 AI 助手运行说明

## 当前能力

- 已登录员工可从桌面 AppBar、手机订单浮动标题或其他手机模块的快捷操作打开 AI Sheet。
- 助手仅规划 `search_orders` 与 `get_order_summary` 两类只读意图；`actor`、当前门店与权限始终由服务端注入。
- 完整工单号和三个固定快捷查询在权限与短窗限流后直接解析，命中时不创建 provider、不扣付费额度；姓名、电话、IMEI、部分编号和含糊组合仍交给 planner，绝不猜测。
- 订单卡由 RepairDesk 业务服务构造。客户姓名会脱敏，且不返回电话、IMEI、财务明细或模型自由生成的订单字段。
- 会话仅保存在当前页面内；关闭、门店/权限指纹变化或取消操作会中止请求。

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
AI_ASSISTANT_BUDGET_APPROVED=0
```

本地合成数据验证可把 provider 保持为 `fake`，同时为测试门店设置主开关、订单工具开关和精确门店白名单。生产 live provider 在以下条件全部满足前必须保持不可用：

1. 批准明确的每日/每月预算与门店限额；
2. 批准真实数据的 DPA、ZDR/MAM、区域、隐私告知和删除策略；
3. 批准并验证官方 OpenAI SDK、总超时、服务器 AbortSignal 与 durable atomic quota；
4. 完成安全、权限、审计、E2E、发布和回滚复核。

当前 `openai` provider 会安全失败并提示继续手工查询，不会发出外部请求。

成本、模型 snapshot、Safety ID、门店时区日桶、durable quota 和所有新 fail-closed 变量的权威说明见 `docs/AI_ASSISTANT_COST_GOVERNANCE.md`。

照片识别到库存表单草稿的独立边界、图片限制与验证步骤见
`docs/AI_ASSISTANT_INVENTORY_VISION.md`。

## API 与失败语义

- `GET /api/repairdesk/ai/capabilities`：返回当前 actor/store 的服务端 capability projection。
- `POST /api/repairdesk/ai/order/turn`：接受最多 800 字的自然语言问题；Next route 对该端点额外执行认证前置和 4096 字节请求上限。
- 超时、provider 不可用、审计不可用、依赖不可用、配额耗尽和配置错误只返回稳定短错误码，不返回内部错误正文。
- 审计只允许事件名、解析路径、版本、工具名、数量、Token/估算 micro-USD 聚合、延迟桶、预算状态与短错误码；禁止问题正文、工具参数/结果、客户 PII、标识符、Safety ID、图片或 secret。

## 验证与回滚

发布前运行：

```bash
npm run lint
npm run typecheck
npm run test
npx next build --webpack
```

再运行 `tests/e2e/ai-assistant-staff.spec.ts` 的 fake-provider 流程，覆盖桌面、390/430px、取消、离线、权限拒绝和手机快捷入口顺序。

紧急回滚首先设置 `AI_ASSISTANT_ENABLED=0` 并重新部署；如仍有影响，再回退部署。不要通过删除业务表处理应用级故障。API Key 若疑似泄露，应在 provider 控制台轮换，且不得在日志或任务文件记录旧值。
