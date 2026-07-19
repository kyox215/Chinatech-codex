# Phase Plan — AI Assistant Voice Input

每个阶段开始前重新读取本文件；阶段结束后更新状态、证据和下一动作。

## Phase 0 — Context and official capability research

- Status: completed
- Inputs: root rules, AI task memory, user screenshot, WebKit and W3C primary sources.
- Exit: current UI, privacy boundary, Safari progressive-enhancement requirement and production approval boundary are explicit.
- Evidence: `EVIDENCE.md` E-001 through E-006.

## Phase 1 — Product, UX, threat model and change contract

- Status: completed
- Work: define main/error/cancel flows, accessibility, 800-character boundary, no-auto-submit rule, no-audio-storage rule and rollback.
- Exit: `TASK.md`, `PRD.md`, `APPROVALS.md` exist before application code writes.
- Evidence: `EVIDENCE.md` E-007.

## Phase 2 — Single-writer implementation and focused regression

- Status: completed
- Work: feature-specific browser voice hook, AI Sheet microphone UI, privacy copy and component tests.
- Exit: focused component tests and typecheck pass; diff stays within approved files.
- Stop: any need for server audio upload, new dependency, secret, production flag or API contract change triggers reclassification.

## Phase 3 — Full quality, security and documentation gate

- Status: completed
- Work: lint, typecheck, full Vitest, build, diff review, threat-model review and documentation drift check.
- Exit: QA is PASS or PASS_WITH_ACCEPTED_RISK; no blocker/major security finding.

## Phase 4 — Visual evidence and release decision

- Status: completed
- Work: mobile browser verification at 390x844 and 430x932, overflow assertion, screenshot, checkpoint and owner-facing release packet.
- Exit: local candidate is verified and recoverable. Production remains unchanged unless a separate D4 is explicitly approved.

## Approved file contract

- `src/features/ai-assistant/components/ai-assistant-sheet.tsx`
- `src/features/ai-assistant/components/ai-assistant-sheet.test.tsx`
- `src/features/ai-assistant/components/use-ai-assistant-voice-input.ts`
- `tests/e2e/ai-assistant-staff.spec.ts`
- `docs/AI_ASSISTANT_VOICE_INPUT.md`
- `.ai-company/memory/tasks/TASK-20260719-001-ai-assistant-voice-input/*`
- task-scoped screenshots only

No database, API, environment, dependency, lockfile, auth, permission or production configuration files are approved.
