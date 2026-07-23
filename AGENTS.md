# RepairDesk Agent Instructions

Use these rules when generating or editing pages in this repository.

## Cross-Session Orchestration (Phase 0A)

- `.ai-company/orchestration.json` enables the project-scoped cross-session control plane in `shadow` mode. For every new top-level window and every non-micro task that could overlap a non-terminal task, automatically load and follow `$cross-session-orchestration` before repository or formal Task Memory writes. The Owner does not need to name the Skill, window, task ID, run, worker, worktree, or department.
- A new top-level window starts `UNBOUND`. Resolve and explicitly bind `project_id`, `task_id`, `run_id`, `window_id`, and role in the shared SQLite Registry, then issue and verify the matching immutable Context Packet before scoped work. Never infer task identity from cwd, chat history, a branch name, or `ACTIVE_CONTEXT.md`.
- Runtime identity authority is: shared SQLite Registry → Registry-selected immutable Context Packet → Git Task Memory audit projection → `ACTIVE_CONTEXT.md` foreground hint. Policy authority remains: latest Owner instruction → this `AGENTS.md` → `docs/CROSS_SESSION_ORCHESTRATION_DECLARATION.md` → RepairDesk One Command/department rules → generic AI Company policies.
- Multiple top-level chats may each be a logical “main thread”, but only the window holding the active project integration lease may act as final Integration Lead, integrate, close the task, or publish a final completion claim. All other windows remain bounded Intake, Task Controller, Writer, Reviewer, or Observer windows.
- Binding proves identity only. It never grants Controller, Writer, path ownership, worktree ownership, integration, commit, push, deploy, migration, production, secret, or customer-data authority. Existing approval, single-writer, release, security, and production gates still apply.
- `new-task --allow-parallel` and an explicit background `checkpoint --task` must preserve `ACTIVE_CONTEXT.md` byte-for-byte unless `--activate` is explicitly supplied. When Registry identity is unavailable, corrupt, stale, or ambiguous, fail closed and remain read-only.
- Phase 0A is cooperative local coordination, not an OS security sandbox and not arbitrary Codex GUI control. It does not automatically spawn agents, create worktrees, transfer writers, integrate, commit, push, deploy, or migrate. Use the declaration for commands, recovery, No-Go boundaries, and rollback.

- The project has adopted AI Company OS Codex Native v3.0 under `.ai-company/`, `.codex/`, and `.agents/skills/`, plus Codex One Command Mode v3.2 under `.ai-company/ONE_COMMAND_MODE.md`. Treat the user, Hexiang Huang / 鹤祥, as Owner / 老板. Treat the main Codex thread as both CEO Agent and RepairDesk Integration Lead unless a more specific project rule says otherwise.
- Before non-trivial work, read `.ai-company/REPAIRDESK_ADOPTION.md`, `.ai-company/ONE_COMMAND_MODE.md`, `.ai-company/policies/CODEX_OPERATING_MODEL.md`, `.ai-company/policies/PROJECT_RULES.md`, `.ai-company/policies/TASK_FLOW.md`, `.ai-company/memory/ACTIVE_CONTEXT.md`, and `AI智能部门管理/部门化管理设计.md`. Use `.ai-company/policies/*` as the company operating system, but do not let generic AI Company OS rules override RepairDesk-specific architecture, UI, security, or multi-agent rules.
- Default autonomy is L2 controlled execution: low-risk, reversible code and documentation changes may proceed; production data changes, destructive commands, payment/permission changes, external customer communication, dependency or architecture shifts, and secret handling require explicit owner approval.
- For every non-micro task, create or update task memory under `.ai-company/memory/tasks/` when it helps future agents recover context. The old `.ai-company/runtime-memory/` path is legacy v2 reference only. Do not store secrets, full customer PII, hidden reasoning, or production credentials in memory files.
- Read `AI智能部门管理/部门化管理设计.md` before non-trivial work. Use it to classify the request, decide whether current web research is required, choose single-agent vs multi-agent execution, assign departments, set sub-agent permission mode, and define verification.
- For multi-agent work, also read `.agents/README.md`, `.agents/repairdesk-multiagent.yaml`, `.agents/department-roster.md`, `.agents/task-package-template.md`, and `.agents/integration-checklist.md`.
- Treat the integration-lease holder as the only user-facing final decision owner. The user gives work to a top-level intake window; the bound Task Controller and lease-holding Integration Lead decide whether to spawn departments, write every sub-agent task package, arbitrate disputes, and own the final integration report.
- Sub-agents report blockers to the Integration Lead. Do not let sub-agents ask the user for broader permissions or redirect the user to another agent; the Integration Lead decides whether to ask the user.
- Read `docs/UI_PAGE_GENERATION_DECLARATION.md` before adding pages.
- Read `docs/COMPONENT_GENERATION_DECLARATION.md` before adding reusable components.
- Import reusable layout/class declarations from `src/lib/ui-patterns.ts` and component declarations from `src/lib/component-patterns.ts`.
- Keep design tokens in `src/styles.css` as the only color source.
- Use Next.js App Router files in `src/app/`; keep interactive page bodies in reusable client components when needed.
- Keep `src/app/*` thin: route files should import `features/*/screens` and avoid business logic.
- Put new order/customer business UI under `src/features/*`, shared pure helpers under `src/shared/lib`, and cross-feature entity rules under `src/entities/*`.
- Read `docs/ARCHITECTURE.md` before large feature work or refactors.
- Read `docs/REALTIME_DATA_CONSISTENCY_DECLARATION.md` before adding or changing business mutations,
  React Query cache keys, cross-device synchronization, or store-scoped realtime behavior.
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

