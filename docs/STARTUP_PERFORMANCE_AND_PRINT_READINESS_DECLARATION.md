# RepairDesk 启动性能与打印就绪声明

Status: active
Owner: Architecture + Frontend + API + Security + QA / Integration Lead
Scope: app shell cold start, workspace preload, tenant cache isolation, order print capability, print readiness, diagnostics and release gates.
Last verified: 2026-07-23 CEST by `TASK-20260723-004-startup-bootstrap-print-implementation`

> 目标：后续新增页面、全局 Provider、预加载、权限或打印功能时，不能重新引入首屏请求争抢、跨店缓存污染、权限扩大或“按钮灰掉但不知道原因”的体验。

## 1. 适用范围

以下变更开始前必须阅读本声明：

- 修改 `src/app/providers.tsx`、应用 Shell、登录后首屏或全局 Provider；
- 新增或调整 React Query key、店铺切换、身份/权限刷新；
- 新增 workspace preload、详情预热、定时刷新或 Realtime 恢复；
- 新增工单、收据、标签、客户二维码等单张或批量打印入口；
- 修改角色权限、打印配置、店铺输出资料或客户状态 QR 开关。

本声明不替代 [`REALTIME_DATA_CONSISTENCY_DECLARATION.md`](./REALTIME_DATA_CONSISTENCY_DECLARATION.md)、[`REALTIME_PRELOAD_COORDINATION.md`](./REALTIME_PRELOAD_COORDINATION.md) 或 [`CUSTOMER_REPAIR_STATUS_QR.md`](./CUSTOMER_REPAIR_STATUS_QR.md)；它负责把启动性能和打印就绪要求变成统一的项目门禁。

## 2. 启动数据合同

1. 登录后的冷启动权威快照必须优先使用私有 `GET shell/bootstrap`。
2. 服务端只解析一次 request actor，并由同一 actor 快照生成 onboarding、store context、AI capability 与非秘密 QR readiness。
3. 客户端必须把 bootstrap 结果写入正式 query key，页面和后续 Provider 复用这些缓存；禁止再维护第二套启动状态。
4. 旧 `onboarding/status`、`stores/context`、`ai/capabilities` 仅用于滚动发布和回滚兼容。
5. 只有 bootstrap 明确返回 `404`、`405` 或 `501` 才允许旧接口回退。
6. `401`、`403`、超时、网络异常和解析异常不得伪装为旧服务端，不得触发兼容回退。
7. Bootstrap 只负责冷启动；运行期权限监测继续使用较窄的 store context 请求，不得循环拉取整个 bootstrap。

## 3. 首屏与预加载合同

1. `/`、`/orders`、`/customers`、`/inventory`、`/settings` 的主查询拥有首屏网络优先权。
2. 这些 workspace 首页不得在主数据就绪前启动跨业务 preload。
3. 全局扫码、AI Sheet、客户详情和其他低频大组件必须按需挂载或 lazy load，不能因为 Provider 常驻而进入每个首屏 bundle/请求链。
4. 订单预热必须使用与订单页面相同的 `orders/queue-summary` query factory，禁止恢复旧 list-page key。
5. 详情预热只能有一个调度 owner，并受并发、网络、Data Saver、离线和 store epoch 控制。
6. 新的“体验优化”不得通过扩大首屏请求数来实现；需要预热收益时，必须提供同条件测量和回归证据。

## 4. 租户与权限缓存合同

1. 切店、退出、角色/授权变化必须先取消旧请求，再清理旧 tenant cache。
2. 清理范围至少包含 orders、customers、inventory、store context、bootstrap、AI capability 及其他 store-scoped roots。
3. 旧店的延迟响应不得覆盖新店数据；Realtime、manual refresh 和 preload 必须使用同一 store/domain epoch 规则。
4. `401/403` 必须 fail closed：页面渲染敏感业务内容前清除权威来源和业务缓存。
5. 任何新 query root 都必须同时评估 store switch、authority loss、sign-out 和 reconnect 清理行为。

## 5. 打印权限合同

单张打印、批量打印和导出是三个独立能力，禁止通过一个 `canExportOrders` 代替全部判断。

| 角色         | 单张工单打印 | 批量打印 | 导出 | 服务端对象约束              |
| ------------ | -----------: | -------: | ---: | --------------------------- |
| Owner        |         允许 |     允许 | 允许 | 同店、正常工单              |
| Manager      |         允许 |     禁止 | 禁止 | 同店、正常工单              |
| Sales / 前台 |         允许 |     禁止 | 禁止 | 同店、正常工单              |
| Technician   |     条件允许 |     禁止 | 禁止 | 同店且分配给当前 membership |
| Viewer       |         禁止 |     禁止 | 禁止 | 默认拒绝                    |

