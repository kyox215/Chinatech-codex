# HOOKS AND RULES POLICY

## 1. Hooks

Hooks 是在 Codex 生命周期运行的确定性脚本。本项目只允许：

- 读取已批准的项目记忆。
- 维护本地状态标记。
- 做秘密格式检测或一致性校验。
- 提示缺失检查点。

默认禁止 Hook：

- 静默上传对话、代码或个人数据。
- 直接修改业务代码。
- 自动批准高风险操作。
- 用 Hook 输出伪装成已验证业务事实。
- 保存完整 shell 命令、环境变量或凭据。

Hook 内容变化后必须重新审查信任。

## 2. Rules

Rules 只控制在沙箱外执行命令时的 allow/prompt/forbidden 决策。它们不是：

- 完整 shell 解析器。
- 云 IAM。
- 数据库权限。
- CI/CD 审批。
- 代码安全扫描器。

本项目默认：

- 发布、推送、合并、部署、基础设施和迁移命令使用 `prompt`。
- 明显灾难性命令使用 `forbidden`。
- 不大范围 allow 未知命令。

Rules 属于实验性功能。每次 Codex 大版本更新或规则修改后，使用 `codex execpolicy check` 测试。

## 3. 审批分层

```text
AGENTS 行为制度
+ Codex sandbox
+ approval policy
+ project Rules
+ OS / Git / cloud / DB 真实权限
+ 人工批准
```

任何一层都不能替代其他层。
