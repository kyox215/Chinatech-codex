# MEMORY NATIVE BRIDGE — 仓库记忆与 Codex Memories

## 1. 两类记忆

### 正式组织记忆

位置：`.ai-company/memory/`。

用途：规则、事实、架构、决策、任务状态、部门知识、能力证据。

特性：项目共享、版本控制、可审计、可引用、可复审。

### Codex 原生 Memories

位置和生命周期由 Codex 管理。

用途：稳定个人偏好、重复工作方式、常用技术栈和已知坑。

特性：本地辅助回忆，可能延迟生成，不应作为必须遵守规则的唯一来源。

## 2. 写入边界

| 内容 | 正式记忆 | 原生 Memories |
|---|---|---|
| 业务规则 | 必须 | 可辅助 |
| 权限模型 | 必须 | 不可单独依赖 |
| ADR | 必须 | 可摘要 |
| 当前任务状态 | 必须 | 不推荐 |
| 个人格式偏好 | 可选 | 适合 |
| 秘密/Token | 禁止 | 禁止 |
| 隐藏思维链 | 禁止 | 禁止 |
| 可复用失败经验 | 必须带证据 | 可辅助 |

## 3. SessionStart Bridge

`.codex/hooks/session_start_memory.py`：

1. 找到仓库根目录。
2. 读取 settings 中的上下文预算。
3. 加载 ACTIVE_CONTEXT 和 PROJECT_MEMORY。
4. 若存在 current_task_id，加载任务摘要和最新检查点。
5. 加载 OPEN_CONFLICTS。
6. 输出一段最小开发者上下文。

Hook 不修改记忆、不调用模型、不读取秘密文件、不上传数据。

## 4. SubagentStart Role Bridge

`.codex/hooks/subagent_context.py` 在专业子 Agent 启动时按角色注入：

- 当前任务和最近检查点；
- 该 Agent 的正式能力与权限档案；
- 项目事实和未解决冲突；
- 只与该角色相关的部门记忆。

例如产品 Agent 默认读取产品部门记忆，但不会读取安全部门的全部内部记录。子 Agent 必须把新发现以证据和 Memory Delta 返回给主线程，不能自行提高能力等级或扩大权限。

## 5. Dirty Marker

PostToolUse Hook 只记录：

- 是否可能发生写入。
- 时间。
- 工具类别。
- 命令的不可逆哈希，而不是命令正文。

它不证明文件真的变化，也不替代 Git diff。检查点 CLI 清除标记。

## 6. Stop Guard

默认仅提醒，不阻断。设置 `strict_memory_gate = true` 后可以要求先完成检查点，但启用前应在实际项目验证，避免循环或误阻断。

## 7. 记忆冲突

遇到冲突：

1. 不覆盖旧记录。
2. 创建冲突 ID。
3. 引用双方来源。
4. 标明当前运行时观察。
5. 指定决策 owner 和复审条件。
6. 解决后使用 supersedes，而不是删除历史。

## 8. 长上下文

当上下文接近压缩：

- 先运行 `$memory-checkpoint`。
- 把当前计划、完成项、决定、证据、阻塞和下一步写入任务目录。
- 压缩后运行 `$context-rehydrate`。
- 不依赖压缩摘要记住关键审批。