UI capability 只负责显示与提前反馈，不能替代服务端授权。客户状态链接签发、批量操作和导出仍必须在服务端重新验证 actor、store、order scope 与数量。

## 6. 打印就绪与恢复合同

打印入口只有同时满足以下条件时才能执行：

- 当前角色具有对应单张或批量 capability；
- 工单不是 void、deleted 或其他禁止输出状态；
- 当前店铺输出资料完整并可生成客户文档；
- `CUSTOMER_STATUS_QR_ENABLED=1` 且链接签发服务可用；
- 当前不处于重复准备/打印生命周期；
- 设备在线，或失败后能给出明确重试反馈。

所有单张和批量入口必须：

1. 在点击前显示准确 disabled state；
2. 用可见文案、`title` 或 `aria-label` 说明具体原因；
3. 提供可执行恢复入口，例如“前往店铺资料”“重新检查资料”“查看打印设置”；
4. QR 由部署环境关闭时明确提示联系店主/系统管理员，不伪造前端开关；
5. 禁止只显示灰色图标、通用“无法打印”或点击后才弹一个无恢复路径的 Toast。

## 7. 配置与运维声明

- `CUSTOMER_STATUS_QR_ENABLED=1` 是服务端签发/解析总开关，其他值一律 fail closed。
- `NEXT_PUBLIC_REPAIRDESK_PRELOAD_ENABLED=0` 只关闭预加载；它是构建时变量，修改后需要重新构建和部署。
- Bootstrap 和打印 readiness 只可下发非秘密布尔值/能力；不得把密钥、内部 Supabase 配置或客户数据下发到 Shell。
- 环境开关、角色矩阵和店铺资料变化必须有回滚方案；不得通过关闭服务端授权来掩盖 UI 状态错误。

## 8. 变更规划与验收矩阵

任何相关任务至少包含以下工作包：

| 工作包           | 必须验证                                                      |
| ---------------- | ------------------------------------------------------------- |
| Shell/API        | 单 actor、响应最小化、旧接口兼容、401/403 no-fallback         |
| Query/cache      | 正式 key 复用、切店/退出/权限变化清理、旧响应隔离             |
| Preload          | 首屏无跨域争抢、并发与弱网边界、query factory 一致            |
| Print permission | Owner/Manager/Sales/Technician/Viewer 单张、批量、导出矩阵    |
| Print readiness  | QR off、店铺资料缺失、void/deleted、busy、offline 原因与恢复  |
| UI               | 桌面单张与批量入口；移动端如未修改必须证明无回归              |
| QA               | lint、typecheck、full test、build、相关浏览器截图或无页面说明 |
| Release          | 精确变更范围、配置、观测、回滚；生产动作需 Owner 单独批准     |

最低自动化覆盖：

- bootstrap 正向单请求；
- `404/405/501` 分别回退；
- `401/403` 不回退并清缓存；
- store switch/authority loss 的 bootstrap 与 AI cache 清理；
- 打印角色矩阵；
- 单张与批量 disabled reason/recovery；
- 生产构建。

## 9. 禁止事项

- 禁止在多个 Provider 各自请求 onboarding/store/AI 启动数据。
- 禁止把 Realtime、30 秒版本检查和普通页面查询合并成全量轮询。
- 禁止在 workspace 首页恢复无界跨域 preload。
- 禁止用客户端角色名称代替服务端 permission projection。
- 禁止让 Manager 因为可单张打印而获得批量打印或导出。
- 禁止新打印入口跳过 QR link preparation 或复用过期链接。
- 禁止在截图、日志、任务记忆或测试报告中暴露完整客户 PII、token 或生产凭据。

## 10. 当前基线与后续变更

当前本地基线由 `TASK-20260723-004-startup-bootstrap-print-implementation` 建立：lint、typecheck、342 个测试文件 / 2289 项测试和 production build 通过，独立 QA 无 P0/P1。该证据证明本地实现，不代表代码已经提交、推送或部署。

后续如果修改本声明中的接口、角色矩阵、环境开关或 preload owner：

1. 先更新本声明和受影响的权威文档；
2. 在任务中说明兼容、迁移和回滚；
3. 完成安全与 QA 复核；
4. 生产启用、推送、部署或数据库动作必须获得 Owner 对该动作的明确批准。
