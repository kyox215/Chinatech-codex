# RepairDesk 45项整改与发布验收（2026-09-25）

当前结论：本地整改候选通过主要质量门禁，正在按老板授权推送与部署；本页随后补充最终版本。真实数据库业务闭环、实体设备和其他窗口缓存/任务仍有明确边界，不能称为全部现实环境验证完成。

## 发布范围与保护

以远端生产 `c6c2f19dadb4d01bd5befaa0685dd02812ca0257` 为基线，在独立工作树合入本次增量。原工作区的76份既有跟踪改动、历史资料、迁移候选与用户配置均未被盲目提交。本次不执行数据库迁移、不修改生产功能开关、不发客户消息。回收暂停时前端按钮与后台写入状态一致。

## 实际验证

- 最新生产基线上的531个测试文件、5081项测试通过；lint、主程序/脚本typecheck、agents:check、默认Turbopack生产构建通过。
- 风险模块34项测试：分支87.75%、行98.61%、函数100%，每文件阈值已接入CI。
- Chromium加载/完成布局5/5；WebKit同组5/5。草稿最终顺序5/5，覆盖390/820/1440及连续输入、预填切换、保存、丢弃、重开。
- 合成业务smoke5/5；正式域名无凭据登录保护5/5。本地无Supabase配置的生产预览5项登录断言失败，不计作成功认证验证。
- 回收暂停中英意：Chromium3/3、WebKit3/3。启用回收写入：初次24/25，商品库存集合检查改用现有集合接口与正式商品归属规则后定向1/1；完整记录比较且要求非空种子。
- WebKit队列切换、失败恢复、离线保留3/3；报价三端三语言18/18；库存创建fixture11/11。
- manifest生产HTTP200、意大利语与private/no-store通过；共享层反向依赖故意引入后被lint拒绝，探针已移除。
- 并发浏览器运行出现一次手机备注弹层按钮落在视口外；单独复验1/1和完整顺序5/5均通过。失败trace保留，尚未稳定复现，不把它改写成从未失败。

完整机器日志、失败trace、备份、工作树恢复引用清单在canonical工作区 `artifacts/audit-remediation-20260925/` 与 `archive.local/audit-remediation-20260925/`。仅以下代表性合成截图进入源码，避免继续堆积全部运行产物。

## 骨架整改截图

- [orders-390-loading.png](evidence/audit-remediation-20260925/orders-390-loading.png)
- [orders-820-loading.png](evidence/audit-remediation-20260925/orders-820-loading.png)
- [orders-1440-loading.png](evidence/audit-remediation-20260925/orders-1440-loading.png)
- [customers-390-loading.png](evidence/audit-remediation-20260925/customers-390-loading.png)
- [customers-1440-loading.png](evidence/audit-remediation-20260925/customers-1440-loading.png)
- [order-detail-1440-loading.png](evidence/audit-remediation-20260925/order-detail-1440-loading.png)

## 逐项结果

