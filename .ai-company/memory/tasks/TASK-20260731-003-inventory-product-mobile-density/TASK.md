---
schema_version: 1
task_id: "TASK-20260731-003-inventory-product-mobile-density"
title: "商品库存持续完善与手机端高密度单页体验"
status: "closed"
task_class: "T3"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["PRODUCT", "ARCH", "DATA", "UX", "FRONTEND", "QA", "RELEASE", "INT"]
created_at: "2026-07-31T07:14:59Z"
updated_at: "2026-07-31T09:26:59Z"
---
# Task — 商品库存持续完善与手机端高密度单页体验

## Owner request

继续完善商品库存，使列表、快速录入、详情和编辑在手机端更紧凑、高密度、一目了然，尽量在一页显示全部关键内容；形成完整规划、设定目标并执行，完成后推送和部署。Owner 明确要求真实子代理参与。

## Classification and authority

- `T3/R2/L2`：多页面应用层 UI、交互、测试与跨分支发布集成；不改 schema、API、权限、财务语义或库存状态机。
- Owner 已批准本任务范围内 commit、push 和生产部署（D4）。发布仍须满足 integration lease、全量质量门、回滚点、精确 SHA 和生产只读 smoke。
- 如 diff 触及 API DTO、router/schema、repository、permissions、环境变量或 migration，立即停止并升级 R3。

## Verified baseline

- 任务开始时 Vercel Production 为 `a9e6db44`，包含维修选项修复但缺少此前生产验证的库存/回收 Web 业务树。
- 安全业务基线 `b2598713` 的 `src/`、`supabase/` 与此前 READY 的 `71fa80a3` 相同，并含设备资料、扫码和方案 C 详情。
- 隔离分支以 `b2598713` 为基线，重放 `a9e6db44` 为 `b6332f8c`，再实施本任务。
- 实施阶段未直接整枝合并当时未发布的 `cf594862`。发布接力时，远端 `main` 已由独立任务更新到 `1c9f4574` 并正式包含全站密度；本候选随后合并该权威主线，保留商品专用路由并修复共享操作栏在桌面断点产生的 24px 溢出。

## Scope in

1. 列表 query 门禁、84–88px 移动卡、查询切换保留旧结果、屏幕阅读器状态。
2. 快速录入加载门禁、五列类别、核心字段高优先级、固定双动作、44px 触控和 16px 输入。
3. 详情旧响应兼容、紧凑首卡、三列规格、标识去重、成本投影不变。
4. 编辑查询门禁、字段错误、紧凑布局和固定动作；CAS/409 与完整标识缓存边界不变。
5. 单元/E2E、Chromium/WebKit、多视口、截图、文档、preview/production smoke。
6. 候选同时保留安全库存业务树和当前生产维修选项行为。

## Scope out

- 库存生命周期动作、采购、调拨、盘点、批量操作。
- 服务端分页、数据库过滤/排序、虚拟化、索引和性能迁移。
- 成本清空语义、权限、feature flag、API/RPC/schema/migration 变化。
- 字段级并发冲突协议重写、生产数据写入。全站密度只作为已经发布的权威 `main` 被动吸收，不在本任务扩展其业务范围。

## Hard constraints

- 商品库存与回收保持独立，不新增 buyback mutation 或库存 transition。
- 列表/详情只使用遮罩标识；完整 IMEI/Serial/EID 不进入普通缓存、日志、URL、截图、Toast 或 ARIA。
- 移动输入字号至少 16px、操作目标至少 44×44px，关键视口无页面横向溢出。
- 复用现有 tokens、`repairOs.*` 和库存组件，不新增硬编码颜色。
- 根工作树有其他任务改动；本任务只在 `/private/tmp/repairdesk-inventory-mobile-density-20260731` 写入。

## Acceptance criteria

- [x] 候选历史同时保留安全库存业务树与最新远端生产主线 `1c9f4574`；单一库存路由冲突按商品专用页面解决。
- [x] 功能关闭或无权限时 list/intake/edit 不发受限请求，不闪现编辑表单。
- [x] 查询占位数据只在同一门店列表范围保留，切换门店不显示上一门店商品。
- [x] 390px 列表卡片 84–88px，标准样本第六件商品可见。
- [x] 390px 录入五列类别、固定动作可达，真实输入 16px、操作 44px。
- [x] 430px 详情核心资料紧凑呈现，主标识不重复，缺少 `identifiers` 不崩溃。
- [x] 编辑保留完整 identifier 权限边界并提供字段级错误与固定保存栏。
- [x] 专项 Chromium/WebKit 断言无横向溢出。
- [x] lint、typecheck、unit、build、库存专项与回归 E2E 全部通过。
- [x] Preview 与 Production 均从 exact SHA `44b1d80c` 构建并 READY，线上只读 smoke 无阻塞。
- [x] 最终关闭档案包含截图、部署 URL/SHA、回滚点和已知限制。

## Agent team and ownership

| Agent | Mode | Deliverable | Write ownership |
|---|---|---|---|
| Nova `/root/inventory_arch_product` | read-only solution architect | 基线、边界、集成顺序、GO/NO-GO | none |
| Aster `/root/inventory_mobile_ux` | read-only UX reviewer | 390/430 IA、状态/a11y、截图矩阵 | none |
| Gaia `/root/inventory_data_contract` | read-only data reviewer | 数据、权限、并发、兼容不变量 | none |
| independent QA (post-implementation) | read-only QA reviewer | diff、门禁和发布就绪复核 | none |
| IntegrationLead `/root` | single writer | 合同、代码、测试、集成、发布、关闭 | task scope only |

## GO / NO-GO

**GO:** UI-only；候选保留两条业务能力线；全量和双浏览器门禁通过；租约有效；有可部署的 Git 回滚点。

**NO-GO:** 远端 lineage 不明；出现 API/data/permission/migration diff；PII、overflow、touch/font、幂等、CAS 或门禁失败；租约丢失；远端 `main` 前进后未重建候选。

## Rollback

- Web 异常优先部署组合基线 `b6332f8c`，它同时含安全库存业务树和当前维修选项修复；不回滚数据库。
- 不删除库存、identifier、ledger、movement 或 audit 数据，不执行 down migration。

## Definition of done

- 验收均有文件、命令、截图或部署证据。
- 独立 QA 无未处理 P0/P1；残余 P2 有后续范围。
- exact SHA 已推送并在 Vercel Production READY；只读 smoke 通过。
- 文档、Task Memory、checkpoint 与 Registry 一致，integration lease 已释放。
