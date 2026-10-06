# ChinaTech 项目维护要求

先读取 PROJECT_MEMORY.md，再按受影响流程读取 docs/06-ui-components-and-styles.md、docs/16-change-consistency-contract.md 和 docs/28-i18n-maintenance.md。

## 三语与关联闭环（后续改动强制）

- 任何新增或修改的用户可见内容必须同步中文、意大利语、英语，包括页面、字段、选项、状态、校验、错误、加载／空态、动态系统消息、标题、可访问名称及适用的打印和教程；不能只检查直接t调用。
- 译文只用于显示。客户自由原文、品牌型号／编号、自定义内容与未知历史保持原文；不得回写canonical选项、权限、金额／数量、签名、政策或销售快照。预设选项显示标签与保存值分开。
- 同一事实按docs/16同时核对新建、编辑、校验、保存、刷新、列表、详情、客户关联、历史及适用的签名／打印／教程；不把单页成功当闭环，不对无关业务机械扩展。
- 发布前通过check:i18n、类型／lint／相关业务和浏览器验证。三语缺漏、词条冲突、变量失配、排版遮挡不得用宽泛忽略中文、缩小字号、隐藏事实或放宽断言掩盖。正式与预览分支分别验收。
- 不适用项说明具体原因；未验证范围如实记录，不能只写规则便声称完成运行时闭环。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
