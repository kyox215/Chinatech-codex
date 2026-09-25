# ChinatechOS / RepairDesk 项目入口

这里是 Codex 中 **ChinatechOS** 项目绑定的原目录，对应 GitHub `kyox215/Chinatech-codex`。
本文件只提供导航，不替代 `AGENTS.md`、架构声明或任务登记。

## 当前状态与验证入口

当前状态以本工作区的 `git status`、实际测试结果和项目 Registry 为准。下方历史任务说明不代表当前部署版本；不要依据旧端口、旧 SHA 或旧交接中的“最新”字样判断线上状态。

- [2026-09-25 审计报告](docs/WORKSPACE_LOADING_BUSINESS_AUDIT_2026-09-25.md)
- [45 项整改进度](docs/AUDIT_REMEDIATION_2026-09-25.md)
- [目录、产物与保留约定](docs/WORKSPACE_HYGIENE.md)
- 开发前使用 `.nvmrc` 指定或满足 `package.json` engines 的 Node；运行 `npm run check:runtime`。
- 质量门禁：`npm run check`；E2E 使用隔离的合成环境，真实后端验证另行标注。

## 先看哪里

| 目的 | 位置 |
|---|---|
| 修改网站页面、业务功能 | `src/` |
| 路由入口 | `src/app/`；页面主体在 `src/features/` |
| 工单、客户、库存等业务模块 | `src/features/` |
| 跨模块规则与通用能力 | `src/entities/`、`src/shared/` |
| 基础控件与现有共享 UI | `src/components/ui/`、`src/lib/ui-patterns.ts`、`src/lib/component-patterns.ts` |
| 服务端边界 | `src/server/`、各业务模块的 `server/` |
| 数据库版本记录 | `supabase/migrations/`；不是可随意清理的缓存 |
| 回归测试 | 源码旁的 `*.test.*`、`tests/e2e/` |
| 项目架构 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 执行、安全、隔离规则 | [AGENTS.md](AGENTS.md) |


## 哪些不是网站运行源码

- `screenshots/`、`artifacts/`：历史截图与验证证据，先查引用和保留需要，再决定归档。
- `exports/`：历史交付包，不能当作正在运行的第二套源码。
- `work/`：本地工作资料，不能直接视为已发布功能或无用文件。
- `.ai-company/`、`.agents/`、`.codex/`：项目治理和任务记录；不能为了目录简洁批量删除。
- `archive.local/`：仅本地可恢复归档，已由现有 `*.local` 忽略规则排除。
- `node_modules/`：可安装的依赖，但可能被现有预览复用，不随整理删除。
- `.next/`：运行或构建时重新生成的缓存，不是正式源码。

## 开发与验证

使用 Node 22.12+（本轮验证为 Node 24），沿用仓库锁文件。先运行 `npm run check:runtime`，再按改动执行 `npm run check` 与对应 E2E。预览使用隔离模拟入口，不复制生产秘密或写入真实客户数据。

2026-09-09/10 的目录整理与界面任务说明属于历史快照，不能代表当前 Git、服务或部署状态。完整旧入口已保存在本地 `archive.local/audit-remediation-20260925/pre-change/root/README.md`；当前整改状态见上方45项清单。