| 编号 | 问题 | 状态 | 结果/证据 |
|---|---|---|---|
| WS-01 | 未提交业务成果与历史资料混在同一长期工作区（P1 / A） | 进行中 | 初始哈希与逐文件备份保留；独立发布工作树从最新生产c6c2f19d承接98份既有文件增量及新增文件，原工作区保持不变 |
| WS-02 | README 的“最新状态”实际是历史快照（P1 / B） | 已整改 | README明确历史快照，加入当前审计、整改与验证入口 |
| WS-03 | 工作树登记积累了大量失效项（P1 / A） | 已整改并验证 | 179条失效登记清理，剩23条；158提交恢复引用及元数据压缩备份已核验 |
| WS-04 | `work/` 本地副本没有明确的 Git 排除边界（P1 / A+B） | 已整改 | /work/排除；删除前已确认无tracked文件；原副本保留 |
| WS-05 | 缓存已经成为明显的磁盘占用来源（P2 / A） | 待环境核对 | 确认canonical 4327/4317/3167仍有服务，11GB缓存保留；本任务独立产物在验证结束后清理 |
| WS-06 | 截图存在可观的字节级重复（P2 / A） | 已整改并验证 | 958份重复PNG改为APFS写时复制克隆，路径/字节保留；866份tracked图片哈希一致；物理释放量未测 |
| WS-07 | 大量截图进入源码版本管理，缺少分层保留（P2 / A+C） | 已整改 | 长期样本保留政策+每轮E2E隔离输出；历史Git图片不重写 |
| WS-08 | 产物目录职责重叠、缺少统一查找入口（P2 / A+C） | 已整改 | WORKSPACE_HYGIENE统一目录职责、证据入口及保留边界 |
| WS-09 | 未关闭任务与窗口登记需要核实，而不是自动清零（P2 / A） | 待所有者核对 | orchestration-reconciliation.json列出其他open任务/run/window；本lease无权关闭其他任务 |
| WS-10 | 14 天运行态保留目标目前不是自动清理机制（P2 / B） | 已查证并澄清 | 14天明确为人工保留目标，非自动删除；安全排除/清理条件见WORKSPACE_HYGIENE |
| WS-11 | 旧路由兼容文件缺乏容易看到的退役状态（P2 / B+C） | 已实施，待最终门禁 | 六个未改动legacy文件无live引用，备份+哈希后删除；架构文档更新 |
| WS-12 | 共享层出现反向依赖，现有 lint 没有守住架构合同（P2 / B） | 已整改，定向通过 | URL构造、IMEI纯解析、本地OCR下沉；feature兼容导出保留；69测试通过，新增shared lint边界 |
| WS-13 | 脚本没有纳入当前类型检查（P2 / B） | 已整改并验证 | 独立scripts typecheck接入主命令，修正Supabase泛型/动态select类型；未执行数据脚本 |
| WS-14 | 死代码检查的入口及忽略项过宽（P2 / B） | 已整改检查机制 | knip缩窄entry/ignore并接入CI报告，214条候选待按业务取舍，禁止自动批量删除 |
| WS-15 | 订单详情和服务端分发器过于集中（P2 / B+C） | 已实施，定向通过 | IMEI采集弹层及OCR辅助提取，HTTP响应/只读统计提取；213测试及typecheck通过，复杂度仍需持续控制 |
| WS-16 | 全局语言消息模块值得做资源体积测量（P2 / B+C） | 已完成测量 | 独立ESM 891063B，gzip194855B，brotli143290B；不是Next首屏实际传输；不为未经测量收益引入异步翻译架构 |
| WS-17 | TypeScript 的特殊排除 glob 缺少解释（P2 / B） | 已整改并验证 | 解释dev生成类型与macOS副本glob；typecheck仍覆盖正常源码和生产生成类型 |
| WS-18 | 默认 Node 版本与项目声明不一致（P1 / A） | 已实施 | dev/build/test增加Node>=22.12前置检查；本轮使用Node24；不改全局shell |
| WS-19 | 构建依赖外部字体网络（P2 / A） | 已整改并验证 | 3种本地WOFF2、OFL许可证及来源哈希；发布候选默认Turbopack构建通过 |
| WS-20 | 治理链接检查把历史工作副本也当作当前文档扫描（P2 / A+B） | 已整改并验证 | canonical检查排除根本地副本，正式docs/archive仍检查；6337文档，0警告0错误 |
| UI-01 | iPad 订单占位单列，真实内容双列（P1 / A） | 已整改，定向通过 | 骨架包7单测+5成对布局E2E通过；证据skeleton-layout-regression-final；WebKit成对布局5/5通过；中英意暂停状态3/3；实体设备未测 |
| UI-02 | 订单卡片/行的占位高度偏小（P2 / A+B） | 已整改，定向通过 | 骨架包7单测+5成对布局E2E通过；证据skeleton-layout-regression-final；WebKit成对布局5/5通过；中英意暂停状态3/3；实体设备未测 |
| UI-03 | 订单工具栏骨架与当前工具栏信息层级不同（P2 / A） | 已整改，定向通过 | 骨架包7单测+5成对布局E2E通过；证据skeleton-layout-regression-final；WebKit成对布局5/5通过；中英意暂停状态3/3；实体设备未测 |
| UI-04 | 客户桌面骨架仍保留旧的四张统计卡（P1 / A+B） | 已整改，定向通过 | 骨架包7单测+5成对布局E2E通过；证据skeleton-layout-regression-final；WebKit成对布局5/5通过；中英意暂停状态3/3；实体设备未测 |
| UI-05 | 客户列表占位仍是另一套表格和卡片模板（P2 / A+B） | 已整改，定向通过 | 骨架包7单测+5成对布局E2E通过；证据skeleton-layout-regression-final；WebKit成对布局5/5通过；中英意暂停状态3/3；实体设备未测 |
| UI-06 | 订单详情桌面占位宽度与真实工作台不同（P1 / A+B） | 已整改，定向通过 | 骨架包7单测+5成对布局E2E通过；证据skeleton-layout-regression-final；WebKit成对布局5/5通过；中英意暂停状态3/3；实体设备未测 |
| UI-07 | 占位视觉噪声：列表块过多、详情块过实（P2 / A+C） | 已整改，定向通过 | 骨架包7单测+5成对布局E2E通过；证据skeleton-layout-regression-final；WebKit成对布局5/5通过；中英意暂停状态3/3；实体设备未测 |
| UI-08 | 视口尚未确定时还有一次骨架结构切换（P2 / B+C） | 已整改，定向通过 | 骨架包7单测+5成对布局E2E通过；证据skeleton-layout-regression-final；WebKit成对布局5/5通过；中英意暂停状态3/3；实体设备未测 |
| UI-09 | 移动列表加载时，已有意义的导航也被替换成假按钮（P2 / A+B） | 已整改，定向通过 | 骨架包7单测+5成对布局E2E通过；证据skeleton-layout-regression-final；WebKit成对布局5/5通过；中英意暂停状态3/3；实体设备未测 |
| UI-10 | WebKit 关闭队列菜单后焦点未归还触发按钮（P1 / A） | 已整改，定向通过 | WebKit Escape焦点用例1/1通过；触发器显式ref与关闭焦点恢复 |
| UI-11 | 零照片创建也会短暂显示“照片正在上传”（P2 / A+B） | 已整改，定向通过 | 零照片中英意不再显示上传；67单测及4秒延迟建单导航探针通过 |
| QA-01 | 开发预览 manifest 500 污染 WebKit 回归（P1 / A+B） | 已整改并验证 | 显式request manifest；4单测，dev与生产HTTP200、意大利语及private/no-store通过 |
| QA-02 | 默认 mock 启动不等于完整库存测试环境（P1 / A+B） | 已整改并验证 | 库存故事显式声明mock权限/flags；11浏览器回归通过；生产开关未开启 |
| QA-03 | 回收写入暂停与测试/页面可操作状态不同步（P1 / A+B） | 已实施，定向通过 | 服务器开关传入页面，创建/改价/答复只读与后端暂停一致；90单测；暂停Chromium/WebKit各3/3，启用24/25初验+库存隔离修正定向1/1 |
| QA-04 | 草稿稳定性用例依赖脆弱的页面级探针（P1 / A+B） | 进行中 | 修正warm-refetch、折叠备注及选定客户测试契约；最终顺序5/5通过。并发时一次手机弹层不可达，保留trace，未稳定复现 |
| QA-05 | 报价测试用固定 Save 名称寻找已变为 Saving 的按钮（P2 / A+B） | 已整改并验证 | pending用Saving标签断言禁用，18三端三语言报价故事通过 |
| QA-06 | 离线队列断言仍使用旧名称（P2 / A+B） | 已实施 | 离线label改当前队列；WebKit3/3队列/失败/离线恢复通过 |
| QA-07 | 部分浏览器测试把结果写入历史任务目录（P1 / B） | 已整改 | 46份E2E历史输出转入每轮独立evidence路径；CI统一收集test-results |
| QA-08 | 失败 trace 配置与重试次数不匹配（P2 / B） | 已整改并验证 | retain-on-failure；本轮失败trace已实际生成 |
| QA-09 | 基础 smoke 把登录页也算作业务路由成功（P2 / B） | 进行中 | 合成业务5/5；正式域名未登录5/5。无认证配置的本地产物不计作登录验证 |
| QA-10 | 部分交互 E2E 只手动触发，PR 不自动执行（P1 / B） | 已实施 | 相关PR/push运行交互与回收两种capability回归；远端CI尚未运行 |
| QA-11 | 本地综合 check 与 CI 的规则检查不一致（P2 / B） | 已整改并验证 | CI新增agents:check，与本地check一致；本地规则检查通过 |
| QA-12 | 测试数量没有对应关键风险的覆盖率证据（P2 / B+C） | 已整改，定向通过 | 金额及店铺生命周期共34用例；分支87.75%、行98.61%；每文件风险阈值与CI接入 |
| QA-13 | 骨架测试没有约束它与真实布局的一致性（P2 / B） | 已整改并验证 | 新增loading/loaded成对几何断言；Chromium5/5，390/820/1440 |
| QA-14 | 当前隔离环境不足以证明完整真实业务闭环（P1 / A，验证缺口） | 外部/环境缺口 | 当前supabase/test-baseline仍标注FAIL无批准schema；不冒充真实多角色/实体设备闭环 |

