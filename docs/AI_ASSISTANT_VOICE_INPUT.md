# RepairDesk AI 小助手语音输入合同

Status: verified local candidate; production not released
Owner: Integration Lead / Frontend / Security / QA
Task: `TASK-20260719-001-ai-assistant-voice-input`
Last verified: 2026-07-19 CEST

## 目标与边界

员工订单 AI Sheet 可通过麦克风把一次语音转换为可编辑文字，减少移动端键盘输入。语音只负责填充原有 800 字输入框；员工检查或修改后仍必须点击“发送”，现有订单只读工具、PII 门禁、OpenAI 预算、审计和门店隔离完全不变。

本功能不使用 OpenAI Audio/Transcription API，不创建 `MediaRecorder`、音频 Blob、文件上传、浏览器缓存或数据库记录，因此不会新增 RepairDesk API Token 用量或音频存储成本。

## 浏览器能力与兼容策略

- 使用浏览器提供的 `SpeechRecognition` 或 `webkitSpeechRecognition`，仅在客户端运行并在每次使用前做 feature detection。
- Safari 14.1 / iOS 14.5 起 WebKit 提供 SpeechRecognition，并要求系统启用 Siri 或听写；参见 [WebKit Safari 14.1 release note](https://webkit.org/blog/11648/new-webkit-features-in-safari-14-1/)。
- Web Speech API 允许浏览器选择本地或远程语音服务，因此 UI 只能写“由浏览器/设备语音服务处理”，不能承诺完全本地；参见 [W3C Web Speech API draft](https://dvcs.w3.org/hg/speech-api/raw-file/tip/webspeechapi)。
- 浏览器不支持、PWA/内嵌浏览器限制、Siri/听写关闭、权限拒绝或服务失败时，麦克风安全停用或显示错误，原有键盘输入始终可用。

## 用户状态

| 状态        | UI 行为                                       | 可恢复路径                   |
| ----------- | --------------------------------------------- | ---------------------------- |
| Checking    | 麦克风暂时禁用                                | feature detection 完成后更新 |
| Unsupported | 禁用麦克风，显示键盘回退                      | 换受支持浏览器或直接打字     |
| Permission  | 显示“正在请求麦克风权限”                      | 用户允许或取消               |
| Listening   | 危险色停止按钮 + “正在听”                     | 点击停止                     |
| Processing  | 旋转图标，禁止重复启动                        | 等待结果或错误               |
| Success     | 文字进入输入框，提示检查后发送                | 编辑、删除或手动发送         |
| Error       | 权限、无语音、麦克风、网络/服务、语言分别提示 | 修复设置、重试或键盘输入     |

## 隐私与安全合同

- 只有用户点击可见麦克风按钮才调用 `start()`；页面同时提供明显监听状态和停止操作，符合 Web Speech 安全/隐私要求。
- RepairDesk 前端不取得或保存原始音频；浏览器/OS 语音服务的处理和保留受其供应商设置与条款约束。
- UI 继续提示员工不要说出电话、邮箱、IMEI、证件或银行卡信息。
- 转写文字不会自动提交。只有员工手动发送后，文字才进入现有 AI 查询链路并接受既有 800 字限制、敏感输入拒绝和审计/预算控制。
- Sheet 关闭、门店上下文变化、查询提交或组件卸载时立即 `abort()`，避免后台继续监听。
- 原始浏览器错误 message 不展示、不记录，只映射为安全的固定中文提示。

## 验证与发布门禁

本地合并前必须通过：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

并验证 390x844、430x932：无横向溢出、输入字号不触发 iOS 自动缩放、麦克风可启动/停止、文字不自动发送、权限拒绝和 unsupported 回退可用。

生产发布是新的 D4：必须批准客户可见的麦克风权限/第三方浏览器语音服务披露、exact commit、回滚目标和观察窗口。上线后只观察支持率、权限/服务错误和现有查询成功率；禁止记录音频或转写正文。
