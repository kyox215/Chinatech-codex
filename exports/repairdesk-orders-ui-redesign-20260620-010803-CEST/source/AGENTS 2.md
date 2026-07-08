# RepairDesk Agent Instructions

Use these rules when generating or editing pages in this repository.

- The project has adopted AI Company OS Codex Native v3.0 under `.ai-company/`, `.codex/`, and `.agents/skills/`. Treat the user, Hexiang Huang / 鹤祥, as Owner / 老板. Treat the main Codex thread as both CEO Agent and RepairDesk Integration Lead unless a more specific project rule says otherwise.
- Before non-trivial work, read `.ai-company/REPAIRDESK_ADOPTION.md`, `.ai-company/policies/CODEX_OPERATING_MODEL.md`, `.ai-company/policies/PROJECT_RULES.md`, `.ai-company/policies/TASK_FLOW.md`, `.ai-company/memory/ACTIVE_CONTEXT.md`, and `AI智能部门管理/部门化管理设计.md`. Use `.ai-company/policies/*` as the company operating system, but do not let generic AI Company OS rules override RepairDesk-specific architecture, UI, security, or multi-agent rules.
- Default autonomy is L2 controlled execution: low-risk, reversible code and documentation changes may proceed; production data changes, destructive commands, payment/permission changes, external customer communication, dependency or architecture shifts, and secret handling require explicit owner approval.
- For every non-micro task, create or update task memory under `.ai-company/memory/tasks/` when it helps future agents recover context. The old `.ai-company/runtime-memory/` path is legacy v2 reference only. Do not store secrets, full customer PII, hidden reasoning, or production credentials in memory files.
- Read `AI智能部门管理/部门化管理设计.md` before non-trivial work. Use it to classify the request, decide whether current web research is required, choose single-agent vs multi-agent execution, assign departments, set sub-agent permission mode, and define verification.
- For multi-agent work, also read `.agents/README.md`, `.agents/repairdesk-multiagent.yaml`, `.agents/department-roster.md`, `.agents/task-package-template.md`, and `.agents/integration-checklist.md`.
- Treat the main thread as the only user-facing decision owner. The user gives work to the Integration Lead; the Integration Lead decides whether to spawn departments, writes every sub-agent task package, arbitrates disputes, and owns the final integration report.
- Sub-agents report blockers to the Integration Lead. Do not let sub-agents ask the user for broader permissions or redirect the user to another agent; the Integration Lead decides whether to ask the user.
- Read `docs/UI_PAGE_GENERATION_DECLARATION.md` before adding pages.
- Read `docs/COMPONENT_GENERATION_DECLARATION.md` before adding reusable components.
- Import reusable layout/class declarations from `src/lib/ui-patterns.ts` and component declarations from `src/lib/component-patterns.ts`.
- Keep design tokens in `src/styles.css` as the only color source.
- Use Next.js App Router files in `src/app/`; keep interactive page bodies in reusable client components when needed.
- Keep `src/app/*` thin: route files should import `features/*/screens` and avoid business logic.
- Put new order/customer business UI under `src/features/*`, shared pure helpers under `src/shared/lib`, and cross-feature entity rules under `src/entities/*`.
- Read `docs/ARCHITECTURE.md` before large feature work or refactors.
- Read `docs/RESPONSIVE_DENSITY_PLAN.md` before changing layouts, tables, dialogs, lists, or mobile behavior.
- Mobile detail/task/workflow pages must follow RepairOS Floating Card language from `docs/REPAIROS_COMPACT_ARCHITECTURE.md`: use `repairOs.mobileFloatingPage`, `repairOs.mobileFloatingHeader*`, and `repairOs.mobileInfoCard` instead of hand-written fixed top bars or full-width divider headers.
- Read `docs/REPAIROS_MOBILE_DETAIL_STANDARD.md` before creating or changing mobile detail, task, quote, capture, payment, or workflow pages. The current mobile order detail page is the visual source of truth for typography, card density, color emphasis, finance editing, scan/photo entry, history, and bottom actions.
- Use `@/lib/repairdesk/api` for app data. Do not import `src/server/*` into client components.
- Prefer feature query key factories such as `ordersKeys` and `customersKeys` for React Query caches.
- Reuse `src/components/ui/*` for controls and `src/components/orders/badges.tsx` for order status/type/money/phone rendering.
- New navigation pages must update `AppSidebar`, `AppBar` breadcrumb labels, and `CommandPalette`.
- Do not reintroduce TanStack Router/Start or Vite entrypoints.
- For multi-domain, high-risk, or explicitly delegated work, follow `AI智能部门管理/部门化管理设计.md`: the main thread is the Integration Lead, sub-agents are read-only by default, scoped writes must have disjoint file ownership, and final integration/verification stays in the main thread.
- Keep active sub-agents bounded: prefer 2-4, hard cap 5, close completed agents before spawning more, and never allow overlapping write ownership. QA/security agents stay read-only unless the user and Integration Lead explicitly allow a scoped write.
- Do not let sub-agents stage, commit, push, deploy, run destructive SQL, handle secrets, or perform final integration.
- When the department design file says current external knowledge is required, search the web and prefer official or primary sources. Local repository facts still come from the codebase.
- Validate new UI with `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.

## Owner Simple Mode（最高优先级交互规则）

本项目采用自然语言单入口模式。

用户的正常任务描述即为正式任务输入。不得要求用户填写内部模板、选择 Agent、安排 Side Thread、指定 Skill、维护任务状态或更新记忆。

主 Agent 必须自动：

1. 恢复相关项目与部门记忆；
2. 将自然语言规范化为内部任务合同；
3. 采用保守默认值补全缺失信息；
4. 根据复杂度选择最少必要 Agent；
5. 将详细调查、实施与审查交给 Subagents 或隔离工作环境；
6. 控制单一写入者和文件所有权；
7. 完成测试、审查、文档和记忆同步；
8. 仅在不可逆、高成本、生产、凭据、重大安全/隐私/法律或方向性冲突时请求用户决定。

默认模式为 L2 有界自治、最小兼容变更、禁止自动生产发布、禁止不可逆数据删除。

主聊天只保留：任务接收、必要决定、完成汇报和真实阻塞。禁止发送原始日志、完整 Diff、长篇 Agent 过程和重复中间汇报。

除非用户明确说“先分析”“不要改代码”或“先给方案”，否则默认在安全边界内直接执行。
