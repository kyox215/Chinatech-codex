---
schema_version: 1
task_id: "TASK-20260831-001-project-i18n-clean-rebuild"
title: "从远端干净基线重建网站核心中意英语言能力并发布"
status: "active"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "Hexiang Huang / Owner"
departments: ["INT", "ARCH", "UX", "FE", "QA", "DOC", "RELEASE"]
created_at: "2026-08-31T09:50:25Z"
updated_at: "2026-08-31T12:28:46Z"
---
# Task — 从远端干净基线重建网站核心中意英语言能力并发布

## Owner request

- 为网站增加意大利语和英语功能，并显示语言切换选项。
- 丢弃原本地工作区内容，全部从远端 Git 重新拉取后再执行。
- 完成后推送并部署。

## Business value

RepairDesk 门店员工、平台管理员和公开页面用户可在中文、意大利语、英语之间切换界面语言；语言选择可持久化，不改变现有 URL、权限、数据或业务流程。

## Scope in

- 支持且仅支持 `zh-CN`、`it-IT`、`en`，中文为无 Cookie/非法值的确定性默认。
- 全局 locale resolver、Provider、Cookie 持久化、`html lang`、SSR/hydration 一致性和经测试的 `Europe/Rome`/EUR 共享格式化基础。
- 桌面 AppBar、移动 Sidebar、认证/公开壳层的共享语言切换器。
- Shell、导航、命令面板、认证/公开页面、主要业务入口及用户可见 metadata/offline/manifest 文案迁移。
- 字典 key/参数 parity、单元/组件/E2E、响应式/a11y、截图、文档和发布证据。
- 所有门禁通过后，非强制推送精确 SHA 到 `origin/main`，部署既有 Vercel 项目并验证。

## Scope out

- URL locale prefix、域名路由和新增依赖。
- 数据库语言字段、账户偏好同步、schema/migration/API/auth/permission/tenant 变化。
- 翻译姓名、备注、消息、设备/工单标识、状态码、日志、内部 fixture 或原始业务数据。
- 存量 200+ UI 文件中的每一个深层业务表单、弹窗、领域错误与帮助文案；本次以可翻译架构和核心入口为发布单元，深层领域逐功能迁移。
- 存量深层页面中的固定 locale `Intl`/`toLocale*` 显示重构；本次只交付并测试共享 formatter，实际存量显示随领域文案逐功能迁移。
- 改变客户沟通语言、`/r` 意大利语客户页或意大利语打印/保修/法律合同。
- Vercel 项目/域名/环境变量/secret/cron 变更、force push 或生产数据写入。

## Hard constraints

- 基线必须保持为已重新拉取的远端 `origin/main`；旧本地候选和旧任务记忆不得复用。
- 仅一个业务代码写入者；只读 Reviewer 不得修自己的发现。
- 保持现有 URL、中文默认、业务标识、权限、数据和启动/离线/打印语义。
- 不新增 dependency、lockfile、`next.config`、Vercel 配置、schema/migration 或环境变量。
- Do not claim tests, deployment, or approvals that did not occur.
- Owner 已批准当前任务完成后的正常 push 和既有 Vercel deployment；任何扩张到配置、secret、数据、依赖、迁移、force push 或新目标必须重新批准。
- 工作包软边界 45 分钟、硬边界 90 分钟；连续 15 分钟无有效进展即诊断并收口 checkpoint。

## Acceptance criteria

- [x] 三种 locale 的 resolver、Cookie、`html lang`、SSR/hydration、fallback 和 catalog parity 有自动化证据。
- [x] 桌面、移动、认证/公开壳层可见“中文 / Italiano / English”；键盘、`menuitemradio`、`aria-live` 和触控目标合格。
- [x] 切换不 reload、不改 route、不丢 draft/dialog/scroll；当前 locale no-op；Cookie 写失败保留当前 session locale并反馈。
- [x] Shell/nav/command、auth/invite/onboarding/public shell、主要业务入口标题/状态和 metadata/offline/manifest 完成 IT/EN；用户数据和 identifiers 保持原文。
- [x] 深层领域硬编码文案有可重复审计清单与明确非覆盖声明，不得声称所有历史界面已全量翻译。
- [x] 共享 EUR、日期、数字和相对时间 formatter 严格按 locale + `Europe/Rome` 实现并有自动化证据；存量深层显示迁移明确延期。
- [x] 390/430/768/1024/1440 无页面横向溢出，保留脱敏桌面/移动/公开页截图。
- [ ] 最终 exact SHA 上 lint、typecheck、test、build、定向 Chromium/WebKit E2E 与独立 QA/架构/安全复核为 PASS。
- [ ] 最终 diff 无依赖、配置、auth/API/data/schema/migration/secret 漂移；GitHub/Vercel 生产部署对应同一 SHA，并有 READY、alias、2xx、日志和回滚锚点证据。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| canonical 工作树已彻底清理并与 `origin/main` 一致 | verified fact | `git status`; `git rev-parse HEAD origin/main` | baseline `eb45cc65507445292c572c514576715bfffa05aa` |
| 原本地未提交/未跟踪/忽略内容、`.env.local`、依赖缓存、旧任务记忆与 Registry 已删除 | verified fact | Owner destructive authorization; `git reset --hard`; `git clean -ffdx` | 不可从当前工作树恢复；不复用旧候选 |
| 当前代码没有已安装 i18n 依赖，RootLayout 固定 `lang=zh-CN` 且文案硬编码 | verified fact | `package.json`; `src/app/layout.tsx` | 采用无新增依赖方案 |
| Next.js 16.2.11 / React 19.2 / Node >=22.12 | verified fact | `package.json` | 遵守 async server APIs |
| 全站精确用户可见文案清单 | unknown | clean baseline code inventory in progress | Explorer 只读审计后冻结 allowlist |
| 当前 Vercel project、branch protection、回滚 deployment | unknown | 发布阶段在线核验 | 未核验前不得生产 GO |

## Decision and approval points

- 分类：T3 / R3 / L2；跨模块、启动 Provider、广泛 UI 和生产发布影响决定最高风险。
- 已批准：本任务范围内本地实现、测试、正常 commit、非强制 push 到 `origin/main`、既有 Vercel app 部署。
- D3/D4 保留：依赖/配置/secret/schema/migration/auth/API/data/permission/tenant/新部署目标/force push/客户通知。
- 强制独立复核：Architecture/UX（实施前）、QA + Security + Architecture（最终 SHA）。

## Work packages

- WP1 基础：typed catalogs、resolver/provider/server locale、Cookie、formatter、metadata/lang、switcher。
- WP2 Shell：AppBar/Sidebar/navigation/command/auth/public/offline/manifest。
- WP3 业务表面：按 feature 分批迁移主要用户可见文案并保持业务数据语义。
- WP4 输出：metadata、PWA/offline、共享 formatter 合同和 catalog parity 收口；存量深层格式化与固定意大利语客户打印不纳入本批迁移。
- WP5 QA/Release：最终 R3、浏览器矩阵、独立复核、精确推送、Vercel 部署与观察。

## Definition of done

- 上述核心发布验收标准全部映射到 `EVIDENCE.md` 的最终 exact SHA 证据，深层领域迁移清单作为后续工作而非本次“全量完成”声明。
- 无未处置 BLOCKER/MAJOR；Quality Gate 为 PASS，生产部署/alias/smoke/观察成功。
- 文档、任务记忆、变更清单、回滚锚点和剩余风险已同步，任务状态依次进入 VERIFIED/RELEASED/OBSERVING/CLOSED。
