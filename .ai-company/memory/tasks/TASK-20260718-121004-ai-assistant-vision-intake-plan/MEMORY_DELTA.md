# Memory Delta — TASK-20260718-121004-ai-assistant-vision-intake-plan

## Candidate project facts

- `observed`：RepairDesk 已有条码/OCR、IMEI Luhn、私有附件、BFF、权限、库存和审计基础，可作为 AI 助手底座。来源见 `EVIDENCE.md`。
- `observed`：当前库存字段缺少独立 RAM 和规范化多标识符集合。来源见 `EVIDENCE.md`。

## Candidate decisions / ADRs

- `proposed`：内部首版使用 Next.js BFF + OpenAI Responses API + 严格工具白名单。
- `proposed`：AI 只查询、识别和准备草稿；正式写入走现有业务服务并由员工明确确认。
- `proposed`：公开客户助手与员工后台分离，后续单独做认证、隐私和滥用评审。
- `proposed`：MVP 先不迁移数据库；业务价值通过后再 additive expand RAM、多标识符和 AI 草稿表。

以上均待 Owner 批准，未提升为项目长期规则或批准 ADR。

## Department memory sync

- 不更新长期部门记忆：本轮是一次性规划，关键结论仍为 `proposed`，不能覆盖现有已批准规则。
- 实施获批后，应把最终数据合同、权限、留存、测试门和回滚 SOP 同步到 Architecture、Data、Security、QA 和 Product 部门记忆。

## Capability review

- 三个只读部门工作包均按边界返回了独立、可集成结论，没有写入冲突或权限越界。
- 这只构成一次任务证据，不建议调整 C0–C4 等级，不改变 Permission 或 Autonomy。
- 未来评估用例：实施后以跨店负面测试、黄金图片集、幂等 E2E、日志脱敏和供应商故障回退复核能力。

## Not promoted

- 模型名称、价格、供应商保留资格和具体阈值可能变化，必须在实施/发布时重新核验，不写入长期事实。
- 用户原图和完整设备标识符不进入任何长期记忆。
