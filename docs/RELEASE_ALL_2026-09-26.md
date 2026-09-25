# 2026-09-26 最近改动发布

老板授权部署全部最近改动。以当前生产提交 1919107ab6c8bd90bfc2cae7999f8914caf72b2e 为基线，合并尚未发布的客户详情三分组、未完成工单与 WhatsApp 预选入口，以及新建/报价保存刷新回归。上一批审计整改、质保三语、财务精度/异常判定和手机详情布局已在生产，保留原实现。旧 canonical 快照不是发布覆盖源。

## 发布范围
- 客户详情：概览、业务、资料三组；概览保留身份、联系入口和去重的未完成/待收款工单。
- 联系入口预选 WhatsApp，仍需人工打开渠道及人工确认记录。
- zh/en/it 文案和金额遮盖边界保持完整。
- 补充新建订单与报价保存、刷新重开回归。
- 无数据库迁移、依赖、服务端金额或权限修改；本地角色样本脚本及治理/截图产物不属于生产运行包。

## 安全审查
独立只读审查未发现候选新增授权/财务暴露问题。服务端 customer.repository 按门店查询及角色投影保持原样；新行金额同时检查聚合与单笔遮盖。原工作树较旧的支付状态及迁移内容已排除，生产版本保持不变。

## 发布门禁与回滚
必须通过 lint、typecheck、全量单测、risk coverage、build、适用浏览器及现有 GitHub CI。任何失败不得上线。Vercel 项目 chinatech-codex (prj_FZoMRZoHsRNALz4ahEVGaXAxHOFS)，团队 team_AOJDnrjov0QDLqpvMyhwA1yc；域名 chinatech.in / www.chinatech.in。

回滚点 dpl_3Evzr7YeWUHXrZGgyCoWswYcWXah，URL chinatech-codex-1asq2kr6t-kyox120-9295s-projects.vercel.app。若上线后页面/资源持续失败、受保护接口未认证可读或域名未指向本次 READY 部署，停止扩大验证并使用该项目 Vercel rollback 恢复此部署；必要时对本次合并提交做普通 revert。无数据迁移，不需数据回滚。不得 force-push。

## 验证记录
运行证据由本任务保存并在发布完成后更新。浏览器业务使用合成 mock 数据，线上仅只读公共/认证边界验证，不发送消息或写真实订单。

本地候选：lint、typecheck（含脚本）、agents 检查、532文件5089单测、34风险覆盖、生产build均通过。新建导航2/2，报价6视口×3语言18/18通过（包括保存、刷新、失效输入、取消与503恢复）。新增preload断言定向21/21通过。客户测试按获批的三分组路径同步，远端完整CI为发布前必要门禁。初次Turbopack软链接环境失败已改隔离依赖副本；旧测试失败记录保留，不计为成功。独立安全审查完成；真实账号完整业务和实体设备尚未验证。
