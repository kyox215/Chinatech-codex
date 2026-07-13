# Evidence Index - TASK-20260713-002-order-search-grouped-results

| ID | Type | Claim | Source | Result |
|---|---|---|---|---|
| E-001 | owner request | 规划已确认并要求开始执行 | 当前任务对话 | observed |
| E-002 | workspace | 使用最新 main 隔离工作树，原脏工作区与 Settings Center 不动 | worktree/status inspection | `origin/main@080bd21b` clean |
| E-003 | code baseline | 查询已有 `isFetching`/AbortSignal/keepPreviousData，但缺少可见反馈且输入即时触发 | order list screen/query options | verified |
| E-004 | sort baseline | 当前为 queue/workflow/status/updated_at desc，不符合最终两级合同 | order repository/mock | verified |
| E-005 | implementation | 搜索 draft/commit、防抖、Enter/扫码、加载/成功/空/错误反馈已接入移动和桌面 | `use-order-search-input.ts`; `order-search-feedback.tsx`; `order-list-screen.tsx` | implemented |
| E-006 | implementation | 共享纯模型在 repository/mock 分页前按状态和 `created_at ASC` 排序，并返回精确结果组计数 | `order-list-grouping.ts`; repository; mock; `OrderListResult` | implemented |
| E-007 | implementation | 移动/桌面列表显示分组、本页/总数和送修日期；详情显示送修与当前状态时间 | list components; detail screen; overview tab | implemented |
| E-008 | automated tests | 防抖、立即提交、反馈状态、清空搜索保留提示、八组顺序、稳定并列、状态时间和权限投影均有回归覆盖 | focused + full Vitest | 131 files / 898 tests passed |
| E-009 | quality gates | 项目规则、lint、类型、完整测试和 production build 通过 | `agents:check`; lint; typecheck; test; `next build --webpack` | 22 routes built |
| E-010 | build environment | 默认 Turbopack build 仅因隔离工作树的外部 `node_modules` 符号链接被拒绝 | build panic message; Webpack fallback | tooling-only; code build passed |
| E-011 | browser search | 输入后立即显示准备搜索，完成显示查询词、9 条总数、6 待办、3 历史；空结果显示 0 与专用空态 | in-app browser local mock | passed |
| E-012 | responsive UI | 320/390/430 移动状态网格无横向滚动/遮挡，1280/1440 桌面工具栏与列表无溢出 | `screenshots/TASK-20260713-002-order-search-grouped-results/` + DOM metrics | passed |
| E-013 | detail dates | 移动和桌面详情均显示 Europe/Rome 送修时间与当前状态时间，页面无横向溢出 | detail screenshots + DOM snapshot | passed |
| E-014 | permission regression | 默认仍排除完成/作废；授权搜索可见历史结果；技术人员作用域和金额/导出投影代码未放宽，原权限测试全绿 | repository tests + full suite | passed |
| E-015 | documentation | 权威订单规范及前端/后端部门记忆同步新排序与搜索反馈合同 | `docs/ORDERS_SPEC.md`; department memory | updated |
| E-016 | QA review | 清空搜索反馈、真实状态跃迁和加载中清除按钮原 P1 阻断均已关闭 | independent read-only QA re-review | PASS; P0/P1 0 |
| E-017 | UX/A11y review | 搜索可访问名称、320 相对日期、语义分组、430 日期和双端响应式复核 | independent read-only UX re-review | PASS; no blockers |
| E-018 | final browser | 320/390/430/1280/1440 的 `scrollWidth`、状态网格、固定头间距、日期完整性与搜索结果均重新验证 | in-app browser DOM metrics + final screenshots | passed |
| E-019 | release approval | 老板在本地关闭后明确要求“推送main” | 当前任务后续消息 | direct main push approved |

## Residual risks

- 浏览器证据使用本地 mock 数据；未部署生产，也未读取或改写生产订单。
- 默认 Turbopack 构建在隔离工作树因 `node_modules` 外部符号链接失败；同一代码的 Webpack production build 完整通过。
- 当前状态时间只采用指向当前状态的真实跃迁事件；旧数据没有匹配事件时明确回退到送修时间，不新增数据回填。
- 生产真实数据及不同屏幕阅读器/浏览器组合仍应在发布前做一次抽样验收。
- 本任务后续已获得直接 `main` 推送授权；生产部署、数据库、权限和通知副作用仍不在授权范围内。
- `2026-07-13T15:35:37Z` `a153d9ffcf` — .ai-company/memory/tasks/TASK-20260713-002-order-search-grouped-results/EVIDENCE.md; screenshots/TASK-20260713-002-order-search-grouped-results/
