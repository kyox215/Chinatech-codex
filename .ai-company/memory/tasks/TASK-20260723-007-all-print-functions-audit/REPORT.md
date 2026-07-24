# 全站打印功能可用性审计报告

- 任务：`TASK-20260723-007-all-print-functions-audit`
- 审计时间：2026-07-23
- 审计方式：只读代码检查、权限与前置条件核对、单元测试、Chromium/WebKit 浏览器验证、打印媒体截图检查
- 结论：**CONDITIONAL / 有条件通过**
- 业务代码变更：**无**

## 一、结论摘要

当前产品共有 4 类可到达的打印业务面：工单客户单据、回收成交凭据、库存保修票据，以及同一工单单据在列表/详情/任务页的多个入口。

1. **工单打印主流程正常**：列表批量、详情页、任务页均能准备客户二维码、生成独立打印内容并调用浏览器打印；Chromium 和 WebKit 自动化通过。当前 WebKit 打印媒体证据中未见右侧裁切。
2. **库存保修票据正常打开并调用打印**：已售商品能打开票据预览、生成专用打印页；Chromium 与 WebKit 均通过。
3. **回收凭据打印不合格**：完成页按钮只执行 `window.print()`，没有专用回收凭据组件、没有打印内容隔离、没有门店输出资料校验，也没有统一打印生命周期。浏览器可能打开打印对话框，但输出的是当前成功页/应用界面，不能视为正常凭据打印。
4. **工单任务页存在前置条件不一致**：列表和详情会检查“客户查询二维码功能是否启用”，任务页没有检查；二维码功能关闭时按钮仍可能可点，随后由服务器拒绝。
5. **工单详情/任务页与列表的 viewer 权限口径不一致**：列表明确不给 viewer 单张打印权限，但详情和任务页仅按工单状态与店铺资料决定按钮状态；服务器签发二维码时会拒绝 viewer，形成“按钮可点但无法打印”。
6. **Safari 原生系统打印预览与真实物理打印机仍需人工实机确认**：WebKit 能验证 DOM、打印媒体和 `window.print()` 调用，但不能自动确认 macOS Safari 原生预览、打印机驱动、纸张缩放及最终纸张输出。

## 二、打印入口矩阵

| 入口 | 当前实现 | 浏览器验证 | 结果 | 说明 |
|---|---|---|---|---|
| 工单列表 · 单张打印 | 复用 `printRows`、二维码签发、`OrderListPrintSheet`、统一打印生命周期 | 与批量共用代码路径；单元与静态权限矩阵通过 | PASS / CONDITIONAL | 正常角色可用；viewer 入口隐藏。仍受 Safari 原生预览人工门禁限制。 |
| 工单列表 · 批量打印 | owner 批量权限、最多 50 单、逐单二维码、A4 纵向每半页一单 | Chromium 1/1；WebKit 受控复测 1/1；两单 PDF 为 2 页 | PASS / CONDITIONAL | 店铺资料、二维码功能、工单有效性缺一不可；失败会阻止打印。 |
| 工单详情 · 打印 | 独立客户单据、二维码、统一生命周期、作废工单阻断 | Chromium 与 WebKit 均能生成打印页并调用打印 | CONDITIONAL | 正常角色通过；viewer 的按钮状态未对齐列表权限，可能点击后 403。 |
| 工单任务页 · 打印客户工单 | 复用 `RepairOrderPrintSheet` 和统一生命周期 | owner + QR 可用场景在 Chromium/WebKit 通过 | CONDITIONAL | 未检查 `customerStatusQrEnabled`，二维码关闭时仍可能可点后失败；viewer 同样有权限口径问题。 |
| 库存 · 已售商品 · 打印保修票据 | 有票据预览、`InventorySaleReceiptPrintSheet`、门店资料阻断 | Chromium 1/1；WebKit 1/1 | PASS / CONDITIONAL | 能打开并调用打印；仍直接调用 `window.print()`，缺少统一 busy/error/afterprint 管理。 |
| 回收 · 成交完成 · 打印回收凭据 | 成功页直接 `window.print()` | 静态执行路径确认；当前 quote-only 模式下按钮不显示 | FAIL | 没有独立凭据、没有打印隔离、没有门店输出身份校验；完整回收重新启用后会打印当前应用页面。 |

## 三、发现的问题

### P1 — 回收凭据不是独立可打印单据

- 证据：`BuybackSuccess` 的按钮直接调用 `window.print()`，没有 `PrintPortal`、打印 sheet 或回收协议/卖家/设备/付款等凭据快照。
- 影响：完整回收成交功能启用时，门店点“打印回收凭据”虽然可能弹出系统打印框，但内容不是正式凭据，可能包含应用界面并缺少必要交易信息。
- 当前暴露度：当前 E2E quote-only 模式隐藏该按钮，因此属于**已存在但在当前受限流程中暂时潜伏**的问题；一旦恢复完整成交即直接暴露。
- 建议：后续单独修复，建立 `BuybackReceiptPrintSheet`，使用成交快照、店铺输出身份和统一打印生命周期。

### P1 — 工单任务页未统一检查二维码开关

- 证据：列表与详情均检查 `shell.customerStatusQrEnabled === false`；任务页 `canPrintCustomerDocument` 只检查工单与店铺输出身份，点击后才调用二维码签发接口。
- 影响：二维码服务未启用时，任务页按钮可能仍为可用，用户点击后收到接口错误，符合“显示可打印但无法打印”的故障模式。
- 建议：后续让任务页复用与详情页相同的 `canPrint` 与 `printDisabledReason` 规则。

