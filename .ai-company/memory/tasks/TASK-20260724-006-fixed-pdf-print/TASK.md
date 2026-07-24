---
schema_version: 1
task_id: "TASK-20260724-006-fixed-pdf-print"
title: "固定尺寸 PDF 工单打印"
status: "closed"
task_class: "T3"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["ARCH", "FE", "QA", "DOC", "REL"]
created_at: "2026-07-24T00:00:00Z"
updated_at: "2026-07-24T11:19:57Z"
closed_at: "2026-07-24T11:19:57Z"
---
# Task

## Owner goal

修复 Chrome/Windows/打印机驱动把 A5 与 A4 网页打印都缩小到左上角的问题。选择纸张后先生成固定尺寸 PDF，再进入 PDF 预览；保留当前工单字段、顺序、两栏、二维码和内容布局。

## Acceptance criteria

1. A5 横向输出为单页 210×148mm PDF。
2. A4 横向铺满输出为单页 297×210mm PDF，完整票据等比放大且不重排。
3. A4 上半裁切输出为单页 210×297mm PDF，同一 A5 票据位于上半页，148.5mm 裁切线，下半页留白。
4. A4 双联输出为单页 210×297mm PDF，上下各一份完整相同票据并保留中间裁切线。
5. PDF 内容来自现有打印 DOM 的高分辨率快照，不维护第二套业务模板。
6. 单张、任务页和批量入口统一使用固定 PDF；打印机驱动不能重新排版票据内部内容。
7. 固定二维码完整、清晰；所有订单业务状态继续允许生成 PDF。
8. 弹窗被阻止、二维码失败或 PDF 生成失败时显示明确错误并关闭占位窗口。
9. lint、typecheck、相关测试、production build、PDF 页数/尺寸及 PNG 视觉检查通过。

## Rollback

回退应用提交即可恢复网页 CSS 打印；无数据库或生产数据变更。
