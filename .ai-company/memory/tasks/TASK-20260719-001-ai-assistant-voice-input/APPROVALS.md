# Approval Record

## Approved by current owner request

- Local, reversible implementation of employee AI query voice-to-text.
- Focused and full non-production verification.

## Not approved / separate D4

- Production push/deploy or customer-visible microphone activation.
- Server-side audio upload or OpenAI transcription.
- New secret, paid service, dependency, database/schema, public assistant, Vision, PII or other-store activation.

## Recommended production packet after local verification

- Exact commit and diff allowlist.
- Evidence that raw audio never enters RepairDesk or OpenAI.
- Mobile Safari and keyboard-fallback screenshots/tests.
- Rollback: redeploy previous exact production SHA.
- Observation: 30 minutes for permission errors, unsupported rate, query success and existing AI ledger/audit health; never log transcript/audio.

## Suggested exact D4 wording

> 批准 D4 Voice：将本任务最终 exact SHA 部署到 ChinaTech；仅新增员工订单查询语音转文字。语音由浏览器/设备语音服务处理，RepairDesk 不保存音频，转写不自动发送；Vision、自动写入、公开助手、PII 和其他店铺边界不变。部署后观察 30 分钟；若出现麦克风错误率异常、AI 查询错误或移动布局回归，立即回滚到部署前 exact SHA。