### P2 — viewer 的单张打印权限在入口之间不一致

- 证据：订单选项明确将 viewer 的 `canPrintSingleOrders` 设为 false；详情和任务页没有读取该能力。二维码签发服务也不会给 viewer 满足 scoped 条件，因此最终会拒绝。
- 影响：列表不显示打印，详情/任务页却可能显示可用按钮，点击后失败。
- 建议：把单张打印能力加入订单详情 capabilities，三个入口统一消费同一个服务端投影。

### P2 — 库存票据未复用统一打印生命周期

- 证据：库存票据使用一次 `requestAnimationFrame` 后直接 `window.print()`；工单则使用 `usePrintLifecycle` 管理双帧准备、重复点击、异常和 `afterprint` 清理。
- 影响：当前测试可正常打开，但快速连点、浏览器抛错或打印预览未关闭时，缺少工单同等级的防重与错误提示。
- 建议：后续统一为公共打印生命周期；不影响本次“正常条件下可以打开”的通过结果。

### P2 — 默认 WebKit E2E 配置会被生产 PWA Service Worker 干扰

- 现象：默认 WebKit 全文件运行中，二维码 mock 路由没有接管请求，请求落到本地服务并返回 403，打印页未生成。
- 定位：失败 trace 明确显示 `/customer-status-links/issue` 返回 403；在测试上下文阻止 Service Worker 后，同一 WebKit 打印用例通过。
- 结论：这是测试环境隔离问题，不是打印代码在 WebKit 中必然失败；但会导致 Safari 回归测试产生假阴性。
- 建议：WebKit 打印测试固定使用 `serviceWorkers: "block"` 或在专用测试构建中禁用 PWA 注册。

## 四、权限与前置条件核对

工单打印在正常设计下必须同时满足：

1. 当前店铺有效且用户能查看目标工单；
2. 门店输出身份完整，包括店铺名称、地址/联系方式、消息签名和打印页脚等必填资料；
3. 客户查询二维码功能已启用；
4. 工单未作废、未软删除；
5. 单张打印：owner、manager、sales、具备当前店铺成员身份的 technician；
6. 批量打印：仅拥有 `order:export` 的 owner；
7. 批量一次最多 50 单；二维码签发失败或返回不完整时不进入打印。

库存保修票据只对已售商品提供入口，并在门店输出身份不完整时禁用打印。回收凭据当前没有同等级门禁。

## 五、测试证据

| 检查 | 结果 |
|---|---|
| 打印相关 Vitest：生命周期、门店资料、PrintPortal、工单 sheet、列表 sheet、库存票据、订单打印权限 | 7 files / 87 tests passed |
| Chromium `print-safari-reliability.spec.ts` | 5 / 5 passed |
| WebKit 默认全文件 | 3 passed / 2 failed；打印失败由生产 PWA Service Worker 绕过测试路由造成；另一失败为公共状态登录跳转，与打印无关 |
| WebKit 打印受控复测（阻止 Service Worker） | 1 / 1 passed |
| 库存票据 Chromium 临时审计用例 | 1 / 1 passed |
| 库存票据 WebKit 临时审计用例 | 1 / 1 passed |
| ESLint | passed |
| TypeScript `tsc --noEmit` | passed |
| 优化构建 | 本轮主动构建第一次被另一个正在运行的 Next build 锁阻止；随后工作区出现有效 `BUILD_ID`，但不把其他进程的完成记为本任务独立通过证据 |

可视证据：

- 工单 WebKit 打印媒体：`screenshots/TASK-20260720-003-smart-print-qr/print-media-webkit-1440.png`
- 工单 Chromium 打印媒体：`screenshots/TASK-20260720-003-smart-print-qr/print-media-chromium-1440.png`
- 库存保修票据 WebKit 页面与打印区域：`screenshots/TASK-20260723-007-all-print-functions-audit/inventory-receipt-print-webkit.png`
- Chromium 生成 PDF：标准单张、批量两张、超长内容多页均位于 `screenshots/TASK-20260720-003-smart-print-qr/`

## 六、Safari 与物理打印限制

- WebKit 自动化已证明打印 DOM 会生成、非打印 shell 在打印媒体下计算为隐藏、打印 sheet 计算为显示，且工单页面宽度证据未见右侧裁切。
- 自动化不能打开并检查 macOS Safari 原生系统打印窗口，也不能判断具体打印机驱动是否缩放、裁边或更换纸张方向。
- 因老板此前提供过 Safari 原生预览右侧缺块截图，本项不能仅凭 WebKit 自动化升级为完全 PASS。发布前仍建议在真实 Safari 中使用 A4、缩放 100%、默认边距，分别打印：普通工单、长诊断工单、两单批量和库存票据。

## 七、最终判定

**不建议把“所有打印功能正常”作为当前结论。**

- 工单打印：有条件通过；正常角色和正常配置下已验证可打开、可生成打印内容。
- 库存保修票据：有条件通过；正常条件下已验证可打开。
- 回收凭据：失败；按钮实现不符合正式凭据打印要求。
- Safari/物理打印：仍需一次实机人工验收。

本任务遵照老板要求只做检查和报告，未修复上述业务逻辑，也未部署生产。
