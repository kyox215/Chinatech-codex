---
name: cross-session-orchestration
description: 用于 RepairDesk 新窗口、跨会话、多窗口并行、另开任务、继续或恢复、暂停、取消、查看进度，或任何可能与现有非终态任务并发的非微小任务；新顶层窗口始终先加载此路由，登记并显式绑定 project/task/run/window，验证不可变 Context Packet 和所有权后再执行；确认是简单独立只读问答后可快速退出而不登记。
---

# RepairDesk 跨会话调度

## 目标

在多个顶层 Codex 窗口之间建立明确身份和可恢复上下文。把 SQLite Registry 当作运行时身份事实源，把 Task Memory 当作审计投影，把 `ACTIVE_CONTEXT.md` 仅当作前台提示。

此 Skill 自动触发后，不要求老板填写模板、选择 Agent、提供 task ID 或安排窗口。

## 启动协议

1. 读取 `AGENTS.md`、`.ai-company/orchestration.json` 和 `docs/CROSS_SESSION_ORCHESTRATION_DECLARATION.md`。
2. 把当前顶层窗口视为 `UNBOUND`。在绑定完成前只做只读检查。
3. 从仓库根运行：

```bash
/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- doctor
/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- status
```

4. Registry 尚未初始化且配置已启用时，只执行可逆本地初始化：

```bash
/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- init
```

5. 根据老板自然语言和 Registry/Task Memory 证据选择“新任务”或“恢复任务”。存在多个合理候选且无法从当前指令确定时保持只读，只询问业务目标，不要求内部 ID。
6. 明确 project/task/run/window/role，绑定后生成并校验不可变 Context Packet。
7. 再执行任务接收、风险分类、worktree/Writer 分配、实施和验证流程。

若确认请求是完全独立的简单只读问答，且不会写仓库、Task Memory、Registry、Git 或外部状态，可在第 3 步后快速退出而不登记。

## 新任务

为独立目标创建新的 Task Memory；如果已有前台任务，使用 `--allow-parallel` 并保持其 `ACTIVE_CONTEXT.md` 不变：

```bash
/opt/homebrew/bin/python3.12 tools/ai_company.py new-task \
  --title "<owner objective>" \
  --task-id <TASK-ID> \
  --allow-parallel

/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- task-register \
  --task-id <TASK-ID> --command-id <CMD-TASK-REGISTER>

/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- run-register \
  --task-id <TASK-ID> --run-id <RUN-ID> \
  --instruction-version 1 --command-id <CMD-RUN-REGISTER>
```

普通首个任务可成为前台。只有老板明确要求切换或调度判断确需切换时才给 legacy 命令加 `--activate`。

## 恢复任务

1. 从 Registry `status` 读取 open task/run，不扫描历史 `TASK.md` 状态推断运行任务。
2. 核对目标 Task Memory 的合同、最新 checkpoint、handoff、Git/worktree 状态。
3. 为新窗口生成新 `window_id`；不得复用另一个窗口身份或把旧窗口重绑到新任务。
4. 绑定最小角色：

```bash
/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- window-bind \
  --task-id <TASK-ID> --run-id <RUN-ID> \
  --window-id <WINDOW-ID> --role <ROLE> \
  --command-id <CMD-WINDOW-BIND>
```

5. 生成 Context Packet：

```bash
/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- context-issue \
  --task-id <TASK-ID> --run-id <RUN-ID> \
  --window-id <WINDOW-ID> --instruction-version <VERSION>
```

6. 读取前验证文件 SHA-256 与 Registry 一致。版本过期、文件缺失、内容变化或身份不匹配时 fail closed。

## Worker 与工作包

只有任务已批准委派、窗口已绑定且文件所有权互斥时才登记 Worker/WP：

