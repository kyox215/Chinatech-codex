# PRD — 员工 AI 查询语音输入

## User story

作为已获 AI 订单查询权限的门店员工，我希望点一下麦克风说出查询条件，先看到并可修改转写文字，再决定是否发送查询。

## State model

```text
checking_support -> unsupported | idle
idle -> requesting_permission -> listening -> processing -> idle
requesting_permission/listening -> cancelled -> idle
requesting_permission/listening/processing -> error -> idle on retry
```

## Main flow

1. 员工打开 AI Sheet。
2. 浏览器支持时麦克风按钮可用；员工点击启动。
3. 浏览器/OS 请求或复用麦克风权限，页面显示“正在听”。
4. 员工说出一次查询并点击停止，或由浏览器结束识别。
5. 文字追加到输入框，最多 800 字。
6. 员工检查、编辑或删除文字；只有点击“发送”才调用现有订单 AI API。

## Error and fallback flow

- Unsupported: 麦克风按钮禁用，显示键盘回退说明。
- Permission denied/service not allowed: 指引到浏览器设置开启麦克风/Siri/听写后重试。
- No speech: 提示未听清，可重试。
- Audio capture: 提示检查麦克风是否被其他应用占用。
- Network/service unavailable: 提示改用键盘。
- Close/store switch/unmount: abort，不保留音频或继续监听。

## Privacy copy contract

- 不声称“完全本地”或“仅设备端”。
- 明确：由浏览器/设备语音服务处理；RepairDesk 不保存录音；转写文字只有手动发送后才进入现有查询流程。
- 继续提示不要说出电话、邮箱、IMEI、证件或银行卡信息。

## Given / When / Then

- Given 浏览器支持且员工有权限，When 点击麦克风，Then 可见且可停止的监听状态开始。
- Given 识别返回文字，When result 事件到达，Then 文字进入输入框且 API 调用次数仍为 0。
- Given 输入已有文字，When 语音完成，Then 以空格安全追加，不覆盖已有文字。
- Given 合并内容超过 800 字，When 结果到达，Then 输入截断到 800 并提示上限。
- Given 权限被拒绝，When 浏览器返回 `not-allowed`，Then 显示可操作提示且键盘仍可用。
- Given Sheet 关闭或门店切换，When 仍在监听，Then 立即 abort 且不会提交查询。

## Non-functional requirements

- 原生 button、可访问名称、`aria-pressed`、`aria-live`。
- 390/430 手机宽度无横向溢出，触控区至少 36px。
- 不新增第三方依赖和 API 成本；不记录原始浏览器错误 message 到用户界面或日志。