## 真实业务复验条件与顺序

需要本项目批准的独立测试数据库及schema、至少两个隔离门店和owner/technician/viewer账号、可回滚的合成客户与订单；目前 `supabase/test-baseline/README.md` 仍为FAIL状态。实体iPhone/iPad另需设备与授权测试账号。

依次验证：登录及门店隔离 → 新增/选择客户 → 新建工单与本机草稿 → 设备识别 → 故障和报价 → 附件上传成功/失败重试 → 保存后刷新/重开/另一设备同步 → 报价确认与定金/付款 → 维修状态与交付 → 打印与消息草稿 → 权限拒绝、断网、重复提交和恢复。各阶段核对UI、API和数据库结果，不能以mock数据代替真实RLS或账务验证。无需为此发送真实客户消息。

## 发布、观测与恢复

目标为Vercel项目 `chinatech-codex`，域名 `www.chinatech.in` / `chinatech.in`。原生产回滚部署为 `dpl_9YgqqLb6dqWPbUECtTQAGXRhEu8P`。发布后检查READY、域名归属、manifest、多语言公共页面、未登录保护及新增错误；若构建失败、5xx或登录保护回归，停止推广并将上述已知部署重新提升生产。代码与静态资源可回滚；本次无数据迁移，不承诺外部业务数据回滚。
