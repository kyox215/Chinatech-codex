# 工作区、产物与保留约定

本约定用于修复 2026-09-25 审计 WS-01、04、07–10、17、20。它不证明历史文件已获准删除，也不代替 Registry 身份校验。

## 唯一源码入口

运行输入是根目录 `src/`、`public/`、`scripts/` 和配置/锁文件。`src/app/` 保持路由边界，业务在 `features/`，跨域实体在 `entities/`，无业务依赖的能力在 `shared/`。`work/`、`exports/` 和 `archive.local/` 都不是第二个正式应用；不能从它们借用凭据或当作当前发布版本。

`work/` 为本地副本，整体 Git 忽略；本次添加规则时没有已跟踪文件。需要长期保存的结论应提取到 `docs/`，需要保留的候选代码应通过独立分支/工作树管理。不得把整个历史应用重新复制到源码目录。

## 产物查找和保留

| 目录 | 职责 | 保留与清理 |
|---|---|---|
| `test-results/`、`playwright-report/`、`coverage/` | 每次验证的临时输出 | 不进入 Git；失败 trace 保留。E2E 截图写入按运行标识隔离的 evidence 子目录 |
| `artifacts/<task-or-date>/` | 经挑选的可审查验证证据 | 每包 README 写环境、源码、命令、结果、截图和限制；不保存完整测试缓存 |
| `screenshots/` | 已有历史视觉证据 | 保留现有链接，不再将普通回归结果写入旧任务目录；新证据优先归入 artifacts |
| `exports/` | 明确交付给人的导出包 | 必须标记时间、来源和用途；不作为运行或依赖来源 |
| `outputs/` | 当前明确任务的临时交付 | 若含客户数据，按原任务保留授权处理，不默认打开或上传 |
| `archive.local/` | 本地恢复材料 | 不进入 Git；移动到这里不会释放磁盘空间 |
| `.ai-company/memory/tasks/` | 可恢复任务结论 | 任务自身更新；不能为清理界面关闭其他任务 |

现有截图进入 Git 的历史不重写。以后仅挑选能说明行为/布局的脱敏样本；大量重复运行结果由 CI artifact 保留，源码只记录证据入口。重复文件只有在哈希相同、引用已核对、主副本已确定且恢复清单存在时才进入清理候选。

## 缓存与工作树

删除 `.next/` 前先核对服务 PID 的 cwd 与端口，停止本任务拥有的服务后再处理；不能因为缓存大就清除其他窗口使用的目录。独立验证使用独立构建目录，避免改动当前预览的生成类型和缓存。

`git worktree list --porcelain` 的 prunable 标记只是 Git 元数据提示。先保存登记清单、核对离线挂载/路径/唯一提交和任务所有权，再执行限定清理；不能依据“目录不存在”删除分支或关闭任务。

## 检查范围

`tools/ai_company.py validate --strict` 检查 canonical 文档，包括 `docs/archive/`，排除根目录本地副本 `work/` 与 `archive.local/`；从当前文档指向这些位置的链接仍检查目标是否存在。历史副本的问题可以单独审查，不能作为当前源码门禁失败，也不能被当成已经修好。

`tsconfig.json` 排除 Next dev 临时生成类型，仍检查生产生成类型。带空格/数字后缀的排除只用于 macOS 重复副本，不排除正常 `src/`。`tsconfig.scripts.json` 将维护脚本纳入独立类型检查，不执行脚本或数据操作。

`.ai-company/orchestration.json` 的 14 天为保留目标，不是自动删除作业。清理运行态之前必须排除 open task/run、bound window、活动 lease、被 Context Packet 引用的文件和所有可恢复检查点；自动清理机制尚未实现，不能宣称到期即清理。

## 本轮证据

- [整改前审计](WORKSPACE_LOADING_BUSINESS_AUDIT_2026-09-25.md)
- [45 项整改进度](AUDIT_REMEDIATION_2026-09-25.md)
- 初始工作区清单：`../artifacts/audit-remediation-20260925/baseline-status.txt`（本地证据）
- 初始跟踪文件 SHA-256：`../artifacts/audit-remediation-20260925/baseline-sha256.json`（本地证据）
