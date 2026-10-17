# 多门店与免费内测容量｜本地实施候选

## 本轮规划与范围

已确认：验证邮箱后自助创建空门店；员工个人账号通过单人邀请申请，老板或获授权店长审批；同一账号可加入多店，显式切换，不能依赖 Cookie 决定旧页操作范围。免费内测每店 1,000,000,000 附件字节、5 名有效成员（含老板），约 20 店；80% 提醒，满额只限制新增附件和成员。先统计和预留套餐，不启用支付，不清理现有资料。

根负责需求、设计来源和独立验收，`multistore_implementation` 是唯一源码实施 owner。权限、数据、缓存、照片和多标签隔离须有真实数据库/API/浏览器证据后才作为完成；不修改正式 baseline。

## 原文件设计与复用

- 原文件 `nhZ37YLOUVP8zpDBBGihhS`；组合根 [15181:209494](https://www.figma.com/design/nhZ37YLOUVP8zpDBBGihhS?node-id=15181-209494)。
- 我的门店桌面面板 `15181:209495`、375 手机面板 `15181:209552`、邀请申请/待审批/失效组合 `15181:209603`、免费内测容量组合 `15181:209636`。是可编辑状态参考，多个状态并列展示不代表运行中同时出现。
- 复用原 `NavigationControl`（`15167:209357`）、`OperationState`（`15167:209417`）、输入（`5103:497`）及原字体/颜色/间距/圆角变量；没有创建第二套公共控件。
- 代码映射：原 `AuthFrame`、`InputControl`、`SelectControl`、`.button` 与既有面板/字段语义；新增业务组合由账号门店模块和原员工管理 owner 维护。最终实际入口随实施结果补充。
- Figma 文本字体实读均为 Source Sans 3；组合读回包括 FRAME/TEXT/INSTANCE/GROUP/VECTOR，无图片节点。首次检查发现文本 reflow 重叠，已定向修复，最后整图目视无重叠。
- 截图归档 `.company-tmp/multistore-pilot-20261017/figma-reference.png`。这是英文虚构参考，真实三语、44px 触控、输入 16px 和 B 反馈按运行实现独立验收。原输入模板图标/辅助槽仅示意，代码继续遵现有 InputControl。

## 验收范围与状态

需验四宽 1440/1024/390/375、三语、键盘/触控及正式编译 CSS；开店、邀请、申请、审批、容量、切店的默认/忙碌/成功/失败/离线/无权/冲突/结果待核对。容量比例是静态事实，不使用执行中细线伪装容量图；异步执行的细线按 B 规则置内容顶部。

需验真实 Auth/受限 SQL/API/私有 Storage：跨店 ID 与关联篡改、并发审批/上传、满额、撤权竞争、双标签不同门店、迟到回填、响应丢失原请求恢复。当前只完成原 Figma 设计读写与参考截图，不表示代码或业务测试通过，未部署。


## 本地运行映射（2026-10-17）

`components/stores/my-stores.tsx`→我的门店15181:209495/209552；`join-store.tsx`及`store-management.tsx`→邀请15181:209603、用量15181:209636。复用AccountBrand语言入口、InputControl/SelectControl/MultiChoice、NavigationLink、PageTitle/AppShell、原button/panel语义及B反馈。内部页由AppShell提供唯一进度线，独立账号页自带；容量progress仅静态实际事实。无新主题/图标库。同步权限scope投影隐藏与迟到响应有实际组件hooks测试；候选正式Supabase build/browser证据独立归档，不改已部署baseline。

最终运行：正式Supabase build rL3Q5JqHmycrX5oa9mOjX；browser-final-v6.log 30场景与happy-final-v7.log双引擎真实写入闭环通过；375/1440截图已目视，宽度1024/390亦实跑。新失败/重试、未知503跨刷新原ID、权限迟到回填有定向证据；真实断网全业务路径/全部旧页面并未全面回归。具体前序RED/未验边界见docs40。


## 独立发布整合验收

用户授权上线后，从正式main bcbc6914定向抽取本轮多店源码，未引入打印样式/无限滚动/Phone/Office/性能候选。生产构建SvVc5Rwzh-V5En56VkRZh，独立TLS3125；三语四宽双引擎30场景和真实邀请/登录/申请/审批happy均通过。全Node545=544通过/1既有PowerShell运行时skip，lint0错1旧warning，i18n4270。构建专用turbopack.root绝对路径未进发布源码。迁移和域名正式状态等待控制面绑定，不能以本节提前声明上线。


发布集成终查发现旧77路径清单遗漏了LocalIntakeDetail照片URL的storeId依赖，原7c2ef1d3/BbMF候选不准上线；真实旧build浏览器RED保留photo-browser-red.log。补入同一原实现两行后，新生产build zJ1Hb88gP5J1rzNu48UDE，双引擎4项真实维修/零售图片加载及缺scope400/跨店404通过；其余未改输入复用前述30+happy与完整Node证据，非全部重复运行。实际API客户端scope矩阵见本轮发布证据client-scope-matrix.json。

## 正式 main 打印组合边界（2026-10-17）

正常合入已正式合并的 receipt PR70（main2d6fb2e4）后，真实本地 Auth／API 的无维修项目未报价工单在意语返回422 printOverflow；两引擎三语新增用例为意语2RED、其余4PASS，证据在 `.company-tmp/multistore-release-20261017/unquoted-pdf-red*`。根因是金额文字列仅依据项目行选择，空行遗漏未报价合计；仅扩原判定至同一未报价合计，复用既有36mm文字金额列。零值／正常金额27mm、字体与内容、自然溢出拒绝及权限／门店边界保持，实际回验与新候选冻结另记，不能把先前候选构建当本修复通过。