```bash
/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- worker-register \
  --task-id <TASK-ID> --run-id <RUN-ID> --window-id <WRITER-WINDOW-ID> \
  --worker-id <WORKER-ID> --role writer --command-id <CMD-WORKER-REGISTER>

/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- wp-register \
  --task-id <TASK-ID> --run-id <RUN-ID> --window-id <CONTROLLER-WINDOW-ID> --wp-id <WP-ID> \
  --command-id <CMD-WP-REGISTER>

/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- wp-claim \
  --task-id <TASK-ID> --run-id <RUN-ID> --window-id <WRITER-WINDOW-ID> \
  --worker-id <WORKER-ID> --wp-id <WP-ID> --expected-version 1 \
  --command-id <CMD-WP-CLAIM>

/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- wp-complete \
  --task-id <TASK-ID> --run-id <RUN-ID> --window-id <WRITER-WINDOW-ID> \
  --worker-id <WORKER-ID> --wp-id <WP-ID> --expected-version 2 \
  --command-id <CMD-WP-COMPLETE>
```

Controller 窗口负责登记 WP，另一个绑定为 `writer` 的窗口登记同角色 Worker 后 claim/complete。每个不同状态转换必须使用独立 command ID；只有重试同一转换时复用该 ID。Reviewer/Observer 只做只读复核，不能 claim 可执行 WP。CAS 失败表示其他 Worker 已获胜或版本已变化。停止写入并报告 Controller；不得换 command ID 偷抢。成功 Worker 必须先 `wp-complete`，再释放窗口；正式完成不会在 task/run close 时被改成 cancelled。

## 最终集成

只有绑定为 `integration_lead` 的窗口才可请求项目集成 lease：

```bash
/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- lease-acquire \
  --window-id <WINDOW-ID> --command-id <CMD-LEASE-ACQUIRE>
```

获得 lease 只排除双总控，不授权 commit、push、deploy、migration 或生产操作。继续执行原有 Owner 批准、release governance 和 quality gate。

Phase 0A lease 是带版本和过期时间的协作式 fencing token，不能把外部 Git 操作纳入 SQLite 事务。每个物质集成步骤前后都重新用 `status` 验证 holder/version/expiry；续租使用新的 command ID，释放时提供当前 `expected-version`。

## 指令变化、暂停和取消

- “补充/改成/不要”：先更新任务合同，再由当前 Controller 运行 `instruction-advance`；旧 Context Packet 保持不可变，为新版本签发新 Packet。
- “暂停”：checkpoint 当前证据、Writer/worktree/阻塞和恢复动作；不删除。
- “取消”：保留 Task Memory、分支和未提交证据；由有效 integration lease holder 使用 `task-close --status cancelled` 同步 Registry。
- “暂停”：Phase 0A 仅记录 Task Memory checkpoint 并停止新 claim；Registry 的正式 pause/resume 状态仍属于 Phase 0B，不得伪造已同步。

## 强制边界

- 绑定不是授权。不得因绑定自行获得 Controller、Writer、路径、worktree、integration、release 或生产权限；integration lease 只能关闭 holder 自身绑定的 task/run。
- 不得自动创建/接管/清理 worktree，不得 stage、commit、push、deploy、migrate，不得处理 secret 或完整客户 PII。
- 不得把聊天历史、cwd、分支或 `ACTIVE_CONTEXT.md` 当作任务身份。
- 不得把一个任务的 `ACTIVE_CONTEXT`、checkpoint、evidence 或 marker 放入另一个任务的 Context Packet。
- 不得覆盖或重建 Context Packet；同版本内容变化必须拒绝。
- 不得静默重建损坏 Registry、回退到每个 worktree 的独立 Registry，或偷取未过期 lease。
- Registry/身份/版本/候选任务歧义失败时保持只读并 fail closed；已存在但损坏或缺少布尔 `enabled` 的 orchestration 配置不得回退到 `ACTIVE_CONTEXT`。
- Phase 0A 是同一电脑用户下的协作隔离，不是 OS 级机密沙箱，也不控制任意已打开 GUI 会话。

## 关闭前验证

运行并记录：

```bash
/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- doctor
PYTHONPATH=tools /opt/homebrew/bin/python3.12 -m unittest discover -s tools/orchestration/tests -p 'test_*.py' -v
/opt/homebrew/bin/python3.12 tools/ai_company.py validate --strict
git diff --check
```

最终窗口还必须验证 integration lease、Task Memory、工作树、测试证据和远端状态；无 UI 的纯调度任务明确记录“无相关任务页面可截图”。
