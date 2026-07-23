---
schema_version: 1
task_id: "TASK-20260723-001-new-order-three-column-layout"
title: "新建订单真实组件三列单屏布局"
status: "implemented-local-preview"
task_class: "T2"
risk_level: "R1"
autonomy_level: "L2-local"
owner: "CEO-Orchestrator"
departments: ["UX", "FE", "QA"]
created_at: "2026-07-23T00:00:00+02:00"
updated_at: "2026-07-23T00:27:06Z"
---
# 目标

在不改变新建订单组件业务逻辑、状态、事件和数据契约的前提下，将桌面弹窗改为三列单屏布局：左侧客户与设备，中间维修报价，右侧手机密码与工单设置。

# 范围

- 仅调整 `new-order-screen.tsx` 与 `new-order-quotation-section.tsx` 的布局、容器和响应式类名。
- 压缩桌面本机草稿提示卡，不删除恢复或丢弃功能。
- 不修改客户搜索、报价计算、定金、设备保管、手机密码、草稿或创建工单逻辑。
- 目标预览环境为隔离工作区 `/private/tmp/repairdesk-orders-remediation.7lPvXh` 的 `127.0.0.1:3107`。

# 验收

- 1306x900 桌面视口显示三列。
- 新建订单表单和工作区网格无整体纵向溢出。
- 底部创建工单按钮始终可见。
- 浏览器控制台无页面错误。
- 类型检查与目标文件 ESLint 通过。

# Agent 决定

no-spawn reason：本任务是两个既有文件内的局部展示层调整，且隔离工作区已有大量同任务线改动；由主线程单一写入者完成可减少文件所有权冲突。UX、FE、QA 为 considered / not spawned。