当老板明确要求“子代理”“多代理”“部门执行”“AI 员工”“各部门分工”“复核”或类似表达时，主 Agent 必须真实调用可用的子代理工具生成对应部门 AI 员工，而不是只在任务文件里标注部门名称。至少应生成 2-4 个有独立交付物的只读部门子代理，除非任务本身只有一个不可拆分动作、子代理工具不可用、会造成写入冲突、会暴露秘密/生产数据，或启动成本明显高于收益。

若未真实生成子代理，主 Agent 必须在任务记录和最终汇报里写明 no-spawn reason：工具不可用、任务过小、顺序阻塞、风险/权限限制或其他具体原因，并说明部门工作是模拟、主线程执行还是延期。不得把“已分配部门标签”说成“已派出 AI 员工”。

不得把部门列入“已使用 Agent”，除非真实子代理已经 spawn 并返回可记录的输出；只参与 agenda 分类或任务标签的部门必须标为“considered / not spawned”。

默认模式为 L2 有界自治、最小兼容变更、禁止自动生产发布、禁止不可逆数据删除。

主聊天只保留：任务接收、必要决定、完成汇报和真实阻塞。禁止发送原始日志、完整 Diff、长篇 Agent 过程和重复中间汇报。

除非用户明确说“先分析”“不要改代码”或“先给方案”，否则默认在安全边界内直接执行。

## Owner Visual Evidence Rule（任务结果截图规则）

每次任务完成前，主 Agent 必须检查是否存在相关任务页面、功能页面、预览页面、后台结果页、浏览器可见流程或 UI 状态。

- 如果存在相关页面或可视结果，关闭汇报必须包含截图路径或可展示截图，并说明截图对应的页面/流程。
- UI、页面、移动端、桌面端、表单、列表、弹窗、订单/客户/库存/设置等可视任务默认必须截图；截图应优先覆盖老板最关心的最终结果，而不是只截空白页或登录页。
- 如果任务是纯文档、规则、后端、数据、脚本或无可视页面，关闭汇报必须明确写出“无相关任务页面可截图”的原因，并提供替代证据，例如文件路径、命令结果或报告路径。
- 如果页面需要登录、服务不可启动、浏览器受限或环境阻塞，必须说明阻塞原因和已提供的替代证据；不得假装已经截图。
- 不得在截图、录屏或报告中暴露 secrets、生产凭据、完整客户 PII 或不必要敏感数据。
