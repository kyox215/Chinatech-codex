---
schema_version: 1
task_id: "TASK-20260719-001-ai-assistant-voice-input"
title: "RepairDesk AI 小助手语音输入"
status: "verified"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["FLOW", "UX", "FE", "SEC", "QA", "DOC"]
created_at: "2026-07-19T05:54:52Z"
updated_at: "2026-07-19T06:32:03Z"
---

# Task — RepairDesk AI 小助手语音输入

## Owner request

在现有员工订单查询 AI 小助手中添加语音输入。

## Business value

让门店员工在手机上单手说出查询条件，减少键盘录入时间，同时保留人工确认、现有 PII 门禁和只读查询边界。

## Scope in

- 在现有 AI 查询输入区添加可访问的麦克风按钮。
- 使用浏览器 Web Speech API 把一次语音转换为输入框文字。
- 明确显示请求权限、正在听、停止、成功、无语音、权限拒绝和服务失败状态。
- 语音结果只填入输入框，员工可编辑并必须手动点击“发送”。
- 不支持语音的浏览器安全回退到键盘输入。
- 补齐组件测试、移动端 E2E/截图、隐私说明和任务证据。

## Scope out

- 不使用 OpenAI Audio/Transcription API，不新增模型、Token、API 密钥或计费。
- 不采集、上传、缓存、落库或记录原始音频。
- 不自动提交查询，不改变订单查询 API、AI runtime、预算账本、审计或 PII 过滤。
- 不新增数据库 migration、依赖、公开客户助手、Vision、自动写入或其他门店开关。
- 本任务不自动推送、部署或修改生产配置；生产发布是独立 D4 决定。

## Facts, assumptions, unknowns

| Item                                                                      | Type                             | Evidence                              | Status                  |
| ------------------------------------------------------------------------- | -------------------------------- | ------------------------------------- | ----------------------- |
| 现有生产 UI 是移动 Sheet，输入上限 800 字并需手动发送                     | verified                         | 用户截图；`ai-assistant-sheet.tsx`    | current                 |
| Safari 14.1 / iOS 14.5 起 WebKit 提供 SpeechRecognition，需启用 Siri/听写 | verified external                | WebKit Safari 14.1 release note       | feature-detect anyway   |
| Web Speech recognizer 可由浏览器选择本地或远程服务                        | verified external                | W3C Community Group draft             | UI 不声称完全本地       |
| 当前 iOS Home Screen/PWA 是否在所有版本稳定可用                           | unknown/current-device dependent | WebKit 历史 issue + runtime detection | fail safely to keyboard |
| 浏览器语音服务的数据处理与保留由浏览器/OS 供应商控制                      | verified boundary                | API architecture                      | disclose minimally      |

## Risk and authority

- **Local implementation: R2 / L2 / D2.** 可逆前端增强，但触发麦克风权限并跨越浏览器语音服务信任边界。
- **Production release: R3 / D4.** 需 Owner 明确批准新的麦克风/隐私行为和发布观察；本任务默认停在已验证候选。
- 任务不读取或写入任何 secret、生产 PII、生产订单或数据库。

## Acceptance criteria

- [x] 支持时显示麦克风按钮；用户明确点击后才启动语音。
- [x] 监听中有明显视觉和 `aria-live` 状态，用户可停止。
- [x] 转写文字追加到现有输入，不超过 800 字且绝不自动发送。
- [x] 权限拒绝、无语音、麦克风故障、网络/服务错误有可操作中文提示。
- [x] 不支持时按钮禁用并保留键盘输入；Sheet 关闭、门店切换和组件卸载时立即 abort。
- [x] 不创建 MediaRecorder、Blob、音频上传、OpenAI transcription 或业务数据写入。
- [x] 390x844 与 430x932 无横向溢出，输入控件仍为移动端 16px。
- [x] 相关测试、lint、typecheck、全量 test 和 build 实际通过。
- [x] 提供脱敏移动端截图；生产未部署明确标记为待 D4。

## Agent plan

- `requires_multi_agent: no`
- `spawn_required: no`
- `no_spawn_reason:` 用户未要求多代理；该任务是单一现有组件的有界增强，需要单一写入者，且当前开发者规则禁止无明确要求时 spawn。
- FLOW/UX/FE/SEC/QA/DOC 为 considered / not spawned，由主线程按对应 Skill 执行，不计入“已使用 Agent”。

## Rollback

回退本任务分支的语音 hook、AI Sheet 接入、测试和文档即可；无数据库、环境变量、外部资源或数据清理动作。

## Definition of done

代码与文档同步，验收项有证据，安全/质量门禁给出正式结论，截图可查看；生产发布如未获新 D4，只能标记为已验证候选，不能声称已上线。
