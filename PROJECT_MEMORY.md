# ChinaTech 项目连续记忆

## 2026-10-18 第二轮性能候选（未发布）

唯一源`.local/performance-release/source`，性能分支正常合入已上线main5df手机picker；未带尚未合并的PR73公开快照候选。settings无变化保存的真实2RED已窄修并10+2定向通过（b8），远程CI随后发现当前UI词条驱动历史D16生成：已固定0cf完整4344查询词汇snapshot/provenance，20历史迁移字节不变。

目录管理首50与SSR bootstrap并行、身份页树seed、仅文字150ms去抖、十批500完整行缓存／视口表格和原授权重取、草稿保留及低频管理代码按需；PDF显式flag进程复用、每次独立context、并发2/idle30s/断线恢复，仍逐请求前后授权与源复核，固定phase经既有observer。全Node795过/1既有PowerShellskip，i18n4347过；目录窗口及旧503/403、共享窗口28、实际Chromium四份合成PDF／两进程隔离专项分别通过。正式构建／新候选30样本／实际Auth与远程完整CI仍待，不冒线上完成。生产20迁移/operator仅default-plan，生产canonical读取待root确认授权，不旁路。


## 2026-10-18 手机选择与配件摘要（当前候选）

用户已确认推荐组合并授权上线。隔离发行源`.local/mobile-picker-20261018/source`从main bf1创建；手机维修列表两标签+N/供应商单行，新建维修品牌原位候选/型号底部面板，主动搜索才输入，取消保原值，选后回button。只显式启用当前调用，其他/桌面维持；不改数据库/权限/金额/签名。可编辑原Figma15322:210105已归档。root设计/独审/发布，mobile_picker_implementation唯一源码owner；本条是候选状态，验收和正式发布以ui-design/previews/mobile-picker-20261018.md为准。实体iPhone软键盘未验，不能用模拟器替代。

## 2026-10-17 多门店发布组合候选

已正常合入正式 main2d6fb2e4 的打印改进，实际组合验收发现空项目未报价意语PDF溢出；仅复用原文字金额列补齐合计判定，保持全部安全／字体／溢出边界。三语、零值／正常金额与真实API回验及准确发布绑定继续记录在 [候选记录](ui-design/previews/multistore-pilot-20261017.md)，不将待验修正写成已上线。

## 2026-10-17 接机单三语疏朗版候选

用户确认疏朗效果图用于实际打印单，中文同步优化，三语保持现有分区并要求完成后上线。当前仅打印候选从正式main bcbc691隔离实施；复用原模板／投影／字体／预览及完整政策／金额／签名边界，另补打印路由Playwright动态资源追踪。设计参考与准确验收状态见[本轮记录](ui-design/previews/receipt-spacing-20261017.md)。没有带入其他未发布候选、生产业务写入或数据库迁移；发布事实以实际main、生产部署与双域绑定回执为准，不将本候选记录当上线证明。

## 全站反馈与UI设计目录追加实施（2026-10-15）

页头并行main72e08cf9已正常合入，9路径保留；合并74浏览器过。独立抓到手机span隐藏导航槽P2，4RED→一行排除slot/sr-only→4GREEN；最终页头/真实导航12过，正式build Dbq88mnsCUWf6ZX909OV5/CSS16/11资产/4203三语/TS/lint过。测试悬停浮点采样改为中性指针+有限等待+同帧，严格44/同排断言保留，原失败与诊断留存。双域新回滚8qLzfgh4XxDDZjBQzvNC3dsBtXGq，不回J58、不晋升旧028/412e；等待新精确head CI/候选门禁。详ui-design/verification.md。

最终门禁返工：028完整push CI438/440，两引擎同一返修旧通知面板断言失败。已把关闭检查前移到真实到货Toast并验证退出后不重播，全部业务断言保留；4项双引擎定向通过，独立契约CODE_GO，应用源码未变。新精确head完整CI/候选必需，不晋升028候选。详ui-design/verification.md。

用户已确认普通成功通知放操作附近/标题下方，约1.8秒自动消失、点击可提前关闭，不悬浮遮挡；失败/冲突/未知恢复入口持久。盘点79活动反馈文件/120导航源码调用，原Figma新增可编辑状态页15167:209297，项目统一从ui-design索引先复用，缺失先回Figma补齐归档。共享导航固定图标槽/文本预留槽、去右上绝对圈和等待外框；Toast按事件身份/可见性/首deadline隔离，旧计时不清新通知；waiting锁与executing反馈分离。

实际本地冻结98关联浏览器通过，组件目录两引擎/三语四宽/API0/计时1849与1822ms通过；513领域512过/1本机无PowerShellskip，新增writer通知后34客户端专项过。独立审查暴露并修复隐藏Toast、重播、deadline、不同事件吞提示、unknown假busy及在线prepared恢复入口P1；后者源码CODE_GO，随后真实隔离验收已通过，见下一段。报告与边界ui-design/verification.md，源码证据.local/ui-feedback。旧失败/热更新干扰保留，未用它们冒充通过。

已正常合入正式main8e4638d9（Phone0.5.1），44文件42字节相同/CI与返回Link两受控合并。组合类型/4203三语/513领域、默认及正式编译、11CSS两顺序16组合过；另60控件/工作台/工具箱与10账号（含单圈重试）双引擎过；严格https本地Auth/DB恢复两引擎各3组+照片两引擎过，新UUID精确清理且0生产业务写。双域fresh均J58NEAJBLcGTN5ZDhzv8qS1TLppT，已保存回滚点。待精确head完整CI/同源候选/独立gate后随工单一起上线；不得晋升旧344d候选或回退2Wm。

## 工单详情整合实施与发布准备（2026-10-15）

用户授权方案37实施并上线。隔离树`.local/repair-detail-release/source`基于fresh main32fcf9e0，真实四分组、逐项报价/供应商、手机同排打印、照片专用版本命令、选择式跟进、新cart链退休及旧账本/回执/视图兼容已实现；不改schema、客户同意、签名或财务规则。项目AGENTS/docs06/16和三语教程同步。

组合基线更新：冻结前fresh main发现并行工具箱已上线abb60c2910a979ce9eca620eab1d1aa45f552cff，已正常合入并保留其96文件与已退休下载规则。当前双域实际2Wm（dpl_2WmYSwqD4kzByyDcjpPdDJkeZFgB），改用该部署作发布前回滚点，不晋升旧4ge或回退旧ENXG。组合本地513单元=512过/1无PowerShell环境skip，TS/三语/lint/生产构建、编译CSS16及真实隔离Auth/DB照片两引擎复验通过，浏览器清单438。直连项目API已核main Git链接，合并可能触发自动部署；必须合并前完成全部门禁，自动部署稳定后再次显式晋升已验候选并核双域。完整新head CI/新同源候选仍待完成。

发布门禁返工：fa47 push完整509单元/446浏览器/构建/CSS成功，PR两次各445/446（旧不可变离线页自动预算边界、目录native漏采），均未发布。旧页原重试按钮真实无损恢复两引擎过；采样器固定root/input.id/token并按当前菜单语义接原生事件，确定性菜单重建2RED→2GREEN，严格负例另2过，原性能全门槛repeat3双引擎12过。原12目录用例及30样本/200ms/双RAF/真实授权tick/0新GET未放松；独立新审查者CODE_GO，应用源码相对fa47未改。历史CI漏采具体根因未完全证实，不能称修了产品点击。新head完整CI与候选仍需通过，详docs37第11节。

最后增量：采购实际下单确认绑定供应商/版本；照片首文件选择同步固定版本并保持读取细线。4RED复现→工作区20过、双引擎repeat3共12过、最终72关联过，新正式构建/编译CSS16及真实隔离Auth/DB照片两引擎过，独立增量CODE_GO。1a391完整CI失败证据及测试定位/PNG CRC/三语测试拆分修正见docs37；该旧提交/两旧候选不得发布，等待新精确head完整CI及同源候选。

独立CODE_GO；受影响Cr/WK60项、最终关联44项加分组边缘2项、遗漏报价2项及审查反例6项分项通过，不混称同一次全跑。509Node中508过/本机PowerShell1skip；TS/三语/lint（既有Next导航warning）/正式build、编译CSS16条件通过。生产编译+隔离Auth/DB/API，Cr/WK照片跨分组细线/未知原ID恢复/唯一回执实际通过，专用API7、多项目真实事务16、采购到货/更正/恢复18分别通过；0生产业务写入。历史测试清理前置失败/类型重复缓存/旧布局定位失败保留，详docs37第10节与proof。

早期批量清理曾被自动审批拒绝；用户随后明确批准原冻结清单。经独立审查后仅清理隔离库13虚构账号/4虚构门店及关联记录，执行和独立SQL/Auth复核均零残留；未涉及生产业务数据。完整远程CI、同源候选及最终gate尚待完成，不以本段声明已上线。最新正式仍ENXG/main32fc；旧B/Figma树不回退。最终结果将补本节。

## 手机页头紧凑布局修复（2026-10-15，待完整CI与发布）

用户明确授权商品“同型号新建”手机同排，检查同类问题并确认操作后直接上线。基于fresh main8e4638d9，隔离源.local/device-catalog/release/source / codex/mobile-heading-20261015。定向盘点21个PageTitle调用文件，复用原控件与44px触控；手机标题改占剩余空间，标题内长状态正常换行，纯图标组显式--icons，客户/采购/工单及只读扫码同排，多文字工具栏保留满行。四TSX仅布局class，业务/权限/事件/桌面不变，规范docs06已同步。

已实际22关联浏览器通过（双引擎，含三语四宽商品、菜单/复制导航、客户取消、采购链接打印、只读扫码、原商品折叠/编辑/刷新）；随后长状态增量及最终构建离线编译CSS16条件/13资产/实际本地字体/零外网通过，旧build被新增同排断言准确拒绝。类型、三语4141、lint零错一旧warning、生产build通过。新增测试两次契约误判保留原失败，未放宽断言。长意语采购边界新增用例待CI实际执行。

当前电脑CUA本地预览打开被管理策略拒绝，未换surface或命令重访；22回归在该拒绝前已完成，商品双端语言截图已目视，不能据此冒称最终正式账号验收。只执行离线编译CSS和正常远程CI；正式HTTP/部署只读核对与当前账号UI访问边界分别记录。0生产业务写入。完整CI/候选/同树与独立gate通过才正常发布，保留最新正式及并行工单/反馈/工具箱，不晋升旧候选。

## Figma组件与商品标题修复候选（2026-10-15）

用户授权本轮修复、全网页公共UI核对、维护守则及验证后直接上线。基于main470a，branch codex/ui-design-20261015；规范/完整组件覆盖及Figma高保真节点映射见docs/36-ui-design-audit-20261015.md，AGENTS和docs06已加入每次设计前必读→规划→复用→真实交互/正式CSS的要求。保留原导航、独立目录选择、密度/手机折叠和B真实反馈；无业务/Auth/API/schema/权限/金额签名改动，0生产业务写。

标题带detail作用域修复双标题及手机可见性，公共Figma字体/按钮/普通标签与输入/表头/主名称/卡片弹层及手机44等已实施。SourceSans3固定官方87b37a.../OFL，170188B单自托管WOFF2，CJK系统fallback；control8/card-dialog16/sheet24，媒体/打印例外保留。新增编译CSS正反顺序守卫追加CI、不替代旧检查。

本地最终build dZkhwr9KhJuUc6XLoTJ5T，12CSS/双引擎四宽两顺序16组真编译样式及字体加载通过；最终真实React相关54/54，Office实际布局另2/2。新测试两次契约误判及Office语法/主名称未命中反例已保留且修复；独立代码/增量GO，详细边界见报告36。远程准确head CI、同源候选、fresh-main同树/即时回滚和正式双端回执仍需完成；不能以本段声称已上线。

## 独立品牌/型号实施候选（2026-10-15）

组合289e/iS5真实18组已过（最终独立cleanup另核）；新增20定向/2native过，Cr32.0/32.2/26.2、WK36/31/35ms、0GET。498本机497过/1PS环境skip，4108i18n/类型/lint/build过。首次组合中断证据确认为helper等待全页无限动画，非商品权限/业务失败；已只修菜单有限动画同步与30s限时，原断言保留。最终此测试/文档commit不改产品源，精确head CI/双域门槛继续。

当前新增B组合候选：仅在本分支合入PR58的4751cf5d提前验收；正式必须PR58已MERGED且fresh main合并tree等于已测试tree，不能提前发布并行未准入代码。七冲突只保留双方新增及processing/data-step-number；组合完整CI/生产构建/API复验另记，原gr1与995e的18组成功分别归档。

用户确认实施并上线；候选codex/catalog-separated-20261014从fresh main d32dafc2起。当前已落独立SearchCombobox、保留useCatalogIndex预取/合并/授权失效、可选系列/跨系列代码搜索、手填Enter/Tab/blur与Esc、窗口化/移动定位；新建同次清型号/核验、即时撤销不恢复签名/同意/授权，已有单字段规则保留。手机自定义颜色不自动折叠；仅草稿签名失效，存储签名/销售快照不改。无DB迁移/生产业务写入。详docs35。

真实本地组件108不同用例通过（主106=104过+定向修复/签名补12过）；30原生样本各阶段最终Chrome P95 32.4/33.1/26.2ms、WebKit32/31/33ms，0额外目录GET。491 unit=490过+1既有PS环境skip，4107三语/TS/lint/正式build过，原导航warning保留。证据.local/catalog-separated与.local/device-catalog/separated-performance；首次网络/实体键盘非本指标。

目录pending已补单SVG/aria-busy可见按钮，兼容B共享单线；source双引擎2＋rootB组合2＋最终native性能2通过。后台预取/关闭不busy，未改hook/读取/权限。新本地Colima/Supabase与同一production build通过18组真实Auth/RLS/API＋双引擎保存刷新/三语打印/反向关联/账号切换，loopback TLS验证原Secure Cookie；15组合成数据残留0、admin null/rev0。30次130型号目录API本机P95 220.3ms，非公网冷启动。未用旧云runtime脚本；CLI2.101兼容只在忽略副本，不改tracked Auth/RLS配置。远程精确SHA CI与发布尚未完成；实际回滚alias dpl_6c8DTE8jrTgUKmm63V9g7uDPdWfy/正确project已只读核过。3191/3177/3178仅本候选，不停其他服务。详.local/catalog-separated/formal；早期HTTP Secure Cookie环境失败与精确TLS取消消息测试适配保留，不放宽业务断言。

## B方案正式改造进行中（2026-10-15）

用户已授权B方案实施、后续维护规则、验证与正式上线。基于fresh main d32dafc创建项目内独立发布检出`.local/loading-b-release/source`，branch codex/loading-b-20261014；未混入根并行Office工作。已移除5 route loading/3整机骨架，真实导航原位+2px线、作用域bootstrap、旧查询保留/权限清理、账号状态和维护契约。独立审查修两个bootstrap反例；Node24 498(497过/1缺PS环境)、导航22、实际组件SSR/水合20＋目录10过；初104相关浏览器102过/2WebKit失败保留；目录性能冻结后3过，409账号恢复修latch并加强请求反例后双浏览器repeat3共6过。补真实表单/IndexedDB合成4过：未知显示待核对，busy锁/原ID恢复不变；cf12164/5mq及f038/V8旧候选均过期，不晋升；另补根级错误重试进度宿主2项双浏览器通过，只以最新PR head完整CI及候选作门禁。双域仍旧6c8/d32。真实Auth/DB不由合成壳证明；尚未发布，完整新head CI/候选/双域验收仍必需。详docs/35-loading-feedback-b.md。


最新门禁：4751 PR38650806205完整成功，push38650801088为390/392，仍NO_GO未发布。trace证实旧导航在新导航期间仍显示pending，已用最新onNavigate实例token修复，完整导航24＋竞争repeat5共20过，保留并强化单实例断言；目录90点击跨30秒后把合法same-revision权限核对混计为新查询，已分开严格核对新数据0/周期scope+unchanged，双引擎repeat3共12过，原native200ms和撤权用例不放松。修复、独立审查和新最终完整CI后再生成/晋升同源候选。

返回验收补查：两引擎桌面等待中Back/迟到响应过；375实际反例为Dashboard已提交、等待已清而抽屉仍open（proof/back-mobile-check.log）。de90两CI已请求取消、46Z候选退出晋升；正在最小修AppShell路由归属菜单状态，覆盖Back/Forward不得复活旧open、账号details关闭并保留desktop collapsed。旧3451服务已按cwd停止，生成next-env已恢复；下一最终head需重新完整CI和候选。

菜单最新修复已完：32导航全过＋Back/Forward核心双引擎repeat3共6过，summary受控消除Escape反例，desktop collapsed保持；实际200/2000/5000ms已纳入最终源码测试。Parent独立CODE_GO，TS/lint/i18n/Node及formal build过；4同字节生成类型重复已备份清除，不改规则。等待新最终完整CI与候选；源码本记录为冻结时刻，最终发布回执查PR58及canonical PROJECT_MEMORY，不能据此pending记录自动重复发布。

最新锚点反例：5fb push完整成功498Node/402浏览器/正式构建，PR401/402失败，仍NO_GO。双引擎独立probe证实同URL确会刷新动态段，native hash可被旧RSC覆盖；已删共享同步快路径、同URL需真实pending结束、全部页内hash复用共享Link。skip键盘回归由focusTargetId+tabIndex=-1在最新提交后移交焦点闭合。最终修复新head需完整CI、同源候选和新独立GO；不晋升5fb或更旧候选。本段冻结在发布前，最终结果查PR58/canonical记忆。

候选CSS补查：8d3实际Chrome skip position=relative，module fixed被共享相同优先级定位覆盖，NO_GO。两8d3 CI主动取消，HFjQ候选不晋升。共享基础定位改:where降低默认优先级，五路skip增加fixed/离屏断言，新源码须完整CI和新生产候选实际样式验收。

## 当前 Figma 操作反馈修复与上线（2026-10-14，候选）

最新用户已授权按原Figma补全缺失组件、相关操作状态与逻辑闭环并上线。独立发布树 `.local/ui-feedback-release/source`／分支 `codex/ui-feedback-20261014`，基线main5826131；公开Office1.3资产保持原字节。Figma按钮／焦点／错误输入已读取，扩展真实导航等待、加载恢复、原requestId回执、草稿锁、客户分页及下载请求提示，不修改Figma文件。474/475本地Node（1Mac无PowerShell跳过）、3953三语键、类型／lint零错误、正式build；原360浏览器323过37失败，修正后96相关回归过。采购20私有／6预览／54领域、签名返修草稿8两浏览器增量通过。新增采购本次成功信号、分组原回执恢复、confirmed Promise收尾锁与isCurrent；相关34浏览器及私有慢清理/卸载反例已通过。旧0f／740候选不晋升，PR56最终SHA须完整CI、独立审查与候选→正式只读验收。详[报告34](docs/34-figma-interaction-feedback-release.md)，没有生产业务写入。


## 目录三级选择与读取提速（2026-10-13候选）

用户批准检查闭环后的实施规划：保持品牌→系列→型号，索引就绪后结果可见P95≤200ms，首次网络请求另测。隔离源当前分支codex/catalog-picker-speed-20261013，基于最新main81c4ae2f；根并行Office候选保护。无迁移或生产目录写入。新建品牌/型号原子提交与取消恢复、单字段更正边界、手填/历史、三语/44px/16px、窗口化候选及全类别品牌支持已实施；GET单事务保留原session/member/RLS事实，index≤3000与完整分支/版本/scoped失效已实现。

本地466unit=465过/1既有PowerShell环境跳过，类型和三语通过，lint0错1原warning；真实本地Auth/API/RLS8组与3001边界已过且fixtures清理。既有86定向browser最终行为通过；新8双浏览器用例通过（含30次tier采样），本地未节流Chrome/WebKit品牌/系列/型号P95≤49ms，预取后0额外目录请求；不冒称公网冷启动或实体手机成绩。独立权限复核已补跨缓存scope/会话代际/全局版本与未授权系列投影反例。formal双浏览器商品保存/刷新、工单保存/三语打印/客户设备反向追溯已过；最终四宽/三语、inflight focus恢复通过，30次本地真实Auth/API index网络P95约351ms（130合成型号/dev/未节流）。正式模式生产build已过；当前SHA CI和生产核验仍在进行。证据`.local/device-catalog/picker-*`，最终发布前复查main/部署并保留回退点。

## Office 产品页与微信视频（2026-10-13）

`/toolbox/office` 改为精简产品介绍、八项应用、三步、43秒竖屏视频、下载与折叠FAQ；所有 CMD／PowerShell／命令复制和命令教程移出该页，旧API兼容保留且无页面调用。三语、公共组件/token复用，下载仍1.3.0测试版；1.4开发候选不属于此次页面发行。

视频1080×1920/30fps/H264/AAC，18段烧录中文字幕、本地配音与原创音乐；媒体3.6MB，12帧双乱序重复一致、全解码通过；未执行微信发布或实际Office操作。详情见[说明](docs/Office助手产品介绍与微信视频20261013.md)。从正式e3067f5独立实施，发布以当次CI/来源/页面/媒体验收为准。

## 当前 Office 1.3 Fluent界面实施及上线（2026-10-13）

用户授权按推荐修改并上线。先完成三语Fluent交互预览，Chrome三语×六尺寸×十一状态198组无溢出/越界，清空、Word单选移除保留其余与机器OneDrive禁用已点击。原生使用WPF自带Fluent.Light，统一控件/紫色选中卡/直接应用管理入口/44图标刷新与更多/底部进度；主区无滚动，紧凑运行中收不可用管理入口。独立只读确认新入口、选择工厂与主题不改变原卸载/许可/恢复/取消/原账户范围，Core仅Version。Client/UiChecks严格编译0警告错误；Windows144组合成运行和完整CI/双RID公开发布正在准备，尚未上线。未签名/真实Windows验收pending。详[1.3记录](docs/Office助手1.3Fluent界面与上线20261013.md)。

## 当前 Office 1.2 实施与上线（2026-10-12）

用户已确认完整选择组件预览并授权执行及上线。原生 1.2 实现可选安装、兼容补装保留版本/全部语言/未选应用、按检测逐项或全部卸载；主页面无滚动容器，其他操作独立菜单，按钮固定高度。Schema2 恢复冻结原选择和指纹；Schema1 确认明确旧全量范围。机器级 OneDrive 不支持，当前账户卸载需核验原令牌并保持原助手窗口打开，不删除文档/云文件。

124 项 Core 合成边界检查、23 项 Office Node、18 项发行准备、三语检查/类型/lint（1 个既有 warning）通过。双 RID 已严格编译，23 输入哈希完全相同且与当前源匹配，PE/bytes/SHA 通过；WindowsChecks ARM64 仅编译通过。独立审查三项范围缺口均修复并复核。4f6完整远程CI与108组WPF布局检查已通过。补齐OneDrive单选确认/完成/详情/历史/恢复文案、终态临时提示清理，最终120组布局及关闭保护反例与完整CI、官网发布正在执行；完整实际 Windows/UAC/Office/OneDrive/文档保留仍待验收，未签名测试版。详 [1.2 记录](docs/Office助手1.2选择安装卸载与界面20261012.md)。

## 当前 Office 1.1 流程与界面优化候选（2026-10-12）

最新用户要求先完整预览再制作 UI，并解决安装成功后的收尾等待、真实进度和内容简化。已先完成 HTML 三语交互预览，再实现原生 WPF 1.1：卡片摘要、折叠详情、固定底部进度、状态驱动主按钮；安装与移除 Display=None，保留真实安装器五分钟等待与取消，不杀／忽略真实安装器。原任务续激活／缺组件续装，失败检测清旧摘要。真实工具／OneDrive 下载字节、媒体 SHA 文件数接入结构化任务记录；没有可靠数字来源的 Office 安装等仅显示阶段／活动／用时，未完成不显示100%。

93 Core（Office替身）／32 Office Node零skip、公共i18n与原生238组三语词条／动态键检查通过；双RID严格build与WindowsChecks ARM64编译通过，20输入／PE／SHA核对。最终x64 077aa7f2…5863／64931032B，ARM64 a49d8565…f4b5／61084365B。Chrome45状态＋12宽度语言组合与修复／续激活／取消／卸载确认交互通过；预览导出下载事件超时，文件未确认，不记通过。HTML截图非Windows原生。交付目录 `交付/Office助手1.1界面优化候选20261012/`；详[本轮报告](docs/Office助手1.1流程与界面优化20261012.md)、[完整预览](docs/previews/office-assistant-ui.html)、`.local/office-ui-1.1/`。

原生1.1未在Windows执行；GUI／UAC／真实安装自动续激活／重装与文档保留待验，未签名、releaseReady=false。没有1.1公开发布／main／官网更新，旧1.0实测不冒称新版验收。前轮1.0.1六公开资产核验与tag38180056650完整同源CI已success；客机浏览器警告仍须用户亲自处理，未绕过。下一步在候选首次运行的具体许可／安全边界满足后做原生验收，再按发布授权推进。

## 当前 Office 1.0.1 修复与远程 Chrome 实测（2026-10-11）

最新用户授权“虚拟机里随便测试，任务是完成软件开发”。指定远程机 Win10 Home21H1/19043.928、Intel Pentium8505/4GB/x64/意语/1024×768；与其他 Win11 ARM64 机不同，只作兼容实验。重新连接时用户已打开1.0.0并自行发起InstallActivate，先前下载警告由外部处理，根不绕过。真实微软安装完成、23:19库存两个SKU/x64/17932.21000/两SKU it-it/八程序全找到；23:01原任务因OfficeC2RClient/msiexec中止激活，Installed保留，稍后重新检测解除。初始无旧Office，不能将Removed计为真实卸载。Word主页真实启动；23:25打开Word时实际阻止操作、关闭刷新解除；许可当时仅ProPlus状态2/宽限43198分钟，不是已激活。用户已当次明确同意微软适用条款及恢复同一任务测试激活；同任务23:34:52从Detect/Components/Activate恢复，23:35:18 Completed，无新Remove/Install，两SKU新鲜读回均已授权259200分钟，实际服务器s1.kms.cx。最终JSON报告在客机保存并用Notepad读回OFFICE_READY、TargetInstalled/AllComponents/TargetLicensed=true、LicenseError为空；唯一ActivationAttempts s1.kms.cx/true/21:35:14UTC。23:47普通权限GUI PowerShell只读取得运行EXE SHA 083430…5d09，与公开1.0 x64一致；首次字符串管道绑定失败经Get-Item更正，无文件写。

1.0.1源码已修安装收尾五分钟等待及可取消、有限识别空闲MSI服务PID、只读探测/HTTP正文期限、任务中断恢复、实际安装器事前boot与即时重启码保存、未知结果保守复核、工作区窗口、移除跳过事实、导出颜色；仅卸载去新条款门槛/Remove AcceptEULA，安装激活保留。补许可检测失败则禁止写入／不猜许可的门禁；72核心（Office替身）、32Node零skip、最新版WindowsChecks ARM64编译0警告错误；双RID严格build及独立复核18输入/PE/SHA通过；当前未在此客机启动1.0.1、未签名/releaseReady=false/Windows验收pending。最终validated-dist x64 4a3f3d37…f821f，ARM64 8fe0c2e6…6eba；旧69检查构建保留为中间快照。证据.local/office-dev-1.0.1/与.local/office-remote-test-1.0/；交付/Office助手1.0.1修复候选20261011/；目录和23源码ZIP已更新72版，旧69交付在first-delivery。详[开发与实测记录](docs/Office助手1.0.1开发与虚拟机测试20261011.md)。

Git隔离目录.local/office-1.0-release/source clean起步、remote正确、官方fetch确认main仍deebc7b2无新并行变化；新分支office-assistant-1.0.1-fix 35d51b12f8264f948611851ae847751b678140e5已push；PR46为draft且已attach，21限定Office路径（18源码／测试／目录+3文档）与根冻结输入对应；push38178137643/PR38178148934完整同SHA CI均已success，72Core/18发行准备/438Node零skip/320浏览器；唯一lint warning为未改lib/backend/client.ts:45。fresh main仍deeb，正式两域仍dpl_4QXV..，门禁见.local/office-dev-1.0.1/ci-gate.json。已授权唯一子助手仅tag+公开prerelease六测试资产供VM运输，latest=false/Windows待验；main及官网暂保持，尚未执行发布结果核验。根负责VM/连续记忆，唯一子助手负责最终产物独立复核／交付／Office修复报告和draft PR。下一步最终报告核对、修复候选GUI/完整三操作和失联重启恢复，再依当前源CI处理公开测试更新。访问密钥/完整URL不写项目证据；浏览器安全警告必须用户处理，行动时协议确认不重复泛问。

继续实测至2026-10-12 00:09：Word、Excel、PowerPoint均实际进入编辑器并保存合成测试文档；Excel公式2+3=5。Documents/OfficeAssistantTest三文件名称与SHA已用普通权限内置PowerShell只读记录；尚未实际卸载／重装，保留结果待验，不涉及客户或OneDrive账号数据。详 `.local/office-remote-test-1.0/test-document-preservation.json`。

2026-10-12 00:16八项启动检查：Word/Excel/PPT保存三合成文档；Access主页、OneNote实际编辑器通过，Outlook classic邮箱设置／Skype企业登录／OneDrive未连接面板均实际显示。未使用个人账号，不当邮件／通讯／同步验收。Skype关闭窗口仍lync后台，托盘Esci已正常退出，fresh Refresh四操作按钮实际解除。两次自动审批拒绝不明确坐标（Skype设置菜单、OneDrive面板外点击）均未执行，已用明确退出／Esc安全替代。详 `.local/office-remote-test-1.0/eight-app-startup-evidence.json`。

2026-10-12 00:25：仅公开1.0.1 prerelease/latest=false，tag35d51，六资产公网HTTP200/大小/SHA6/6与原字节匹配；现有Latest仍0.2.1，main/官网仍deeb/1.0。tag38180056603成功、完整38180056650运行中。客机用Edge准确下载1.0.1，今日文件ChinaTech-Office-Assistant-x64 (1).exe被浏览器“可能损害设备”拦截；按电脑操作规则已markHandoff并一次async请用户亲自处理警告、确认新版首次运行及新卸载／安装／激活／重装和适用条款，尚无答复。根未点击保留／绕过、未执行新版、未在客机核新EXE SHA。详 `.local/office-remote-test-1.0/new-candidate-handoff.json` 与发布侧 `public-release/notes/published-release.json`。

## 当前 Office 1.0 公开测试版已上线（2026-10-11）

用户“上线”明确授权源码/发布与官网切换。31个Office/下载/三语/CI路径，806其他基线blob保持，未夹带根public.ts的其他Android改动。源码deebc7b2ef8cdb6efcde002f10deaa217c37c96a经push38153146022/PR38153230809两完整CI成功后正常FF main，PR45 MERGED；main38154649555、tag38154597157最终也完整成功（各438 Node零skip/320浏览器/34 Core模拟/双RID及Windows检查器编译/PS5.1解析/3663三语/TS/lint/build），tag另一个Windows原生工具run38154597271也成功。

GitHub office-assistant-v1.0.0公开prerelease/latest=false，6资产完整公网下载SHA匹配；官网双EXE链接切1.0，README三语说明公开EXE直接打开/本地ZIP另解压。EXE原字节：x64083430…5d09，ARM642879c3…035f；源码ZIP19文件与candidate一致，README公开说明独立补充不改编译源码。正式Vercel dpl_4QXVDBvRKWTvgdip3Uhsc8eHgdg5为deeb/Git/main/READY，两域alias；最终main/最新生产复核同源，10只读HTTP过，旧准入min=current021、控制匿名401保持。旧021 API/catalog/SQL/准入不改，无业务写入/Office动作/重启。新版EXE未签名、releaseReady=false、realWindowsAcceptance=pending，完整Windows GUI/UAC/八项安装激活卸载/文档OneDrive保留/中断恢复仍未验。

正式Chromium/WebKit三语四宽24唯一场景覆盖，4实际网页EXE点击下载SHA/字节匹配；375真实锚点标题低于导航、44px按钮触达、无溢出。初轮WebKit375中文auth/status pageerror保留；干净375三语及锚点零错、同源200，原根因未确定。tag初轮旧retail-unified WebKit交付用例失败319/320，14相关源码/test与775b原生产完全相同；trace显示点击时根滚动移动30px，未捕获submit/storage，不能定性根因。原断言独立3263 repeat3全过，仅失败job重试一次最终320过（22.3min），原failure/state/log/trace/artifact保留，不改测试或业务。定向首次cfg cwd启动失败保留、修后成功，Next自动生成路径恢复，candidate clean。

正式证据.local/office-1.0-release/published-verification.json及[上线记录](docs/Office助手1.0上线记录20261011.md)。交付/Office助手1.0测试候选版20261011追加上线记录/正式发布验证/官网说明并重算SHA；旧重构报告已标明随后公开测试版。自己3262/3263无监听，watch30353/19137/61101均正常结束，子助手完成且无关闭接口，不声称已关闭。下一步仅在当次新EXE/微软条款/实际Office测试确认后推进Windows验收及可信签名，发布授权不扩大Windows操作边界。

## 当前 Office 助手 1.0 全面重构（2026-10-11）

用户“Implement the proposed plan”后完成全新独立 WPF 1.0；旧客户端/协议测试 30 源文件归档到 `.local/office-rebuild-1.0/legacy-source.zip` 并退出活动实现。固定 LTSC ProPlus 2024 64位+独立 Skype SKU，八项全装，Office 语言跟随 Windows/回退英语并可独立选择。新客户端不依赖网站准入、会话或任务取包；ODT/OneDrive 微软验签、固定版本媒体/hash、移除全部旧 Office 含 Visio/Project、保护文档/OneDrive、ospp.vbs 默认网站服务器+备用、机器锁/ACL/账户绑定/取消/检查点恢复已实现。注册表待重启仅建议，安装器真实重启码保存暂停且不能被新任务绕过。三语174词条；未知移除不重放、缺组件续装、安装后激活失败单独重试。

双RID严格构建成功，EXE/PE及全部当前输入核对通过：x64 `083430f68462fce09ea60e6a2e1de79a7d992fa600eb90c1e2416021f6a05d09`；ARM64 `2879c3b199b0ffe7467fe04899109bc1b8a86753ab7b07edf700bbf1b201035f`。34模拟核心、30 Office Node、18既有发布工具回归通过；专用 Win11 26200 ARM64 VM 的 SYSTEM 控制台原生15检查通过（检测/ACL/日志/锁/取消，不含GUI/UAC/Office操作）。真实检测两SKU已许可/x64/英中/16.0.17932.21000，LYNC仍缺，AllComponents=false，不能当本轮安装/激活或用户实体机证据。初始夹具/网络/编译/管道/解码失败均保留并定向修复；最终Office/安装器/检查器0，Defender实时保护开，自用3261已停。

交付 `交付/Office助手1.0测试候选版20261011/`（双EXE ZIP、新源码、报告、验证JSON、SHA）。未签名，releaseReady=false，真实Windows验收pending；随后已按“上线”发布1.0测试版并切官网，旧0.2.1后台兼容保持，数据库未改。新版首次运行/微软条款及VM完整三操作当次确认已派发但无人工回答，不执行依赖动作。下一步按答复做新GUI/UAC及x64/ARM64实际八项安装/激活/卸载/文档OneDrive保护/中断恢复，完成后再单独处理签名与稳定发布。详[交付报告](docs/Office助手1.0重构交付报告20261011.md)、`.local/office-rebuild-1.0/verification.json`；以下旧0.2候选记录只作历史，不继续旧架构。

## 当前 Office现场待重启与按钮禁用排查 2026-10-11

用户提供Windows照片：Win11 26200 X64、未检测到受支持C2R Office、待重启、四按钮无法点击，重开软件无效。优先处理此问题，独立网关准备已停止：仅4个未构建源码文件，无测试/服务句柄，3258无监听。DEV x64已在R28隔离冻结源严格构建成功e7f20bf6…89afb；首NU1900网络失败保留，官方NuGet审批重试，不放宽检查。双架构客户端已本地暂存，网关未就绪，不能当远程可用包。

独立复核正式发布源67b81c3/原生9270de7：待重启禁用四按钮并在执行前复查；CBS/WU重启键存在即触发，重命名仅现存Office相关源路径触发，空/缺失renames不会误触发。该检测与R28候选逐字相同，升级022不自动解除。正式Button与子TextBlock有禁用白字低对比风险；本地候选已深色显式文字，未发布/用户机未验。无C2R目标时激活/卸载另不适用，不能把机器上所有Office都判不存在。

建议保存工作后从Windows开始→电源→重启，再打开助手重新检测；不是重开程序。真实触发标志/具体exe版本尚未知，照片不足以定位；若完整Windows重启后仍出现，应先只读查来源，不清注册表或绕过。此轮只读源码/照片，无Office/注册表/重启/生产操作；证据 `.local/office-restart-screenshot-20261011/verification.json`。远程连接授权卡仍待答，持续三操作goal未完成。

## 当前 Office远程Chrome验收准备 2026-10-11

最新goal改为在用户指定 kyox215.eur4.ug.link 的noVNC远程机，用Chrome持续测试Office安装、激活、卸载并完善。连接含访问密钥，CUA首次打开被自动审批拒绝：尚未认可远程会话/凭据使用的明确授权。已发一次授权卡，人工答复仍缺；没有重试、间接访问或保存密钥。新目标保持active，恢复后的阻塞审计重新计数，本轮仅第一次，不能沿用旧Skype阻塞次数。

准备已做：48候选源与R28/双RID候选SHA相同；正式021双RID本地字节与清单一致，公开status实际HTTPS读回accepting=true/min=current021。独立源码复核表明现有catalog/会话版本上限021，不能用官网地址022包当匹配f264执行条件。旧GUI网关固定Round1/00b061，R28DEV仅ARM64且回环3258；最新候选完整GUI需匹配新机架构DEV及同步回环网关，合成授权与正式准入分开。尚未访问新机，不能搬用旧Parallels的Skype/许可/系统事实；0Office动作/生产变更。

下一步待连接授权后，先现场核Windows/架构、权限/UAC、现有Office/附加应用、占用/重启/空间/许可与文档范围，再做真实三操作及必要迭代；先021基线，最新候选不靠旧包或CLI替代GUI验收。准备证据 `.local/office-remote-acceptance-20261011/readiness.json`。自动审批拒绝须向用户明确说明，授权卡accepted仅表示问题已派发。

## 当前 Office报告与验收阻塞复核 Round29 2026-10-11

用户检查对象为Office，已更新[功能与操作报告](docs/Office桌面助手下一步优化报告-20261011.md)：去除已修方位词的待办，澄清32位限制仅安装/重装而非所有操作，区别已实现衔接与真实验收。48冻结输入与根同，未改软件源码/重建/重跑既有测试；旧构建与测试证据按源复用。

实际新DEV普通用户诊断13:30:11UTC仍两SKU、x64、英中两语、六程序存在/LYNC缺；13:34:31UTC按当前LicenseDiagnostics原查询只读得到states=[1]/licensed/keyPresent=true，未读出密钥/许可主机，0激活或权益证明。健康观察无Office任务/marker、防护开，仅旧R8GUI。独立限定复核无新mustfix或漏接；现有套件阻止install，缺保留文件阻止uninstall/reinstall；licensed的activate跳过实际调用，不能当新激活验收。

相同范围/客体输入/合法未许可测试条件从R26、R28至本轮连续待答；前轮准备与核心源码已推进完成，本轮没有可安全推进完整实际验收的有依据下一步，阻塞阈值已满足。持续迭代未完成，等待这些人工/外部条件变化；不重复问题、不放松门禁、不把模块绿灯替代Office。0新Office操作/生产变更；详 `.local/office-iterations-20261011/round29/verification.json` 与当前产品/许可观察。报告交付不代表持续迭代目标完成。

## 当前 Office 重装衔接独立激活 Round28 2026-10-11

goal继续；不能把范围待答当成无源码可做，本轮实现缺失的重装→独立激活。首步保存后重新检测/许可，新UUID经原worker独立activate取包；无key/未知/过期/权限缺/取消/重启停止，已licensed明确未调用。两步期间Busy锁及sticky取消；两步历史/报告分开，旧历史只读不自动执行，手工仅重试activate不再卸载。独立复查三mustfix已修：失败首步误挂手工激活；矛盾历史/许可错误；本地保存失败丢实际结果。JobObservation保留实际Run与Persisted，recording_required停止自动续行。三语15新键，原方位词修。

48冻结输入与根同，runner/Native不变f264，旧PS89/计划101证据按源复用。ARM4be4c953…fb1e1/x64603ced14…fd316/DEV5d0fbfcd…bab7c均本地未签名未发布。双RID各1450 macOS CLR/PE（含103决策+32历史，重叠），Node30；实际Win135纯输入模块检查/新DEV诊断通过，非GUI/Office。原7矛盾反例重跑全拒。初始测试CS8602及两RID/restore构建失败日志保留，修后严格编译0警告/错误。9程序/合成文档SHA保持，LYNC仍缺；250ms CUA点击未打开Start，停止该假设。13:13:17UTC Office/installer/worker/marker0、防护开，只有旧R8 GUI；自用3259全停/无监听，3258无。0本轮真实Office动作/激活/生产写。

下一步新候选完整实装/卸载/重装到许可/激活及GUI/UAC/保存/中断恢复。Skype独立移除重加的一次范围问题、客体输入问题、实际测试许可类型仍无人工回复；没有重问或把accepted当同意。本轮是源码与实际Win模块证据进展，不能判整个goal已阻塞或完成。详 `.local/office-iterations-20261011/round28/verification.json`、[用户报告](docs/Office桌面助手下一步优化报告-20261011.md)。

## 当前 Office 修复准备复核 Round26 2026-10-11

active goal 已继续，最新四操作真实验收仍未齐。R26 完整描述器24节点/6范围未揭示 Lync 精确排除条件；官方同版本新索引与原件 SHA 相同，不把字段差异当损坏，不重复原地 XML。原生 CUA 菜单可响应，但客体输入仍未证明，新 GUI/UAC 未通过；未用替代 UI 技术。

独立复核后修准备脚本两缺口：目的 setup 前后微软签名/实际SHA；结尾六 EXE/三合成文档复核。fresh Verified 目录实际VM预检过，a310b710…c369b；18媒体完整、9文件保持、两SKU英中、LYNC缺。快照 c630a8af…c158 实时列表确认 current，未恢复。12:25:32UTC Office/installer/worker/marker0、防护开，仅旧R8 GUI；自用3259停/无监听。44候选输入与R25不变，0新Office动作/激活/生产变更，无新构建或全测。

已一次异步请求“仅移除/重加缺文件Skype SKU”范围确认；此前合法测试许可类型/替代客体输入问题仍无人工回复。Remove 后须单独验证只剩原ProPlus、版本/位数/两语言/ClientCulture/排除项与9文件，不直接复用默认卸载后的保留集合；中间关失败不Add、不自动回滚。条款未代接受。当前受影响实际动作等待答复，goal保持active，详 `.local/office-iterations-20261011/round26/verification.json` 与修复前后准备源码/实际VM结果。确认缺失不能当准许；此准备不算四操作完成。

## 最新用户澄清与检查报告（2026-10-11）

用户明确此次检查对象是 Office。已按当前源码与项目已有 VM 记录重写[功能与操作优化报告](docs/Office桌面助手下一步优化报告-20261011.md)，区别已有能力、待实际验收和建议新增。44 输入本轮 SHA 与 R25 最终快照全部相同；复用既有验证，不宣称重跑。优先真实四操作/附加应用基线、重装后激活衔接、按阶段恢复与离线只读检测；其次可读名称/建议/历史及导出、组件/媒体缓存/签名。独立只读复核发现 StoppedReinstallFact 方位词与显示顺序不符，列为待修，不改源码。当前完整四操作与新版 GUI/UAC 仍未齐。

本次只读软件审查并写报告；未操作 VM、安装/卸载/激活/发布或修改既有迭代 goal。摘要证据 `.local/office-report-review-20261011T121124Z/source-review.json`，前版报告保存在同目录 `previous-report.md`。若后续实施，按报告顺序逐项完成实际验证。

## 当前：Office ARM媒体与架构失败 Round25（2026-10-11，goal active）

用户澄清Office并补验收：持续VM迭代，反复真实安装/卸载/激活，以及已有Office一键重装到激活全部通过。当前尚未齐。本轮修NativeOfficeMediaArchitecture可信CIM9/12/未知拒绝，ARM三额外媒体必需；卸载后架构错误的三语中性提示与Outcome明确true/uninstall/时间门禁，原未开始误称已去除。44最终输入与根同，f264 runner、旧5a9c/正式65061保持；ARM a2124ddd…408077/x64 60be7de6…4bf6d/DEV d3077815…4f1b1未签名未发布。

双正式各1315 macOSCLR/PE（新增5，重叠）、30Node/类型/lint/三语；新runner Windows89实跑、最终计划101（新增21）过。8实际18文件媒体副本场景过，原媒体/六EXE/三合成文档保持。实际PS卸载后CIM失败结果经冻结CLR/安全报告读回检查点，移除与历史元数据synthetic，当前真实suite_present另判。最终DEV实际只读产品/许可检测过：两SKU英中、LYNC仍缺、licensed/keyPresent true；0激活/权益证明。日志10340锚点后四代表行证实Excluding App Lync，唯一根因未知，不重复XML或定性ARM。

旧签名夹具SOURCE_INVALID、Parallels只读SHA参数、读回工具dictionary/Keys编译失败保留，换正确夹具/核Hash/修工具后原断言过。11:08:30UTC无Office/installer/worker/marker、防护开，自用3259停/无监听、3258无，只旧R8 GUI。0真实Office动作/生产变更。报告已重写为当前状态和优先级，详[报告](docs/Office桌面助手下一步优化报告-20261011.md)、`.local/office-iterations-20261011/round25/verification.json`。下一步真实Skype基线/最新GUI/UAC/保存/四操作和恢复；UIA输入与合法许可类型问题无人工回复。轻微StoppedReinstallFact方位词待下一轮UI验证改，goal active。



## 上一轮：Office完整计划与媒体边界 Round24（2026-10-11，goal active）

修R24误嵌C#/未接计划函数/指纹错位；确认、请求、提权预检、历史绑定版本/位数/逐SKU语言与排除项/文件/MSI/根Culture，严格JSON与深拷贝。确认三语摘要/会话再查；完整媒体按唯一版本固定XML与哈希，卸载后安装前再核、最终语言/保留事实检查。每SKU/目标4097有界、诊断两中性键，原语言不截断；DPAPI过大任务前拒绝。已知失败/占用/待重启也保持移除后未安装检查点，与新鲜当前状态分开。

43输入verified-source与根一致，runner5a9c280f…859630/旧7a47与已发布65061保留。正式ARM64f9a6ba9d…be7bf/x64e3f018da…31b230，DEV40756db4…d5336b；双正式各1310 macOSCLR/PE（新增401，RID重叠）、30Node、三语/严格TS/定向lint过。Windows89（75AST+14IPC）/计划80/5真实Native.Worker DPAPI/peer预检/3实际PS结果CLR读回过；媒体及移除是替身、历史元数据合成，不当Office/GUI/UAC通过。最终候选诊断与真实PS注册表快照一致，仍LYNC缺；六EXE/三合成文档保持。独立复核三缺口已修。

容量夹具两次失败保留：Sort-Object带PSObject，未标注object[]经Ordinal仍文化排序，显式string[]后原断言过。源码/程序构建输入未变，仅测试夹具修正，复用依据在verified-source-provenance。首NuGet/编码/临时策略/Parallels只读参数失败记录，未按观察失败重启业务任务。10:38:33UTCOffice/installer/worker/marker0、防护开，3259停/无监听、3258无，仅旧R8 GUI。无Office动作/生产发布。下一步Skype实际基线/条件根因、新GUI/UAC与真实语言保留/中断恢复；原UIA输入请求仍待答复。详[报告](docs/Office桌面助手优化报告-20261011.md#完整确认计划与媒体边界-round24)、`.local/office-iterations-20261011/round24/verification.json`。

## 最新只读检查：Office优化报告（2026-10-11）

用户明确本次要Office检查与优化报告；本轮只读复核并更新[下一步优化报告](docs/Office桌面助手下一步优化报告-20261011.md)，不继续实施或操作Office。公开GET复核允许新会话/minimum/current均0.2.1；隔离38源码输入，Office Node30通过/零skip，最初漏复制status路由造成2失败后补齐快照复验，原日志保留。正式65061与R23候选7a47归档SHA匹配。当前R24可变runner第24行混入裸C#、计划函数未接入，SHAe22f…81c3与Fingerprint/候选映射7a47不一致；217计划检查未进入ProtocolTests主入口。R24尚未完成集成、解析、正式包或VM验收，R23旧证据不能当当前根源码通过。独立只读复核结束。

报告按优先级列候选集成/完整确认与语言保留/实际附加应用基线/引导恢复/确认后会话与卸载后媒体复核/官方修复/签名/组件及缓存。旧报告副本保存在本次审计目录。证据`.local/office-readonly-audit-20261011T094020Z/verification.json`；本轮Office操作和生产变更均0，持续迭代goal未修改。下一步若继续原实施目标，先修R24集成并补主流程验收。

## 当前：Office附加应用文件基线 Round23（2026-10-11，goal active）

修缺失Skype/Visio/Project文件被过滤后继续操作：三安装/移除动作预检与runner缺失/未知阻止，按位数双合法目录、根→叶非reparse/Leaf、全部原present路径保护，Prepare后/configure前重查登记/位数/路径。语言未知但文件可信不额外阻止，activate原范围/捆绑Lync不变，三语错误含Skype。38输入与根一致，runner7a47e216…647117（旧7f040/已发布65061保留）；正式ARM64d3b5773c…3524c/x643d583465…01ff，DEVdbd5c152…eec12。双正式各909 macOS CLR/PE（新增106，RID重叠）、30Node/三语静态、Windows88（74AST/夹具+14IPC，新增17）过。

最新候选实际VM诊断→新旧CLR对照→冻结主流程卸载/重装均inspect报BASELINE_REQUIRED，实际登记/文件/IPC，Prepare/Setup/License禁止替身0；不当真实ODT/GUI/UAC。六EXE/三测试文档SHA及SKU/语言/应用事实前后保持。独立复核过，根→叶/括号/activate范围冻结前修；测试入口重复类型原失败保留后严格通过。08:54:31UTC无Office/installer/worker/marker、防护开，自用3259停/3258无，仅旧R8 GUI。CUA点击/聚焦仍未改变窗口，不重复、没有未经答复UIA输入/新GUI/网关；未发布。下一步完整本地确认/语言快照及媒体/最终语言核验、Skype真实基线/条件根因、新GUI/UAC与真实中断恢复。详[报告](docs/Office桌面助手优化报告-20261011.md#独立附加应用文件基线round23)、[规格](docs/office-desktop-assistant.md)、.local/office-iterations-20261011/round23/verification.json。

## 当前：Office独立安装语言 Round21/22（2026-10-11，goal active）

候选022已分开界面与安装语言：选择/确认/JobRequest/历史同一捕获值，busy锁定，激活卸载仍UI语言；三语同步。历史仅确认请求，旧字段未知，非法值报告投影清理不重写原件。36输入冻结与根一致，正式ARM64 dac35bf6…1c9c94/x64 e32a9d2b…f9325，DEV3747f7f5…2cce6e；双正式各803 macOS CLR/PE（355+385+63，RID重叠）、30Node/3829静态过。runner7f040不变/R15的71复用。真实VM九组C#请求→实际PS XML函数→历史语言一致，候选自身只读诊断过；没有GUI/UAC/整个runner/ODT执行，仍单语言ProPlus，完整语言保留/组件/Skype基线未完成。

R21安全日志进一步定位配置整理/持久化/ARM语言/条件包，但Lync确切条件未知，不重复安装；两长传输失败保留，改SHA文件调用成功。08:30:59UTC健康Office/installer/worker0、marker无、防护开，自用3259停/3258无，只旧R8 GUI4880；本轮Office操作0、未签名发布/生产变更。下一步新版GUI选择/确认/历史/保存及UAC、真实安装与完整语言/附加产品范围、Skype条件只读研究；原UIA输入请求仍无回复。详[报告](docs/Office桌面助手优化报告-20261011.md#独立安装语言与请求闭环round2122)、[规格](docs/office-desktop-assistant.md)、.local/office-iterations-20261011/round22/verification.json。

## 当前：Office共同语言真实实验 Round20（2026-10-11，goal active）

独立复核/微软语言覆盖规则支持一次新变量实验：ProPlus新增zh-cn，现有两SKU现在都en-us/zh-cn，保持版本/位数/首语言/产品范围/AUTO0。新快照ca6dc317-86a0-411c-b0a7-c1e5504bcc74保留原两点；两步ODT exit0/212.9s，根Groove/Teams但新活动仍Groove/Lync/Teams、LYNC缺，整体failed（205前置/媒体/保留断言非整体通过）。共同语言未修复，不定性ARM、不再重复XML。

测试器失败时独立finally核六签名EXE/SHA、三冻文档、OneDrive及R16/17原结果/32媒体，全部过；普通用户真实三Office COM只读内容/SHA过。最新R19候选未提权读回两SKU新语言准确，34源码/7f040不改。安全日志技术符号定位Descriptor::GetApps排除；旧disabled-by来自TeamsAddon，不应当作Skype原因。PS5.1解析/4语言计划反例过，第一次作用域失败保留。08:06:53UTC健康Office/installer/worker0、marker无、防护开，自用3259停/3258无，旧R8 GUI4880保留；全部操作句柄终结，无发布/生产写/激活。详docs/office-desktop-assistant.md、[报告](docs/Office桌面助手优化报告-20261011.md#共同语言受控实验round20)、.local/office-iterations-20261011/round20/verification.json。下一步只读应用选择/条件元数据；实际Skype/GUI/UAC/当前runner真实故障恢复仍未通过，UIA问题仍无回复。

## 当前：Office真实产品诊断 Round18/19（2026-10-11，goal active）

本地022新增ProductDiagnostics/ProductFacts，Inventory可选字段，三语区分登记与文件present/absent/unavailable、根与活动排除项、null与[]。固定C2R根重开及登记/GUID/版本/位数回读，变化作废；旧模型未知、旧套件未映射警告，不扩大Preflight或runner。34输入与根一致，双正式各355（macOS CLR+PE，含96新反例，重复RID不相加）、30Node/三语静态过，7f040不变，R15执行器71证据复用。Formal ARM6473db3f…543b8/x642107bc…dca17，DEV88d6fa…e3a7c，未发布/未签名。

最新DEV在实际VM SYSTEM12核对及同账户未提权只读检测均过：版本17932.21000、六文件存在、Skype Lync缺失、en-us/zh-cn、根Groove/Teams与活动Groove/Lync/Teams准确。屏幕仍旧R8 PID4880，不当新GUI/UAC/保存通过。R18日志新旧排除与媒体Lync/Skype映射明确，唯一根因未知，无第三次安装。NuGet网络/日志占用/传输失败保留；07:44:43UTC最终健康Office/installer/worker0、marker无、防护及三防火墙开，自用3259停/3258无。无本轮Office变更/生产写；下一步Skype实际基线、当前runner真实故障/取消/重启恢复，UIA回复仍无。详docs/office-desktop-assistant.md新节、[报告](docs/Office桌面助手优化报告-20261011.md#本轮真实产品诊断验证)、.local/office-iterations-20261011/round19/verification.json。

## 当前：Office真实ODT保留复查 Round16/17（2026-10-11，goal active）

两次微软同版本16.0.17932.21000/x64真实手工补装：Round16 Skype-only en-us，两步exit0/164.4s仍无LYNC；Round17双SKU、ProPlus en-us/Skype en-us+zh-cn、Groove/Teams明确排除，两步exit0/222.8s仍无LYNC，实际门禁判failed。第2新ActiveConfiguration 5f3c7109...，两SKU有效排除groove,lync,teams，根配置却groove,teams；不能仅用根配置或SKU、exit0判断可用，更不能定性ARM不支持。官方OCT页面开关可on，raw export因条款未接受未取；没有代接受。停止重复XML，下一步只读ODT/C2R应用选择与固定版本媒体。日志只提取已知flags+lineSHA，不存原敏感内容。

两次六EXE SHA、三冻结合成文档、OneDrive文件/注册保持；最新当前用户真实Office COM三文档只读内容/SHA均过（round17-documents-result.json）。新快照63081f3f-ff6a-4106-b3fe-576ba4f2a680，原075a快照保留。测试器修冻结文档对比/三唯一名称、本轮证据目录归属/secondaryPersistenceFailure、每次ODT前配置SHA+XML、动态ActiveConfiguration GUID；未知停止无旧GUID回退，PS5.1解析与语言/旧排除反例过。Round16 final script0ff602...817ee，Round17 bc97c5...e3a6b1；旧失败媒体复制新目录后下载，原文件保留。

助手根R15/30输入与冻结完全一致，runner仍7f040，没有新包/生产/公开下载变更。实际是手工官方ODT，不算当前助手重装或普通GUI/UAC、Skype启动、许可权益证明；没有调用激活/写key，不推断后台许可变化。Skype实际文件基线仍未建立，原v3缺LYNC门禁不放宽；可以独立继续当前候选真实取消/恢复但不可冒作Skype保护。原UIA输入确认仍无答复。证据round16/verification.json、round16/genuine-operation-summary.json及最新报告；当前全部Office安装任务均已终结。 最新收尾健康见round17-post-documents-health：Office/setup/odt/worker0、marker无、3258无，Defender/实时与三防火墙开启，只有旧Round8 GUI4880；两个自己的单文件3259服务已正常停止且主机无监听。

## 当前：Office取消结果迭代 Round15（2026-10-11，本地未发布，goal active）

本轮是实际源码/VM控制流证据进展。新增Result可选bool reinstallAwaitingInstall：实际runner移除缺失+保留核验成功后true，进入安装前仅reinstall改false，初始/旧字段null；Core约束动作/阶段。OutcomeFacts只认当前app/runner、明确取消/true/合法开始结束记录时间；当前检测用FinishedAt判断新鲜，区分保留SKU/C2R/MSI/检测未知。GUI仅!executing且result引用对应该recordedRun时显示历史取消事实和当前下一步；新任务不带旧提示。报告加固定码/时间recordedRunOutcome，没有自动继续安装/清保护。独立复核MSI非空误提示无套件已修并补反例。

候选022 runner更新7f0404874dd1704b78c8e1be3a9b9b310f631807ed97d02fa75c37f318f50cb1；已发布011/012/020/021及v1仍65061，b532旧文件保留。Round15/30输入与根一致；Formal ARM6444918f…3176c/x64fe7920…6ffa7，DEVd6ca69…e9ad7。双正式各259 macOS CLR+PE/排开发类、30Node/三语/类型/runner lint、实际提示+导出26场景过。新runner需复验，所以Windows原71本轮实际重跑过（57AST/合成+14真实事件/自有空进程）；PS实际主流程8边界及C#同8读回过，不相加独立计数，Office边界是替身，不当真实卸载后取消。最终候选自身SYSTEM只读检测实含ProPlus/Skype，两个取消夹具在最新状态正确suite_present。首次Products替身未排序被ENVIRONMENT_CHANGED正确阻止，失败保留，排序契约修正后原断言过；没有放宽环境/保留保护。

收尾06:15UTC左右实际健康见round15-final-health.json：Office/setup/odt/worker均无、marker无、3258无、防护仍开，仅旧Round8 GUI4880保留。自己的3259 server6893正常停止且无监听，本轮host/guest调用均终结。无真实Office安装/卸载/激活或生产写入，公开021未变。健康重查旧脚本固定文件名覆盖已将新查询移存round14-start-health，旧数据从Round13验证包恢复，来源明记round14-health-provenance；脚本现在新命名且拒覆盖，不伪造旧raw transport。

下一步优先实际保留Skype应用基线，微软现行部署文档确认Skype2024Volume支持且LTSC默认不安装Skype；当前SKU不能证明应用，v3门禁仍不放宽。再做当前7f040候选真正Office取消/ODT失联/重启和管理员恢复闭环；旧v3故障器固定Round5/b532不能冒作7f040验证。原生UIA输入问题仍无用户答复，真实新GUI/三语/保存未验；不重复询问、不把accepted当许可。实体架构/权益/可信签名仍未齐，goal保持active。证据round15/verification.json、round15-stage-tests-b-result.json、最新报告取消结果节。

## 当前：Office系统恢复迭代 Round13（2026-10-11，本地未发布，goal active）

持续改进目标仍active；上一goal turn是实际代码/VM证据进展。本轮SystemRecovery新增固定系统marker只读absent/present/unavailable，父路径必须目录且非reparse；GUI系统/本地状态分离，启动/检查/开始确认前后/结束刷新。已核对确认后再查，只在系统明确absent时归档本地提醒；系统absent不自动清掉原未知UUID。报告加systemRecovery state/capturedAt与有效recoveryRequired。独立复查发现既存创建窗口会覆盖/误删外来marker，已改CreateNew成功后才赋activeMarker、UTF8/Flush(true)；原mutex/同SID UAC/ACL/未知结果保护保持，不加系统删除或自动重装。

Round13最终27输入与根一致，runner仍b532。正式ARM64 a0065d…8d5e3/x64 0f34d0…8bf57，DEV bb5b60…8b558。双正式各231 CLR/PE/排开发类在macOS过；30Node、3829三语静态/类型/翻译lint过（补两既有Office错误码词条，网页词条另存SHA）；当前提取导出表达式20场景过。Windows同账户普通令牌最终候选自身--recovery-diagnose实查固定ProgramData路径absent；实际helper/提取Ack方法22探针exit0通过，确认是合成，无真实GUI输入。权限内容读取实拒绝仍识别present并阻止、junction拒绝、原UUID/字节保留、确认竞态过。属性Deny并未使GetAttributes不可访问，所以属性不可访问分支仍未验。两个原探针失败保留；默认All恢复误请求SeSecurityPrivilege改仅DACL，未提权或改系统安全设置。证据`.local/office-iterations-20261011/round13/verification.json`及round13c-vm-probe-result.json，最新报告系统恢复节。

最终05:48:36UTC健康：Office/setup/odt/worker/probe/测试fixture均0，系统marker无，3258无，Defender/实时/三防火墙仍开；只留旧Round8 GUI4880供看。自己的3259传输86243正常停止并确认无监听，所有本轮host句柄终结。没有本轮Office安装/卸载/激活/生产变更，官网仍0.2.1。当前Skype C2R x64实际InstallationPath亦无LYNC，ProPlus.ExcludedApps=lync,groove,teams而独立Skype SKU在，缺失时点仍未知；不得把SKU当应用保留或放宽v3门禁。

下一步：原生UIA输入请求仍无用户答复，新GUI保存/三语/恢复界面不冒通过；继续保留待答事项。可独立推进真实保留应用基线、系统管理员归档闭环及ODT中断/重启恢复；完整UAC、实体架构、权益和签名仍未齐，不完成goal。子助手已完成只读独立复查，未写源码/操作VM；无关闭接口，不声称关闭。

## 当前：Office诊断与报告迭代 Round9（2026-10-11，本地未发布，goal active）

继续用户的持续改进/VM迭代目标；上轮报告提供了新优化证据。本轮根新增CanExportReport统一入口与保存条件、exportedAt/serviceError；ReportProjection只投影导出副本事件的已知stage/code/time，非法值unknown/UNEXPECTED_ERROR/null，保留原历史/任务事实。最终实际提取条件及序列化表达式17场景通过，覆盖首次失败及注入历史/当前合成秘密。新增8脱敏反例属于218CLR；同源双正式RID各218协议/HTTP/预检/PE元数据检查在macOS .NET执行，正式无开发类；30Node复用不变TS/消息范围。最终26输入冻结`.local/office-iterations-20261011/round9/source`与根完全相同，runner仍b532。

真实Windows暴露旧只读许可Query先载CimCmdlets时CommandNotFoundException，按固定Management→Utility→CimCmdlets修正（NoProfile/禁自动加载/系统绝对路径不变）；最终候选自身DEV入口当前用户实返licensed/keyPresenttrue/无error，未调用Activate，不证明权益。Formal ARM64 SHA3f8b38…8291/x64b0f92c…3f24，DEVdbb428…6cc2；证据round9/verification.json、round9-license-read-result.json。生产0.2.1、准入/catalog/SQL上限/公开下载未变，没有本轮Office安装/卸载/激活操作。

实际GUI仍是上一Round8 a699…124d，PID4880，首次失败/无库存历史/Export启用已读实控件并看实际CUA画面；CUA两次点击/Tab/Raise未触发保存，Keyboard AX失败，不能算GUI保存或三语通过。当前可视工具规则要求替代UI自动化技术须用户明确指定；已通过async询问是否允许仅专用测试窗口的Windows原生UIA，尚无回复，不能把工具accepted当许可。准备`round9-ui-test-pending.ps1`未运行，后续先获回复再切最终GUI、实际保存/查询/三语。最后GUI可能因30分钟测试会话刷新改变页面，继续前重新读实际状态，不能重用旧控件。

故障测试器v2修AtomicReplace备份/不覆盖原failure，PS5.1实际20替换/读回通过；v2预检数组嵌套失败未启动Office。v3直接读取唯一三文档，新增PreflightOnly；真实预检因LYNC缺失停下，无ODT/注入。四既定x64/x86路径无LYNC，历史只存Skype SKU及三文档，没有LYNC基线/SHA/启动，因此所有旧“Skype保留”限定SKU，缺失时点未知，不能定性本轮删除。先核对安装目录/旧日志/操作前快照建立真实应用基线，不放宽v3门禁。Only脚本自身非passed exit1，外层wrapper未传LASTEXITCODE已修正，原失败保留。

本轮收尾05:20:10UTC：Office/setup/odt/worker均0、protected marker无、3258无，Defender/实时/三防火墙开；仅已知Round8 GUI4880保留供查看。自己的gateway484核对PID/路径/创建ticks、package增量0后通过/_test/stop自然退出，传输89462正常停且3259无监听；stage74459/launch45761/其余host调用全部终结，无待执行Office任务。停止前System会话接口拒绝、当前用户无法验证SYSTEM进程路径两次失败已保留，简短System复核恢复，未强杀/重启VM。下一步：处理用户UIA回复、最终GUI验证及保留应用基线；其他真实操作/恢复/物理架构/权益/签名仍未齐，不完成goal。报告已更新。

## 最新复核：Office下一步优化报告（2026-10-11）

用户明确对象是Office桌面助手。本轮只读核对并交付[下一步优化报告](docs/Office桌面助手下一步优化报告-20261011.md)，没有继续源码实施、Office操作或发布。最新公开GET允许新会话/minimum/current均0.2.1；本轮Office定向Node30通过、零skip。正式与本地0.2.2分开：新增LicenseDiagnostics源码已存在、双正式CLR日志210通过，但新许可诊断真实GUI尚未验收，不能沿用旧GUI证据。下一步优先完整诊断、系统/用户恢复衔接、卸载后取消状态、可信签名、首次检测失败报告；其次官方修复、独立安装语言/组件、媒体复用/任务历史。

本轮只读VM04:19:08UTC查询无候选/setup/Office应用、protected marker无；Round6失联测试器停preflight/failed-or-incomplete，File.Replace证据写入错误，originalJob/workerKill均null，不能当实际ODT失联验收或产品故障。证据 `.local/office-optimization-audit-20261011/current-vm-state.json`、current-public-status.json/current-office-tests.log。独立审查确认当前RecoveryChecked只处理本地last-job，系统marker需另行管理员核对；确定卸载后取消目前缺乏明确后续状态，媒体下载非零与安装失败共用SETUP_FAILED。这些是报告建议，未修复。23本地链接核对通过；本轮自己的3259传输server61807已正常中断、主机端口无监听。此前持续迭代goal仍active，本轮交付以当前报告请求为范围。

## 当前：Office持续改进与VM迭代（2026-10-11，本地未发布，goal active）

用户授权持续改进/VM测试复查/迭代/上网搜索。正式0.2.1、catalog/最低版本/SQL上限/生产控制不变。最新0.2.2候选runner b532c8d4cc3084caed004c97ae4906bb419eb36036efc1b18ac7d1d0b7b32d70，24输入冻结于 `.local/office-iterations-20261011/round5/source`，与根全一致；Formal ARM6473d49…cd5/x64b50e75…044，DEV6b1db6…4b7。30Node、双正式183CLR/元数据/无开发类、真实Windows71（原57+新14真实命名事件/自有空进程）通过；原测试SHA93cd…8b6未放宽。report [Office优化报告](docs/Office桌面助手优化报告-20261011.md)。

已修统一预检/已知Skype保留/位数大小写/bundled Lync与x86对应目录、检测/任务错误分离、阶段计时/禁用文字、临近会话/过期分类/签发就绪、NuGet项目内路径。旧版本按固定SHA归档：011/012/020/021与v1仍65061…7cad，未发布022显式更新到b532，不回退current。原本地受限SQL9/HTTP6及合成身份清理证据可复用旧版本不变范围；最新30Node含该25子集，022未正式准入。

续查确认TASK_RECOVERY_REQUIRED让旧GUI删除last-job并导出recoveryRequired=false；提取实际RecordResult六态复现/修复。Protocol.RequiresRecovery统一RESULT_UNKNOWN/UNEXPECTED_ERROR/TASK_RECOVERY_REQUIRED，GUI/worker保持未知标记，GUI未知结果即使worker已退出仍Set取消。runner一次打开取消event并持有，绑定实际Worker PID/UTC创建ticks/同一SafeHandle，owner消失/句柄关闭失效停止下一安全边界报RESULT_UNKNOWN；等当前ODT退出不强杀。089bb候选最后一个disposed-owner反例真实失败，b532保存并检查同一SafeHandle后原71全通过，独立复核通过。完整脚本预置取消返回CANCELLED/ODT0；用户会话真实Word只读/Native识别WINWORD/文档SHA通过。SYSTEM COM没建立文档而停，不能算通过。

专用VM UUID4bff7828-7e2b-402e-a3b4-25994a977800；保留快照075a9fde-c724-4df0-9791-c7130136b5d8。首轮00b061已实SYSTEM worker/DPAPI/pipe/PS/官方ODT：已有许可核验（无新激活）、卸载64s/安装360s/重装239s成功，三真实Office合成文档SHA与三应用只读内容读回通过；后两未激活。89dc续实卸载67s/无套件许可PRODUCT_NOT_FOUND/安装172s，通过且Skype/docSHA保留。最新b532重装已收口INSTALLED_UNLICENSED/exit0/241s，03:52:41UTC结束；新.NET10→PS PID/ticks/实际ODT完整链通过，Skype/三文档SHA不变；当前用户实际Word/Excel/PowerPoint只读内容读回通过。最新清理clean=true：Office/setup/候选进程0，protected marker无，3258无；自己的3259 server31251已停且主机端口无监听，Defender/实时/三防火墙仍开。所有本轮host/guest进程测试已完结，无pending session。不要按历史marker或旧进程记录重试/杀ODT。

Parallels分块/EncodedCommand接口间歇Invalid argument；基于私有网卡白名单传输并增加vm_bridge --file-invoke（先SHA核对再File）恢复。失败保留：SYSTEM COM两次、089bb disposed-owner、取消测试器用.ps1.txt导致无结果（改复制.ps1，原断言通过）、中文错误UTF8解码/探针flag拼写。并非Office成功证据。GUI首轮7项已验，普通GUI/UAC此前发包0未通过，物理x64/x86/真实许可/代码签名仍未验。安装结束licensed=false，但稍后SYSTEM只读CIM显示targetLicensed=true/已装key。没有显式activate/Invoke-CimMethod，许可变化来源及权益未验；不能把测试器externalActivationCalls=0常量当网络观测或新许可激活证明，原任务未激活结果不覆盖。

下一步：继续最新b532候选单独安装/卸载/许可边界、普通GUI/UAC到界面记录、真实ODT中取消/断网/断管/进程退出/重启恢复，再只读许可诊断/语言组件/官方修复。当前此批复验和报告已收口，goal保持active，未发布；新计数30Node/183CLR/71Windows/实际方法六态，旧SQL/HTTP仅不变范围复用。

## 已完成：Office 主流浏览器下载与启动复验（2026-10-11，发现拦截）

正式0.2.1字节/源码/生产不变。唯一专用Win11 ARM64：Edge154.0.4258.62官网两包均“不常见下载”警告，两暂存原字节SHA/大小/ZoneId3正确，未保留或启动。系统有效微软签名IE入口实转Edge，Win11独立IE不可验，IE mode未验。

用户在专用VM浏览器安装条款问题后回复“继续”；Chrome155.0.8059.40和Firefox157.0.1官方完整安装器签名/发布者/SHA实际核对、exit0，浏览器实际PE ARM64/Valid。独立配置真实官网双按钮四下载均完成、无浏览器警告；四SHA/大小匹配正式0.2.1、NotSigned、ZoneId3。Chrome标准保护实际选中；Firefox恶意/危险/不常见三项On、google5/Mozilla更新时刻可见（更新状态字段不可用、未审计在线信誉请求）。两浏览器ARM64均正常Explorer打开后实显Windows SmartScreen“已保护你的电脑/发布者未知”，截图后“不运行”；两x64均在ARM64兼容层真实联网进入操作页，PID7024/2572路径/SHA/版本/ZoneId3读回、TCP监听0，正常空闲关闭。无Office业务操作/生产变更。

测试器最初按标题漏掉无标题Explorer ApplicationFrameWindow中的SmartScreen，实际VM截图+子控件+详情已纠正，不称应用静默退出。旧程序进程名误查亦已纠正；Mac Chrome补测ERR_BLOCKED_BY_CLIENT与受工具URL限制的下载页仍不确证杀毒、不替代Windows证据。前后Defender/实时/三防火墙开启、对应检测记录为空；Edge原PUA Off不改，无保留/仍要运行/排除/去MOTW。自己3247服务已正常停止且无监听；保留Chrome/Firefox/Edge结果页、原ZIP Explorer及另一任务旧DEV GUI4880，多余初始Chrome窗正常关。详细[报告](docs/Office浏览器验证-20261011.md)、证据.local/office021/browser-validation-20261011/verification.json与前阶段verification-edge-phase.json。

本VM已有软件使用记录，不是全新Windows信誉基线；实体x64、第三方杀毒及其他浏览器未验，不能保证所有设备无告警。ARM64在SmartScreen处停止，Edge后续未执行。后续优先可信签名/时间戳/一致发布者，签名不保证立即消除提示；未办理证书或申诉，公开0.2.1不覆盖。

## 已发布：Office签名工具源码与说明（2026-10-11，EXE仍未签名）

用户随后明确“发布上线”，本轮按已说明范围发布工具源码/说明/CI。独立克隆10路径白名单、813旧blob保持，main正常FF至775b67330da521af66979a4ce9822346438ba220、PR44 MERGED同SHA。两次完整CI38133446378/38133464425 success：Python18、WinPS5.1三源解析、436Node零skip、320浏览器（push18.0m）、3656三语键/strictTS/lint/正式build。main同源第三次CI38134773048取消，复用两份成功；不冒作第三成功。Vercel正式dpl_7KZY6UidZkWb5poBNMNjS1p1zCoT READY/775b/main/两正式域名；5正式公共GET、0.2.1双下载链接、开关与最低版保持、五旧Release资产ID/大小/digest一致、GitHub公开README原字节通过，近期错误/致命日志分组为空。根CI只在仍等于旧正式文件时保护同步。

没有新EXE/真实签名/证书办理/Office或数据库操作，公开下载仍未签名0.2.1，另一任务022不合入。预览READY但普通请求302/既有身份CLI404未取得正文；自动审批拒绝会创建临时分享旁路的受保护预览fetch，未创建链接/改保护/间接绕过，预览正文未验。用户此前证书/服务问题仍待答；源码发布不解决SmartScreen信誉。证据.local/office-signing-publication/published-verification.json、公开[PR44](https://github.com/kyox215/Chinatech-codex/pull/44)、[工具说明](https://github.com/kyox215/Chinatech-codex/blob/main/desktop/office-assistant/release/README.md)。下方保留准备阶段的真实签名缺项。

在浏览器实测后的“继续”范围内新增desktop/office-assistant/release独立工具：双RID正式输入/构建声明冻结、版本递增、传统证书库与Artifact PublicTrust配置、SHA256/RFC3161签名与严格WinTrust/SignTool校验、全原始程序内容绑定和签后SHA。双包通过才写signature-verified.json，仍releaseReady=false。独立复核发现并修复签名期间同版本内容被替换及已提交输出清理失败误报两项，最后限定复核无新实质绕过。根build.py/并行022/runner/网站开关和正式021保持。

实际Python18过；Win11 ARM64 PS5.1三源零解析错误、13拒绝检查准确exit1/错误码、双架构20载荷夹具过，原正式文件/供应商原安装器SHA保持。Restricted阻止未签名ps1，策略未改；SHA固定AST源码命令验证不当正常文件链通过。模拟证书区不建立可信签名。作用域/策略/两次XML输出封装失败保留，Process原始捕获后13过。10:06:33Z实际防护/三防火墙On、Restricted、双证书库可用私钥0、SDK SignTool空、签名输出无、旧DEV4880在；自己的3267已停且无监听。

未实际签名/上传/生产改动/Office操作；正常脚本链、真实实名身份/私钥/云profile/时间戳正向路径及签后浏览器/SmartScreen仍待验。用户是否已有证书/Artifact的问题待答，不发送秘密。下一步取得真实配置和受控签名机，再对已验收新版本签名/完整复测，不能重签覆盖021或直接发布未验收022。[记录](docs/Office代码签名接入-20261011.md)、.local/office-signing-20261011/verification.json；署名/校验脚本SHA均按最终Windows结果固定。

## Office 优化报告 2026-10-11

用户已纠正审查对象为Office工具/桌面助手，此前维修网站报告不作为本次实施目标。已交付[Office专项优化报告](docs/Office桌面助手优化报告-20261011.md)，本轮仅审查，无Office操作、源修复、生产写入或发布。当前正式GET启动允许/minimum/current均0.2.1；管理员误判及无输入准入已实现，不能继续列为未完成。

确定证据：实际Inspect方法以合成Native执行失败→成功仍保留旧error；GUI与runner条件不同，既有0.2.1 VM的SkypeforBusiness2024Volume会被runner拒绝，虽按钮显示可用（条件对照，不冒实际执行）。后台合成证明任务过期与内容冲突共409、缺签发配置时status与session就绪不同（不是当前生产故障）。优化建议为统一预检、诊断/许可、进度与故障恢复、语言/组件选择、官方修复、媒体复用、历史/缓存、可信签名及明确旧网页脚本/桌面行为区别；全部尚未实施。

本轮21Office定向测试全通过；专项16有重叠不相加；查看旧正式VM截图/记录而非新Windows实测。证据.local/office-optimization-audit-20261011，包括源码指纹、正式GET、检测方法探针及产品条件对照；dotnet初次相对NuGet路径失败保留，改绝对路径后探针通过，CSSM工具链诊断单列。真实四操作/中断恢复与代码签名未在本轮验收。后续按新的修复/功能授权执行，不自动恢复此前网站优化。

## 已完成并上线：Office 0.2.1 管理员修复（2026-10-11）

用户授权“完成修复并上线”已完成。main正常FF至67b81c3b7eb99defd362f19260722787fd9e0c38，PR43 MERGED、tag office-assistant-v0.2.1正式release；14限定路径，根11个Office/部署文件按旧main基线哈希保护性同步，其他候选保留。原生构建源9270de7，所有native输入与网站源完全相同，内部InformationalVersion正确；ARM64 SHA9dc03d…8641/61021786B、x64eb43de…d781/64868453B。Native修复SHA0e4c80…d000只读Limited linked token同SID管理员核对，原Worker/UAC/DPAPI/管道/单实例保持。旧0.2.0源码资产与交付未覆盖。

精确67b两次完整CI38090445505/38090443049 success：436单元零skip、320双浏览器22.9m、3656三语/类型/lint0错1旧warning/正式build；两80C#、21定向、23真实本地受限SQL、42 HTTPS/实际Auth双浏览器三语四宽通过。tag/main仅同源无变化自动重复CI已取消并复用上述本轮成功证据，不冒作新成功。CLI实际上传检查发现.local曾进入候选，新增.vercelignore并精确移除本轮3个错误候选；最终完整811源文件无local/private/env秘密/native缓存，先提升已验clean stage WCAMPZ7，main自动Git部署后最终production dpl_B7H48dZFmZPZ58bggbmQamdomrvz/同67b，www正式下载两EXE全文SHA与三说明原字节通过。待后续发布仍检查实际文件树，不用.gitignore假定排除。

限定2策略迁移已应用xluzcoduqsdvjoouqhkc，源文件20261010214304、远程版本20261010215319；正式5发布文件验证后受信marker021，真实管理员在verified021/旧min020完成暂停/恢复、再保存min021并刷新。最终enabledtrue/readytrue/verified021/min021/rev6，旧Office全行fingerprint ed8c16…55f8c不变；正式6会话连续性通过（新020426、新021200、旧cap/token/原1h保持、原5min过期task409不续、旧会话仍AES解包），临时生产token已删，不删审计、不执行Office。

专用Office-Test VM官网下载冻结020实显必须更新/无操作页，正常退出；正式021双RID全文SHA/PE、同账户未提权GUI联网/适用按钮/重新检测、3语、真实No取消、实际脱敏报告021读回、跨架构单实例exit3全部通过。ARM64启动1485ms、x64兼容层2691ms仅单次；last-job/result均无、worker0/Office操作0。最终ARM64 PID8468留供查看，旧PID9556已正常退出；3247自用脚本server已精确停止且无监听，3235/3248停、合成2账号/临时TLSkey清理。真实Office安装/卸载/重装/激活、标准/已提权账号与实体x64未验，EXE无签名。

证据.local/office-admission/source/.local/office021/published-verification.json、完整源树/两CI/正式下载/API及root .local/office021/vm-release.json、旧更新页/最终截图；交付/Office桌面助手-0.2.1-20261010包含正式EXE/三语说明/SHA及脱敏验收，官网/toolbox/office#office-desktop、管理/account/settings#office-desktop-control。部署前自动审批拒绝过未完成CI时tag/upload，已在两完整成功后按原授权完成，没有待批准事项。

## Office 安全软件拦截排查（2026-10-11）

用户报告防火墙/浏览器杀毒拦截，具体原文待补。正式0.2.1 ARM64 SHA9dc03d…8641在专用VM确认NotSigned；Defender/实时防护/三防火墙配置开启，定向扫描1000/1001同ID完结、该文件检测记录0且文件存在。初次下载无Zone.Identifier，程序集名查询漏配已在上述复测纠正；不能把之前VM启动或本次扫描当浏览器/SmartScreen验收。正式源码只自有HTTPS外连/本机命名管道，HTTP监听仅排除的开发类；ODT/Office组件内部联网另计。加密runner落盘及无窗口PowerShell Bypass链可评估改为固定签名worker，但未确认其造成误报。建议可信代码签名/时间戳、一致发布主体和官方误报渠道；微软当前文档明确EV也无立即SmartScreen通行保证。未签名/购买证书/申诉上传/修改源或生产设置，联网准入保留。证据`.local/office021/security-diagnostic-20261011.json`及docs/office-desktop-assistant.md安全软件拦截排查节。

## 当前VM复验：Office管理员误判修复（2026-10-10，本地候选）

正式0.2.0 ARM64原SHA095589…680实复现：同一直接管理员账户GUI未提权，原Groups不含deny-only SID，全部操作误禁用；纠正旧“来宾非管理员”判断。根Native.cs唯一代码修改为Limited linked token只读/同SID/管理员角色核对，真实Worker提升/DPAPI/管道/单实例保持，独立权限和句柄审查通过。Native源SHA0e4c80…d000，严格双RID/80协议、实际.NET10查询2000次true/旧Groupsfalse/当前角色false、句柄216→216通过。ARM64候选SHA46ccf5…212/61021692B，x64bee05e…8c3/64868360B；协议0.2.0仅现有后台兼容测试，published=false，冻结公开双EXE/Git源/网站策略未替换。

续测已完成启动与界面闭环11项：真实联网/检测/适用按钮、激活/卸载/重装确认后语义No取消、实际644B脱敏JSON保存核对、中意英切换、意大利语滚动后导出按钮完整可见、ARM64开启时x64重复启动准确exit3、x64兼容层联网检测、正常关闭及ARM64中文重开。重开1484ms、x64联网3361ms仅单次观测；不冒实体x64。last-job/result始终均不存在，无worker/Office操作。报告无sessionToken/installationId，原JSON内容与SHA已记。初次坐标点击自动审批拒绝仍保留历史，已通过新的真实控件证据解决，不再等真人取消；测试器原始40条系统代理公开注册首发NullReference确在LoadDefaultProxies，再精确守卫一次完成；保存ID重复加类型/名称/owner，语言同名逻辑节点以实际SelectionItemPattern择选，原harness失败保留不冒全通过。

VM UUID4bff7828-7e2b-402e-a3b4-25994a977800，原自己PID10256/x64PID524已正常退出，最终ARM64 PID9556留在VM供查看。证据.local/office-public/live-20261010/continue/verification.json、step1/3/4/5及最终截图；初次partial记录verification-before-continue.json，交付/Office管理员修复候选-20261010已更新三语说明/报告/截图。临时3247本轮收尾精确停止并复核无监听，其他进程/VM不动。真实Office安装/卸载/重装/激活及许可证、标准/已提权账号、实体x64、此修复正式发布仍未验/未做；后续不得当作全操作或已上线。

## 本地候选：Mi Mover 原版热点/公开读写45712（2026-10-10，未上架）

按用户只解除原版限制，保留4.5.7.5原UI/四分类/二维码/安全/协议/恢复，不换引擎。45712 APK SHA `de8b0c24d755477fd5362f396e524da1904c7747226d689bf1e42b13fe320a71`、37092742B，源码 `android/mimover-original`；构建脚本SHA4c3d84ab…d846da、桥JavaSHAb0682a67…b67a13冻结一致。真实非MIUI/API26+公开LOHS/实际AP IPv4两次200ms确认、25s有界失败释放、代次/owner/控制器/待决回调守卫、原手动无Internet Wi-Fi绑定/网关/实际SSID原五端口已适配。系统拒绝原Os.splice已由45710实际日志确认，成对选择原PacketReader完整read/write支路。原HostReconnector仅同实际reservation/APIPv4/dseed/手动SSID-PSK匹配复用→原13/103监听；失效106+原父120s失败，不伪重建。独立9165原类/59258方法：29原方法变、2新增、59229不变；2930其他payload原字节，MIUI/旧API原支路保持。

精确45712两专用API36 ARM64 AVD：原真实手动连接/四分类/1合成PNG100677700B正常发送→新DCIM大小/SHA `59fc14e5cfacc083026b5342361577bf1fd05ca5a2aaa5260735df767b2cb5e1`一致→双方原完成页/MediaStore通过（9项）；原UI/取消返回12、真实热点9、真实WiFi失联15、受控缺回调5、Apple实际原QR内存解码/真实SSID/APIP/原端口通过。Actual sender force-stop后同AP/单系统请求/原103监听通过；冷首页普通Guest未恢复活会话，原120s状态9失败已见，完整进程终止恢复不算通过。证据 `.local/mimover-original-hotspot/runtime-next`，45711小图/早期失败保留单列不冒作本版。系统曾Nearby允许后ERROR_GENERIC2；STA teardown清AP IPv4的真实失败亦保留，新机普通STA WiFi关闭是成功测试条件。新AllFiles正常系统UI授予；旧AVD动画0仅UI读夹具，收尾还原。

交付 `交付/MiMover原版热点适配-45712-20261010`：精确APK/第一方源码/三语说明/脱敏证据/SHA；打包完成：18项第一方源码ZIP SHA `d4ea96bf6d4e6fc1b98ecac9c8ad273b590aa1db1474772bd3d5dc22ee1df553`，40项SHA清单全匹配，VERIFICATION区分实际/受控/未通过；ctmi3/ctmi4按名称精确停止、5600/5602不再连接，旧动画设置还原null、临时XML/两旧私有QR图清理，证据runtime-shutdown-45712.json。官方研究23品牌/系统环境，实体均未验，详 `docs/mimover-brand-system-matrix.md`。API26–32/ARM32/MIUI/自动发现/5GHz/完整重连/联系人短信私库安装恢复及真iPhone光学扫码迁移未验。公共45708本地发布worktree字节SHA593998e7…fee1f本轮核对保持，未编辑网站/部署/DB；网站线上状态本轮未重验。发布仍须非MIUI新Android+旧Android及新Android+旧iPhone实体原协议/恢复/失败验收。详 `docs/mimover-original-restriction.md`。本任务两AVD已关闭，未触及实际手机或其他服务。最终STA开启测试正常AP/原13/IPv4通过，旧竞态未复现；已获reservation缺地址超时仅静态审查，ap-readiness记录明确不算实跑。

## 已上线修正：Mi Mover 原版入口解限（2026-10-09）

用户明确只解除原版限制；lab2自主分类/协议/恢复超出范围，已撤回公开入口及文件。当前仅原版4.5.7.5的MainActivity.h2本地3字节开放新机入口；Manifest去android.uid.backup并递增versionCode45708，原包名/MainApplication/语言/资源/权限/组件/原分类/协议/恢复全部保留，无新增DEX或自有引擎。APK SHA593998e7b3769cc0f33e300183ab78943700996fcece1d0432b4d1a9d23fee1f，36846924B，min21/target35，2930其余payload原字节；独立签名不能覆盖官方包。

全新Google Android16/API36 ARM64 AVD的精确安装与原新/旧入口、三来源/返回/冷重开、原权限与拒绝11项通过；没有原协议两机迁移或品牌真机还原验收，不复用lab2证据。原热点/关闭WiFi/隐藏AP接口、接收写权限、短信AppOps、私库moveData、原安装权限依赖仍在；手机型号和Android版本问题待用户回答。详docs/mimover-original-restriction.md。

正式入口：https://www.chinatech.in/toolbox/transfer#mimover-original 。main从1009049正常FF至0ef3db8958fdf205fef17bb04b6237e55a7bedc0，PR41 MERGED；29限定路径、774无关blob、25其他公共资产保持。精确完整CI37951217886 success（420业务零skip、320双浏览器22.2m、三语/类型/lint0错1旧warn/正式build），本地3625三语及3原DEX门禁。production dpl_5ipMmXa5xezZdNXCVHTT7nBJxSzy READY/main/同SHA，两域alias及HTML部署ID一致；正式30三语四宽双浏览器、全文APK/SHA/Range/无JS原生键盘和28两域HTTP通过，旧lab2页/APK/说明/校验URL404、Smart Switch lab4/ChinaTech0.3/Windows ZIP代表原hash保持，中文桌面及意大利语375px网页截图已看。未追加发布提交；冻结公开MINIMAL-PATCH/ENTRY-VERIFICATION原内容保留。正式记录.local/mimover-original-only/published-verification.json；交付/MiMover原版入口解限-20261009。没有业务DB写入。本轮主助手按ctmi3-original名称精确停止5600，并核对工作目录后停止自己的3228，端口无监听；清理证据web-shutdown.json/runtime-shutdown.json已追加正式记录，其他服务未动。

## 历史已撤回：Mi Mover lab2跨品牌传输（2026-10-09，超出用户范围）

用户明确要求完善跨品牌传输并上架，授权本通道公开发布。android/mimover-universal复用冻结自主0.4源码，保留Mi Mover实际原首页/来源/连接/勾选/进度/完成布局，公开API、TLS pin、双方确认、SAF/持久回执和合法FINISH；媒体/VCF/普通ICS/base+split系统确认恢复，私库/登录/聊天/短信/通话不支持。新/旧无品牌白名单，Android8+两端同lab2；不与官方或其他通道混配。

最终APK 4.5.7.5-ct-lab2(45707)、com.miui.huanji.chinatech、min26/target35、37764668B、SHA4607f469cd156d19a0d24e19608302ece2abe8bab4cc464e037d3a6e845dab9b，cert同lab1 1b71b70b…efc75；v2/v3/ZIP16KB/6原ARM64 ELF16KB、2930原payload原字节、583自主类/无stub、201三语通过。修复真实资源加载、勾选拒绝回滚、分页重建previous栈、44dp单返回/系统insets、原装饰遮盖进度、receiver SAVED投影与本轮恢复统计绑定。源码实际73项，自主源码ZIP不含OEM源码/基线APK/私钥。

独立19组去重3160断言；其中最终精确4607包5组80断言（23勾选/分页、20原进度、11完成绑定+QR、实际sender9+receiver17）。两独立Android16/API36 ARM64 AVD，3合成对象2162690B通过真实网络/TLS、实际SAF字节/SHA与双方FINISH。未变SQLite/投影/故障/provider/安装代码证据复用，未冒全为最终APK实跑；500ms故障宽限/AVD权限/合成provider边界详tests/verification.json。LOHS授权后SYSTEM_2失败，不算热点成功；同WiFi传输/手动回退通过，有效热点IP、自动加入/光学扫码、实体OPPO/Motorola/Samsung等、旧API/其他ABI、真实进程死亡/锁屏未验。5590/5592已按ctmi2名称精确停止。

发布worktree .local/smartswitch-web-release/mimover-web-source，PR40已attach。1009049ea644855cf494cfc75523afa23c40bb34已正常merge当前origin/main a9572de63a87b33f5869f25df1bedfd109ca16b6，93限定路径/697无关blob/25旧工具资产保留。3627三语/TS/lint0错1旧warn/3下载门禁/正式Webpack构建与28双浏览器三语四宽、完整APK/Range/无JS键盘下载通过；旧3227缓存导致5失败已保留，核对归属重启后原断言28过。最终预览dpl_2Beu3Ks3KRGyQyQH6YKofvbEGPBW READY，Vercel认证HTML/部署ID/完整37.8MB下载SHA一致，原lab4保留。

正式入口：https://www.chinatech.in/toolbox/transfer#mimover-universal 。main正常快进1009049ea644855cf494cfc75523afa23c40bb34／PR40 MERGED，93限定路径、697无关blob及25旧工具资产保持。精确两次完整CI37928959933与37928966550 success：420业务零skip、318双浏览器、3627三语、TS/lint0错1旧warn/正式build。production dpl_H5mQziPwSg8ELUWmVy2TFTp1eTBL READY，两域alias及HTML部署ID一致；正式28三语四宽双浏览器、完整下载/SHA/Range/无JS原生键盘与14两域HTTP通过，代表中桌面/意手机图已看，原Smart Switch lab4与ChinaTech0.3实际下载原字节保留。自用5590/5592已精确停止，3227也已按工作目录精确停止并核实端口无监听；没有正式业务写入。此前缓存旧预览5失败、最初无JS点击2失败与旧PR零售WebKit1失败均保留，未放宽断言。网站和模拟器通过不证明品牌真机，LOHS本轮SYSTEM_2限制继续有效。

交付/MiMover通用传输-lab2-20261009：冻结APK、73项自主源码ZIP、三语README、签名/运行验证与校验清单；发布前快照与发布后记录分开。详细docs/mimover-universal-compatibility.md；完整发布证明.local/mimover-universal-next/published-verification.json。

## 本地完成：ChinaTech 助手0.4接收提速与自动恢复（2026-10-09，未发布）

用户截图0.3“已落盘校验3606/5955”后明确去掉校验步骤。0.4正常WRITE和新图库复制取消目标整文件重读，保留流式SHA/长度、关闭成功、逐文件持久回执与TLS/最终清单；已有文件SKIP/导入中断恢复仍核验。64项SQL/准备/scratch事务、按时心跳、合并回执、TCP_NODELAY与250ms进度；回环中位default5/noDelay6ms不代表真机提速比例。

一次选择/授权后，新机完成合法FINISH接续媒体库（照片/视频/音乐）、本地通讯录、指定可写日历非重复ICS、base+split APP队列；已有APP跳过、Android安装确认保留。原文件/编辑副本保留；记录级去重、provider原子标记、partial持久、安装session/token/CAS与旧队列门禁、关闭未解不重开。私库/登录/聊天/短信/通话/工作空间/完整重复日历未实现。此前0.3已收资料可选原目录点击恢复。先停止当前传输，再两端覆盖安装，不卸载。

严格SDK构建/签名/对齐、247 JVM断言、175原生三语键/变量及网站3759词条静态通过；本轮独立5586/5588双ARM64 Android16真实传输/回执、ContactsProvider/CalendarProvider/MediaStore、系统VCF2.1含头像导出再导入、系统确认后base+split安装/取消/旧回调拒绝、三语真实对话框点击通过。10017项/20368 SQLite断言独立通过；详细逐项结果与总计见.local/android-assistant-v4/verification.json。初轮关键通知节流丢失/测试writer权限/测试重复fixture和Activity复用及按钮匹配失败保留，定向修复后原断言复验；无HONOR等实体手机速度/兼容证明。

交付/安卓手机助手-0.4.0-alpha-20261009/（APK、74项源码ZIP、三语说明与校验清单），同包名/cert、versionCode4、DB路径保留；构建默认v4，旧v3脚本防覆盖。本轮5586/5588已精确停止。未修改网站下载、Git提交/部署/后台数据；冻结0.3公开APK原SHA0326b05a…0da2保持。详细docs/android-assistant-v4-restoration.md、docs04/16。Smart Switch原版UI任务及所有旧交付保护。

## 已上线：Smart Switch lab4保留原版界面（2026-10-09，荣耀真机待验）

用户纠正lab3默认自有UI；lab4恢复原Launcher／欢迎权限／首页／来源与连接选择，实际原布局7无线阶段绑定自主CTSS5/6真实目录勾选、源确认与持久回执。不发空MainDataModel成功事件，不伪造三星特权；1356资源及JNI等1381payload逐字节保留，12 ARM64原库ELF16KB对齐静态通过（非实机16KB证明）。

冻结两APK各42761166B/code377304135/name3.7.73.4-lab4；并存SHA6115198b29ec3b67be59459ffca86a47f9804ef49b8e2baabbf2a5dbcc635a20／原包名9f68089caf3c694beeefcf200348727892307a4d167db48e6eab7e2bf5c72ce0，沿用lab1/2/3实验cert。精确两版本各自双Android16/ARM64模拟器4选3/2162690B传输源8+收17通过；并存版通知／真实BACK取消9、冻结选择恢复／篡改拒绝／最终回执46通过。未改子系统原布局15／DB5／系统热点QR3复用。原界面实际截图已看。暂无自动热点加入／光学QR／HONOR BKQ-N49等实体品牌／旧API／ARM32运行验收；APP归档不等于安装，私库／登录／聊天未实现。两实验版provider相同，每部只选一个；并存版可与未修改官方包共存。原包名补验首次安装与并存包冲突、dumpsys格式断言错误及旧目标误运行均保留，不作成功证据；移除专用AVD并存包、系统pm清单核对标准target后实际复验通过。

交付/SmartSwitch原版界面-lab4-20261009：两APK、50项第一方源码ZIP、三语说明、验证／SHA及原界面截图；无私钥／完整OEM源码／测试APK。源码android/smart-switch-original-ui／scripts/smart-switch-original-ui，详docs/smart-switch-original-ui.md。main正常FF a9572de63a87b33f5869f25df1bedfd109ca16b6／PR39 MERGED，65限定路径、639其他blob及11旧下载资产保持；独立ChinaTech0.3公开下载不变，根MiMover／自主0.4等并行工作保护。

精确SHA完整CI37920628659 success：417业务零skip、290 Linux双浏览器21.2m、3614三语、TS／lint0错1旧warn／正式build。Vercel dpl_333WFBywbDL5NuGNE3KSFTm9wpeG READY/production/main、apex/www alias与HTML标识一致；正式30三语四宽双浏览器、2无JS原生点击全文SHA、20两域HTTP／Range／README／旧APK通过，代表图已看。根3785键静态通过（含并行未发布词条，不冒称正式全量）。本轮自己3214和5580/5582已精确停，无生产业务写入。初轮README漏最终SHA导致2下载测试失败，补说明后保留原断言复验，日志保留；公开VERIFICATION-lab4为发布前不可变快照，后续原包名及正式证据以.local/smart-switch-original-ui/published-verification.json为准。入口 https://www.chinatech.in/toolbox/transfer#smart-switch-experiment 。

## 已上线：ChinaTech通用安卓助手0.3（2026-10-09，品牌真机待验）

本轮用户要求完善自主助手，几乎所有APK安卓双向迁移；复核7既有OEM样本(5家族)及LocalSend/Syncthing公开协议，不复制闭源实现。自有lab3连接接回独立包：公开热点QR/Camera2实时扫码、系统手动热点/同Wi-Fi、真实Network/网关、TLS pin/双方确认/最终回执恢复；系统完整VCF多卡字段/头像与部分回退、独立图库导入账本/安全恢复、权限弹窗恢复与逐块读取许可、批量/单项勾选数据库一致性。无总10000项/批准2h上限；5次自动重试，未完成对象从头。

冻结APK0.3.0-alpha(3)418495B/SHA0326b05ad69263ef5ca787de4b7658180f3fdf9af7dbf36b03456f6afa420da2，同0.2候选certbb8969df…329、DB路径保留；旧所有下载原字节保护。204 JVM、216 Android16双ARM64模拟器(实际LOHS QR、3文件2162690B/SAF、TLS、完成回执故障恢复、相机帧、角色/重建/勾选、MediaStore/ContactsProvider)、161原生三语通过；精确APK两AVD安装记录。网络传输走现有Wi-Fi，自动热点加入/光学扫码/HONOR BKQ-N49和其他品牌/旧API/多ABI真机未验。Gallery恢复为阶段注入/撤权为Context策略/等待缩时500ms；不宣称实机真撤权/进程死亡。APP仅归档未安装、私库/聊天/登录/短信通话/完整系统恢复未实现，无块级续传。详docs/android-assistant-v3-research.md与交付/安卓手机助手-0.3.0-alpha-20261009；证据.local/android-assistant-v3/。正式main52d47cb624db4fbb6789ecee2d8fc5b73b4cfa1b／PR37 MERGED，基于最新5c2ea59正常FF、80限定路径/568其他blob保留；完整CI37864254780 success（417业务零skip、290 Linux双浏览器14.8m、3601三语、TS/lint0错1旧warning/正式build）。production dpl_Hot8xtJvjeHLpA9GHKkf6sHKmKzR READY/main，两域alias和HTML部署标识相同；正式30三语四宽双浏览器+2无JS原生点击下载、8两域HTTP/全文SHA/说明原字节/Range206通过，代表截图已看。交付源码ZIP73项无私钥/闭源OEM源/测试APK，目标APK无测试组件，无业务数据写入。入口 https://www.chinatech.in/toolbox/transfer#chinatech-assistant 。证据.local/android-assistant-v3/published-verification.json；本轮3213/两专用AVD均已精确停止。无JS初始自动稳定等待失败保留，改为原生滚轮/未遮挡按钮原生点击通过，未改产品或放宽下载断言。网站/模拟器证据不替代HONOR及全品牌真机。

## 已上线：公开导航工具箱与菜单内退出（2026-10-09）

按用户要求，所有公开页右上显示“工具箱”图标及三语文字，左侧具名账号／工作台保留，退出只在账号详情内。手机语言独立第二行，桌面显式grid固定工具箱，未验证账号长文案换行并保留账号触发器60px／44px。复用PublicHeader、AccountMenu／LogoutButton及既有token，认证／权限／业务数据协议未改。

main5c2ea59e5b09e9ea1b1bdbab07ac2c3661289862／PR36 MERGED，基于695f6c6正常FF，仅14限定路径（3界面、7测试、4文档），根其他未上线工作保护。精确SHA CI37860235875 success：417业务、290 Linux双浏览器（20.8m）、3590三语键、TS／lint／生产build通过；lint仅1既有warning。本地16菜单／状态、6工具页、零售WebKit点击5／5及正式build通过。

Vercel dpl_AmNR4A1kM6GhwsXzMVWfBTb7Q6cD READY/production/main，两域指向同SHA。正式11HTTP／120三语四宽双浏览器布局、输入校验／密码显隐与导航通过，0实际JS异常。现有Chrome真实账号具名资料匹配、工作台／设置／设备入口、菜单内退出唯一且外部为0、工具箱实际导航／当前页标记／品牌返回／刷新仍登录全部通过；未记录个人值，未退出或撤销真实设备，0生产业务写入。实体iPhone未测；本轮未重跑真实数据库退出矩阵，后端源码未改。本轮3213服务已停。证据.local/public-header-menu/published-verification.json，规范docs06／16，进度docs04。

旧fd6ccc2两次完整CI布局失败和一次零售WebKit点击失败、trace及本地并行共用产物目录ENOENT保留。最终显式grid修布局；零售仅测试增加instant定位＋两稳定帧后原生单击，原断言保留，无force／重试，产品零售源码未改。

## 已上线：Smart Switch 内通用连接 lab3（2026-10-08，荣耀真机待验）

用户报告lab2仍转圈，要求在三星APK内修改并研究其他OEM。新增自有桥模块 `android/smart-switch-bridge/`：默认收发入口、新机公开热点／手动系统热点／同一Wi-Fi、内置Camera2扫码、CTSS3/4、实际Network路由、严格TLS pin与双方确认、SAF保存重读校验及最终回执恢复；不依赖原本机P2P MAC。原生TLS的DIGEST_NONE与停止时Pairing双读NPE已实际复现修复。无10000总项／批准后2小时上限；5次自动重连与操作超时保留。

两份冻结APK各42699726B：推荐并存com.sec.android.easyMover.chinatech／SHA38e2a513…6ea31，更新本站lab1/2原包名／SHA9714e257…e62b，同实验cert22e7f48e…67dab。未经修改的公开镜像Samsung样本与并存包实际不同签名安装共存；DN写Samsung，第一方来源／官方pin未独立确认；新两版可互传，不与原三星／其他OEM／ChinaTech0.2混协议。5家OEM代表APK研究仅借鉴公开API，不发布其代码。交付 `交付/SmartSwitch通用连接-lab3-20261008/`，含自主源码ZIP，无私钥／完整三星反编译源码。

Android16双ARM64模拟器：严格TLS2、跨包名3对象2162690B／34、最终回执故障恢复50（结束期缩时）、Camera2实际YUV帧14、标准与并存启动各17通过；LOHS系统返回SYSTEM_2失败，不能算热点成功。JVM／桌面TCP86通过。HONOR Magic8 Pro/BKQ-N49/MagicOS11无USB日志、现场SDK未知，lab3真机热点／光学扫码／全品牌恢复均未验。仅授权媒体／文件、基础VCF／ICS及原字段、APP base+split归档；不获得系统特权或私库／登录／聊天／短信通话等全量恢复。详规 [兼容报告](docs/smart-switch-compatibility.md)。

正式main695f6c612b09aaa496f982d66fd71534e6593659／PR35 MERGED；同SHA两完整CI37821567640与37821574208成功：417unit零skip、290 Linux双浏览器、3590三语、TS／lint0错1旧warn／正式build。production dpl_Ha2r2oeatNwTnbWqLwWAq9Br3AGk READY／main，两域alias及HTML部署ID匹配；正式14HTTP＋30双浏览器三语四宽／双APK真实完整SHA＋Range、旧5文件原字节通过，代表截图已看。11限定路径（原9发布路径＋2夹具）／其他563blob保留；认证生产源码未改。早期截图尺寸、滚动重试、冻结／真实时钟测试失败保留并分别修复，未放宽断言。入口 https://www.chinatech.in/toolbox/transfer#smart-switch-experiment 。源／原生／预览／正式证据 .local/smartswitch-universal/published-verification.json；自己3211／3212及2AVD均停。HONOR真机、光学扫码和全部品牌恢复仍未验。

根8发布文件与2夹具精确同步，public.ts仅增加31行保留其他未上线词条；根3748键／严格TS通过，旧formal/dev生成类型冲突用官方typegen重生成，配置未改、备份保留。原生LOHS模拟器SYSTEM_2失败，不能算自动热点成功。详规兼容报告与交付README。





## 已上线：荣耀二维码等待与 lab2 连接回退（2026-10-08，真机待验）

用户现场 HONOR Magic8 Pro／BKQ-N49／MagicOS11：lab1接收QR持续加载；Android SDK未显示，无USB日志。常规Wireless QR依赖rf.i.q本机P2P MAC，cg.c对空串无截止；n0.i拒绝Android占位MAC，非三星失效仅更新name。普通附近设备授权不等于LOCAL_MAC_ADDRESS；AOSP匿名化是现场一致候选原因，未称日志确认唯一根因。另sf.d6只三星设置action／异常只日志是确定缺口。

lab2新增7个自主helper类，非三星Receiver／QR／前台／未连接／未成功15s后调用原ui.n完整MANUAL流程，暂停销毁／成功／状态／同View重入与旧代际保护；三星专用Intent及原flags保持，其他情况公开Wi-Fi设置，三语反馈。原MAC／权限／协议未放宽，Manifest仅versionCode377304130→377304131；不能称QR互通或完整迁移已修。未知系统菜单用两端ChinaTech，不能混协议。

交付41941787B／SHA69156181…df1ac8，同lab1 cert22e7f48e…67dab，v1/v2/v3／16KB对齐／24接口stub／76JVM检查通过；6894原类比较6890原样、2连接UI类改、2类4个默认false仅格式规范化；7新类无编译桩，12ARM64 ELF16KB全过。独立只读无阻断；指出三星flags后父修复并全重编译／重签，原lab1和ChinaTech0.2字节保留。

正式候选c5e60fd5399a2a489bccd6bacfc8b351da7ea274／PR34已attach，7路径／其他563blob保留；同SHA CI37777684864完整success（417unit／288Linux双浏览器21.3m／3559键／TS／lint0错1旧warning／正式build），旧草稿37777336193已取消。3559键／TS／lint0错1旧warning／416unit+1旧PowerShellskip／严格Webpack formal构建、本地28双浏览器三语四宽／无JS原生鼠标完整下载SHA+Range206通过；两图已看。独立预览dpl_8byFEd9cPKR1jf9FLasN8hFpYiPy READY，23读验及实际下载包签名／metadata通过。正式main正常快进c5e60fd／PR34 MERGED；production dpl_2T6R9FZFUfjdXspSVBZ9tWrFT3gb READY／main／两域alias及HTML部署ID一致。正式28双浏览器三语四宽／下载SHA与8HTTP含旧包保留、README原字节、Range206与apex308通过，意语375截图已看。入口 https://www.chinatech.in/toolbox/transfer#smart-switch-experiment 。自己3210已精确停止。

详规[兼容报告](docs/smart-switch-compatibility.md)、安卓规格第15节；证据.local/honor-qr-fix/（artifact／local／roundtrip／source／preview-review）。没有Android运行或客户资料迁移；全部品牌系列仅机制审查，真机不得冒称。重复PR CI37777728565为287过／1旧站恢复Chromium用例失败；该源码／用例未改，同case在成功完整CI与Mac3/3通过，Linux根因未确认，失败保留。未修改原断言或声称所有CI成功。实际发布证明published-verification.json。初次工具diff拼接、hook数8误算（实际7）、默认Turbopack隔离symlink不支持已修／改为原Webpack隔离流程，未放宽类型／字节／行为门禁。

## 已上线：工具箱数据传输与Smart Switch实验APK（2026-10-08）

用户要求网站提供实验APK，并直接确认有三星允许公开分发修改版许可；依据该人类声明发布，未独立审阅许可文件，不宣称三星官方更新。正式main a65df1c6f29a6e9f4905feddbd0f19f9c99dbde5、PR33 MERGED，17限定路径正常快进、其他552跟踪blob保留，未合入其他UI／目录／Office候选，无迁移／业务写入。

工具箱入口与主标题“数据传输”，Smart Switch3.7.73.4-lab1下载卡及中／意／英说明／SHA／实验签名限制；保留ChinaTech0.2下载与独立步骤／规划。复用既有PublicHeader／Brand／button／panel／token；手机锚点使用实际页头offset。入口 https://www.chinatech.in/toolbox/transfer#smart-switch-experiment 。APK41708257B／SHA7daa79ef…697de1，原交付字节不变，私钥及完整反编译源码未发布。

同SHA CI37761975084与37762190115均success：417单元／288 Linux双浏览器（21.2m）／3558三语／TS／lint0错1旧warning／正式build。production dpl_7nii34dzFkP15J9wRXayPiJNYn5V READY，两域alias与HTML部署ID匹配。独立保护预览完整下载SHA已验；本地与正式各28双浏览器三语四宽度／锚点／两个APK真实下载通过；正式7HTTP含全文SHA、README三语、SHA清单、Range206及apex308通过。生产手机意语／本地桌面中文图已查看，无JS原生鼠标点击下载及Range通过；本地14ms只是回环无节流条件，不是公网或手机性能。

初次页标题缺词条、类型检查撞到重构建生成文件、锚点页头遮挡均已定向修复／补验；无JS自动locator稳定等待失败，真实可见坐标的原生滚轮／鼠标输入下载通过，不改应用或放宽字节断言。Vercel runtime-log连接器报错，未声称平台全量日志干净；实际生产页面错误0、请求均通过。证据 .local/smartswitch-web-release/published-verification.json、source-manifest、local-verification、preview-proof、production-http及proof/production。自己3210已停止；CI watcher已完成，其他进程保留。

没有Android安装／两机资料迁移或跨品牌恢复验收，实验仅局部接收入口。后续仍须合成资料手机分层验证；网站上线不代表原生迁移完成。详规安卓助手第14节、docs04／06／16。

## 本地完成：UI 状态与操作闭环（2026-10-08，未上线）

三篇笔记已实际读取；公共按钮／候选／空态、后台loading手机菜单、错误／离线／404、照片／商品确认／保管／售后／采购的提交互斥、失败重试、成功清本次事实、只读客户入口及缺值／照片三语已修。原领域、provider、API、权限／版本／原请求恢复、签署／销售快照保留；无生产写入／迁移／发布。

隔离Node24：409业务通过／1原PowerShell跳过；264唯一双浏览器用例通过（全量首轮＋定向复验合并），48状态专项通过；3600键、TS、lint0错1原warning、preview及formal配置build通过。formal仅无效占位配置，无真实DB；其本地公开404三语四宽／HTTP404／回首页实测。Source指纹／逐项证据 .local/ui-state-audit/verification.json、source-manifest.json，规范docs33／06／16／04。初轮失败与测试夹具／热更新／产物目录问题保留；真机／相机／签名／物理打印及真实正式数据未验。根无Git，同期目录／Office改动保护；发布前按当前main与候选边界融合。本轮3185／3186已精确停止，其他服务保留。


## 已完成并上线：公开页具名账号菜单（2026-10-08）

用户要求首页显示当前账号、退出和工作台，点击账号展开详情／设置。本人canonical名称／真实当前主邮箱／有效门店与角色现已展示，复用账号设置与个人登录设备锚点；身份通知立即清个人资料，迟到旧响应／故障不恢复旧账号，公开状态查询仍不续期／不登记门店／不写Cookie。详见docs06/16/29/04。

正式main **82f9b4b881abc4d57cf4c00a023eef7f555e6464**、PR32 MERGED，正常FF保留最新Office main7f36421；19限定路径，根同期设备目录／安卓／Office工作保护，13个本轮拥有源码文件与发布候选一致，三语只加入7条。精确SHA CI **37704855734** completed/success：410单元零skip／260Linux双浏览器（16.0m）／3451三语键／TS／lint0错1旧warning／正式build；其他重复CI不作为本次完成证据。Vercel **dpl_G1f1fL3zqwDCvixXT1rFB7z9riZm** READY/production/main、apex/www均核验，预览READY的formal:false与正式formal:true分别验收。

本地定向13单元、16菜单／会话及58关联双浏览器、真实Auth十组和正式HTTPS十组通过；12次状态请求中位130ms／最大161ms仅为本地条件，实际window.error／未处理Promise零，WebKit原生取消2项另存。生产10HTTP／两浏览器96公共布局及格式校验、显隐通过。Chrome既有真实登录：首页与工具箱具名菜单／完整资料、设置导航和设备hash定位已实际点击验证，只记录布尔／路径，未存个人值；首页菜单已保留供看。实体iPhone、真实账号退出／撤销／外部绑定／密码修改未实测，没有生产维修／商品等业务写入。

证据 **.local/account-menu/published-verification.json**、source-manifest、ci-final、production-status/public/deployment、real-chrome、built-https/integration与截图，手机测试菜单已目视并展示。合成users/stores剩0，3181/3182/3183均停；原本地栈与其他任务服务保留。本轮完成。


## Smart Switch 接收入口实验版 lab1：本地制作完成（2026-10-08）

用户明确“开始反编译 制作”后，原样本3.7.73.4仅改MainActivity.h0普通启动双按钮选择；真实f1.Z、launch_mode20、权限／签名／服务及其他设备限制保留。DEX原布局替换偏移2450426的0a01→1211及SHA1／Adler32头，无其他字节变化；DEX035／7950628B不变。实际核对listener4=X/Sender、5=Y/Receiver及OSSelectionActivity路径，不冒称真实可达／恢复。

最终交付`交付/SmartSwitch接收入口实验版-20261008/`：APK41708257B，SHA7daa79ef…697de1，独立本地实验cert22e7f48e…67dab；三语README／VERIFICATION、SHA与自主补丁脚本ZIP，无三星完整源码／原包／私钥打包。v1/v2/v3签名、16KiB对齐／aapt2通过；1738原非签名payload只1DEX改变，资源／Manifest／5DEX全原字节；最终反汇编6894类仅MainUI一指令变，其他6893类与原一致。smali和原布局binary补丁分别独立只读审查通过。

源码CLI JCommander冲突、签名文件双读EOF已定向解决，重组试验规范化默认false的候选仅.local保留，最终不用其DEX。证据`.local/smart-switch-experiment/verification.json`及binary-patch-record／final-roundtrip／repack-record，规格[第13节](docs/android-phone-assistant.md)。同包名不同签名不能覆盖官方／预装版，建议未装原版的备用ARM手机；已异步问两机型号／OS／新机原版情况。本轮未安装／运行／真机迁移或发布，ChinaTech0.2包保持原字节；不是通用完整跨品牌版，下一步仅合成资料真机分层验证。

## 安卓手机助手：Smart Switch 实际拆包研究（2026-10-08，制作前）

用户要求尽可能仿照三星并研究取消机型限制。已实际读取Galaxy Store列示3.7.73.4（09-15），取得同版本公开APKPure镜像41683681B／SHA289eeeaa…1418e5，v1/v2/v3签名自洽，DN标Samsung；未取得第一方商店二进制或独立官方证书pin，不能冒称第一方来源。JADX1.5.6下载哈希与GitHub asset digest一致，项目内配置／缓存；6DEX批量12046Java但52错误／exit3，f1及MainActivity各一次simple定向exit0，输出不是可重建完整源码。

已定位制造商SAMSUNG判断、主界面模式／默认收发角色、助手包启用／安装条件、受保护设置向导入口及系统权限声明。独立静态复核确认：入口判断可研究修改，但声明≠授予、DN≠来源认证、可选三星库≠缺库必然不能安装，自签不能继承原密钥／系统身份。完整非三星接收、类目恢复、原生／服务条件未实测；研究阶段未修改／重签／安装／运行三星APK、未改0.2交付或发布；随后制作见上段。

可行路线及验收维护于[安卓助手第12节](docs/android-phone-assistant.md)：沿用自己的热点／协议，仿角色→扫描选择→连接→传输／恢复→核对，优先真机基础与图库／完整联系人日历，再APP系统安装、受限短信通话及逐APP官方迁移；保留无总数／批准时长限制与原件保护。研究可复核证据`.local/smart-switch-research/analysis/findings.json`、verification.json、receiver-gates.json及日志。规划项未当已实现，下一步仍先用合成资料两机验证。

## 安卓手机助手：0.2 扫描与持续传输开发验收（2026-10-08，网站下载已上线，真机未验）

最新用户要求已实施：新机热点／TLS接收、旧机扫描后分类／分页选择并以专属Wi-Fi Network发送；取消10000总文件／联系人及已批准会话2h上限。只保留首次未批准加入10min、单次操作超时／有界消息64KiB ACK。SQLite索引和稳定task/object回执，50行是页面窗口，全选覆盖页外；完成对象同任务／同目标目录重读后跳过，未完成从头传，跨进程重新扫码批准，无字节续传。详规[安卓手机助手第11节](docs/android-phone-assistant.md)。

MediaStore授权媒体＋SAF目录／手动文件，联系人基本VCF；非重复ICS＋全部投影原字段JSONL（含重复／例外／时区，未实现还原）；普通可见launcher APP扫描仅元数据，选中／批准后确定性base＋split ChinaTech ZIP，无安装或私库。缺权限／部分／扫描失败与空库区分，phone/tree扫描scope持久中断，原件保留、目标新建不覆盖、重读hash＋最终数量／字节／digest才成功。二维码仍系统照片／图库读取，无实时扫描；API26–28手动Wi-Fi，Harmony NEXT另客户端，品牌待实机。

独立初审2确定缺陷已修并经新独立定向复核：旧pending转持久scoped residual，不访问失权provider／假报删除，未知残留计数提示且不阻新建接收；scope begin/finish原子提交、phone清索引＋incomplete同事务、tree追加保留原中断。父核关键差异；审查后仅改打包证据门禁，APK逻辑不变。

最终交付`交付/安卓手机助手-0.2.0-alpha-20261008/`：APK389823B，SHA256 2b20bb31207cbcb82e2b84dbf614b655b12ad3cf9a0b6bc88d24288eaee689a4；源码ZIP50文件，README／VERIFICATION／SHA四项全匹配，签名沿用本地候选不作生产更新身份。SDK37编译／签名／对齐；168 JVM＋30桌面SQLite（10017项分页／全选／迁移回滚）、134原生三语；root417单测416通过／1旧PowerShell环境跳过、lint0错1旧warning、3705三语、隔离正式模式严格Webpack构建；最终双浏览器26项三语四宽度／新机热点权限／下载字节SHA通过，无JS SSR下载通过，截图已看。证据`.local/android-assistant-v2/verification.json`及native-proof／web-proof；旧0.1交付原字节保持，不能作新版证据。

原生开发阶段无Android模拟器／实体运行或客户资料操作；网站下载上线结果见最新发布段。下一步两部合成资料手机验热点／权限／KeyStore／SQLite和SAF实际保存、锁屏进程死恢复／系统导入／跨品牌，再发布；不能把JVM/hostSQL当Android证明。3208自己预览已停止。日志无真实客户资料，网站不接收内容／secret；外部相机／provider可能自行保存同步。

## 已完成并上线：登录状态闭环（2026-10-07）

用户选择已登录仍保留公开首页。首页全部行动入口与工具箱同源，显示工作台/账号状态、账号设置、退出；登录/注册有效会话分流，待授权核验项目撤销/过期并重查授权，服务故障单独重试。最小GET /api/auth/status显式JWT+live_user/member_access，无Cookie、业务快照、门店访问登记或轮询续期；过期hint409仅让人重核整页。跨标签提示、前台/后退重查、epoch防迟到，工具箱子路由不恢复旧initial。手机44px、三语与动态公共栏锚点；OAuth/绑定/恢复原入口保持。详见docs29/06/16/04。

正式main **49c0d5f98fa79aff9465d9ded7e61ff5a2f2fe90**，PR30 MERGED，37限定路径，旧main887c1e6的其他源码保留，根未发布Office等改动保护。同SHA CI37682861546 success：401单测/252 Linux双浏览器(13.4m)/3401三语键/类型/lint0错1旧warning/正式build；其他同SHA重复CI不冒称完成。Vercel **dpl_H8PRerP3CzUzf8Xkbpgy81t3q1TS** READY/production/main及apex/www已核验。受保护预览READY，只读匿名status200/formal:false，不冒充正式认证。

真实隔离Auth/DB10组及正式构建本地HTTPS两浏览器，覆盖老板/员工/无成员/未验证、成员/账号停用、撤销、31天闲置、只读不续期、不登记门店访问、409无Cookie、首页/工具箱/分流/退出后退/跨标签/503/持久布局/无JS SSR、三语四宽度通过。实际window.error/未处理Promise0；WebKit原生网络取消报告另存，不冒称网络零取消。HTTP正式构建下WebKit拒绝Secure Cookie的失败保留，HTTPS复验通过，未降低产品安全。生产10HTTP/两浏览器96公共布局检查/非法格式就地校验和密码显隐通过；用户Chrome既有真实会话：首页三入口正确、login/register均回dashboard、工具箱同源。未退出/撤销真实设备，未写维修/商品业务，未测实体iPhone/真实外部OAuth或SMS。

证据.local/auth-loop/published-verification.json、ci-final.json/log、production-deployment/public、integration.json、source-manifest及截图，截图已看。合成users/stores剩0，3173/3174/3175均停；原用户页面保留，并留真实已登录首页供查看。

## 共享设备品牌型号目录：发布候选（2026-10-13）

用户指定当前网站账号为唯一全站目录维护者。正式后台已确认唯一活跃店主与现有Office管理账号一致，并完成绑定。首次目录3476条／33品牌／221官方来源，手机1220、平板208、笔记本1493、台式机431、主机62、其他62；来源和三语缺漏见data/device-catalog与docs/32，未声称全球所有型号或真实销量。

共享选择器已接商品新建／编辑、维修接机；后台单项／Excel导入先预览再整批应用、历史／逆向预览、门店会话＋唯一目录管理员RLS、版本／幂等。旧商品与销售快照不回写。独立审查发现Excel ZIP计数绕过，已修复并加篡改反例；站点导入器实际解析交付Excel3476行／0错误。完整种子在项目本地Postgres一笔事务校验后回滚0留存，A13三硬件版本独立。基于main cc16e154融合候选：447单元中446通过／1原PowerShell环境跳过，strict TS、三语静态、lint0错误1旧警告、正式构建、真实本地Auth/API/RLS及双浏览器三语四宽度流程通过。原本地Realtime分区对合成写入有WARNING但事务和刷新读取成功；跨设备推送未验证。证据.local/device-catalog/。

正式迁移20261013095303已应用，独立私有表强制RLS；受控事务从空目录导入3476条、revision1，33品牌，A13三硬件版本分开，核验来源缺漏0、历史事件0且管理员与唯一有效店主／既有Office管理员匹配。该首批种子不可重复导入。当前PR先前SHA的完整CI 38396435437 success；最新手机端三语候选高度修正及永久浏览器回归已在本地Chromium／WebKit通过，仍待新SHA的CI、主干合并和双域名运行时核验。任何这一步之前不称网站已上线。Office等并行任务的未发布改动留在其原工作树，不带入本目录候选。

## 已上线：Office 助手0.2.0自动联网与最低版本（2026-10-10）

用户选择无需密钥/登录/验证码，启动联网自动入页；网站暂停新启动或提高minimum拒绝旧版，已开会话保持原expiry最长1h、已开始任务完成，旧Office总开关仍拒绝新任务。手动官网更新，0.1.1需一次人工升级。独立private HMAC v2 grants/jobs、原AES包/runner65061指纹和v1兼容；requestID重放不延长expiry，未知响应可恢复，10/min/安装ID限流。具体verified_version+ready由受信任管道写，runtime不可改，未来0.3不复用旧0.2放行。

隔离.local/office-admission/source基于main0ef3db8冻结d2f53bf，30限定路径/781其他blob保留；根按增量同步共享词条/脚本，初次错误覆盖已恢复且根429unit过/1skip。候选432unit过/1既有PS环境skip、3656键(根3827)/strictTS/lint0错1旧warn/正式build通过；实际PG SQL10+版本绑定5/HTTP7/正式HTTPS管理员42+公开卡24/WPF14/双架构协议80通过。WPF为合成回环授权，真实Auth/RLS/HTTP独立；无本轮Office执行/物理x64/新生产验收。

用户本轮“确认”明确授权30文件公开与上线。main已正常FF d2f53bf／PR42 MERGED；同SHA完整PR38051762272与push38051701755成功（433unit零skip、320双浏览器约22m、3656三语／TS／lint0错1旧warn／正式build）。生产两迁移实际版本20261010125844/20261010155012，SQL全SHA与冻结源相同；独立前后权限审查通过，旧Office全行指纹ed8c16…55f8c及4/3/3/6旧记录计数不变。候选production先stage验证，再GitHub预发布双EXE完整下载→切官网→两个实际浏览器按钮二次完整下载；ready+verified0.2由受信任精确UPDATE放行，真实管理员UI minimum0.2／暂停／恢复／刷新完成，当前开启min0.2/rev3。最终main production dpl_9wfCqD8gwFs6QQCtJ5bL8HiuSuy7 READY且两域相同，tag38065326528及main38066278657均success（各433unit零skip／320浏览器，main浏览器16.7m），四次同SHA完整CI均绿；Release已转稳定，最终三语README实际下载字节一致，双EXE字节未改。本轮发布完成。

测试Auth/accounts/grants/jobs/licenses/receipts精确清为0，原本地Officefalse/epoch90/rev87恢复，desktop min00/readyfalse/verifiedNULL；私有cookies/signkey/临时TLS key已清，仅停自己的3235/3248/3247服务，VM其他PS进程保留。正式public24布局/两按钮全文SHA、Native真实HTTPS无输入／重放原expiry／低版426／暂停403／旧v2包继续／恢复200通过。专用Windows ARM64原生+正式x64兼容层两个EXE从官方GitHub完整下载并自动连接正式官网，无密钥控件，未点Office操作；启动前后两记录均不存在，保持未创建，已有记录保护另有本地合成测试；旧0.1.1锁定空闲窗口经全SHA复核后正常关闭，自己的新窗口也正常关闭；不代表实体x64。临时3247仅guest白名单传输已停。EXE仍未数字签名，0.1.1需一次人工下载更新，未重复Office安装/卸载/许可证验收。最终证据.local/office-public/published-verification.json、production-*.json、production-admin-control.jpg、vm-production-startup*.json/png及candidate/.local/office-public/ci-*-watch.log；规范docs/office-desktop-assistant.md。

## 本地候选：Office 助手0.1.2新解锁开关（2026-10-10）

用户确认暂停只拒绝新会话，旧会话可用至原到期/最长1h，已执行任务完成。21文件基于最新main0ef3db8冻结79836d0；独立private准入表/receipt与session事务锁、public no-store bool状态、指定管理员UI和WPF启动/锁定/解锁前GET检查，旧Officeepoch/license撤销保持。真实本地SQL10/HTTP8/双浏览器32/WPF11/协议HTTP56通过，正式build/TS/3637三语/lint0错1旧warn通过。源VM空闲无助手/安装器时只用独立目录做合成服务UI测试，原记录hash不变/其他PS进程未停；运行中clone失败，没有暂停原VM。0.1.2两EXE交付已备，未签名，未重复安装卸载。自动审批拒绝本轮源码公开推送，已向用户请求本轮21文件公开授权；生产未迁移或部署。详docs/office-desktop-assistant.md；证据.local/office-admission。

## 已完成并上线：Office 桌面助手 0.1.1（2026-10-08）

用户“上线”并随后明确“允许”公开本次源码。隔离36文件基于49c0d5f，仅快进main **7f3642112de417a8ded3f1d096d66365eda55d23**，PR31自动MERGED/已attach；518其余main文件、旧Office命令及未发布设备目录保护。完整同SHA PR CI **37701448779 success**：406单测/252Linux浏览器(14.9m)/3444三语键/TS/lint0错1旧warning/正式build。production **dpl_Cz8rWWszug5uVSFp3jjw5DZYk6Np READY**及apex/www/公开HTML部署ID核对。GitHub Release office-assistant-v0.1.1公开：两EXE+三语README+SHA+.NET许可声明；原0.1.1 EXE字节不变。

入口 https://www.chinatech.in/toolbox/office#office-desktop；指定管理员 https://www.chinatech.in/account/settings#office-desktop。两个实际网页按钮下载完整SHA分别fcd022df…b1e64fa4/4ea331a0…8c6f5b1f。生产24两浏览器三语四宽布局/校验展开/刷新0真实JS错、10HTTP拒绝/2下载、真实管理员UI生成key/停用/重开/刷新清明文通过。独立自用短期SQL fixture的Native HTTPS并发一200一403/同install幂等/加密65061e0a…cad/任务冲突409/未授权403/坏token错install401，真实UI停用后两403；重开新session200而原token401 SESSION_REVOKED，全通过且不执行Office。明确区分真实UI生成与Native自用fixture创建。

生产仅20261007183138新增4表单文件，remote20261007230949；FORCE RLS、公共role0、runtime敏感列UPDATE0。独立256bit production Sensitive签名不复用旧key，RAM/stdin不写明文。4测试授权均已停用（保留审计，无真实业务写入），全局Office enabled/epoch4/rev3不变；原始key/token无日志/截图，临时输入读即删，own3121/3183与Native控制器已停。runtime此部署最近1h error/fatal检索0组。未接触另任务独占Office-Test。

失败证据保留：第一Native harness stdin关闭；第二包距本地断言300003.832ms，比harness300000超4ms，按正式C#原有306000ms合同对齐测试，未改产品/EXE或放松AEAD/hash。另一同SHA push CI37701373968 251过/1既有WebKit input-states:219失败；trace点击中scroll移23px，已填/无字段错误，相关维修/输入/全局CSS/依赖未改。同case在成功PR CI通过；本地macOS WebKit仅此用例3/3过，不冒称Ubuntu复现确认。main重复CI37703537398最终success，与PR同SHA。证据release/published-verification.json、production-api/public/download-production、ci-final/duplicate-failed及ci-duplicate-proof。EXE仍未数字签名；实体x64完整流、真实V/P/许可资格、Windows客户端生产key再解锁未验（Native生产协议已验）。详细现状docs/office-desktop-assistant.md与vm-audit。

用户要求VM尽可能找错误，并明确允许仅专用VM使用Windows UI Automation。完成撤销/到期锁定、结果重开/脱敏导出、未知任务与损坏记录保留、写报告前任务归属核对、全程30s网络超时、取消Event持有/断线安全停止/准备边界、空库存单重装权限、完成后检测独立失败、未知产品指引、V/P保留校验、同账号管理员限制、确认/许可文案、按钮换行/工作区尺寸与Windows11名称。源桌面Client/Core/Native/Program与runner、三语messages；网站/DB/迁移未新增变动。最新规范及限制见docs/office-desktop-vm-audit-20261008.md；证据.local/office-desktop/audit-20261007/。

同项目Office-Test ARM64，开始快照c24e3bea-782a-4307-9a9c-c0ba89c3e611。实际取消下载后结束控制器仍CANCELLED、前后产品空；完整安装/重装INSTALLED_UNLICENSED exit0六应用/套件，卸载COMPLETED exit0清单空；已有配置激活曾报告licensed=true，不提供新key、不设置KMS，已有Windows自定义KMS标志且许可资格未核验，不能称正版授权验收。原三份真实Office样本+Desktop副本+仿真PST共五文件，整体重装/卸载SHA一致；COM SaveAs2失败和工具失败保留，未伪称编辑通过。旧版UI两错实复现；修复版13项实际WPF、TS5/C#51/PS29；Release x64/ARM64官方地址/固定65061e0a…指纹/架构/无DEV类核验，WinARM64中x64只作仿真启动，不是实体x64。

交付新版交付/Office桌面助手-20261008/（0.1.1＋三语README＋SHA）；原07/0.1.0保留。x64 fcd022df…b1e64fa4，ARM64 4ea331a0…8c6f5b1f。授权后台现已上线，生产协议闭环见上段；EXE未签名，真实V/P、UAC实际取消/换账号、后置检测异常注入和实体x64未验。不得把本轮独立桌面验证当网站全仓门禁。结束恢复开始快照、保留证据；仅停自己的3163只读传输服务，其他项目服务/文件不动。

### 首版实施记录（2026-10-07）

用户“开始实现”：完成独立Windows WPF x64/ARM64自包含EXE、在线密钥/期限/软件安装登记上限/允许动作、管理员账号页管理、AES-GCM固定指纹任务包、分阶段执行、三语错误建议/脱敏报告。交付 `交付/Office桌面助手-20261007/`（x64约64.9MB、ARM64约61.0MB＋三语说明和SHA256）。源desktop/office-assistant、lib/toolbox/office-desktop-*、新4表迁移20261007183138，仅本地应用，正式后台/迁移/签名密钥/页面未发布；EXE未数字签名，不能把候选当作正式服务可用。默认服务官方域名、Development=false；PE元数据核对排除测试类，DEV只在.local，不交付。设备上限是DPAPI安装标识登记，不是真实机器不可伪造绑定；最近100授权，无解绑/分页/自动更新/清理/回滚。

真实本地Supabase Auth/API/RLS8组、Chromium/WebKit三语4宽28项、TS5/C#21及Release元数据、PS20合成反例，实际ARM64窗口/诊断、DPAPI/pipe peer/工作进程无产品拒绝与保护标记通过；授权Windows端用合成响应，不能冒充生产全链路。专用Office-Test VM先保存本轮快照2f908b97…；首次六应用安装存在但无密钥被误判LICENSE_CHECK_FAILED，原失败证据保留。修正后从空Office快照完整ODT复验exit0、6应用、ProPlus2024Volume、licensed=false、INSTALLED_UNLICENSED；实际读取与LICENSE_REQUIRED在激活前拒绝通过，未设置第三方KMS/产品密钥。新执行器不删除文档、不杀安装器、不清注册表/Defender；MSI冲突与空间预检、系统模块固定、管理员ACL、全局锁/独占runner/未知结果unfinished保护，异常等待ODT结束。报告与媒体受保护保留。

本轮正式模式Next build、Office范围词条0问题及早期类型检查通过。最终根typecheck遇到.next-backend/dev与build的/toolbox路由类型冲突；不清共享缓存，按现有tsconfig冻结341个源码/引用文件到独立副本，官方next typegen重新生成路由后严格typecheck通过（proof/typecheck-source-manifest.json、typegen-isolated.log、typecheck-isolated.log）。当前同期工作继续改动，最新全仓词条有账号状态模块2项问题；此前全仓业务门禁失败（397中395过、1词条失败、1原WindowsParser跳过），lint0错2warning。保留同期改动，不为它放宽检查，不把独立副本或旧通过当新工作区门禁。细节docs/office-desktop-assistant.md及docs04/06/16；证据.local/office-desktop/proof。真实正版激活、实体x64、完整重装中断恢复和生产在线密钥尚未验。待正式授权后台发布后可生成真实使用密钥。本轮3162/3163服务已停；两个自建本地Auth账号及其授权/任务/回执精确清理、私有fixture/测试签名配置删除，局部迁移已登记；专用VM已恢复本轮安装前快照，实装证据保存，其他任务文件/服务保留。

## 进行中：Parallels Office四流程实测（2026-10-08）

用户仍要求四操作×CMD/PowerShell实装闭环后才推送部署。候选.local/parallels-office/candidate已本地提交a278cf8，并合入生产main49c0d5f成为f1f14da；未推送／部署。仅冲突public三语词条，双方词条均保留；账号状态、Windows入口和其他main源码保留。core生成默认四＋显式无Skype安装／重装两脚本，六摘要在tests/fixtures/office-script-digests.json；本轮core及启动器字节未再改。

重启误报候选：忽略空／无关／失效文件队列，不清注册表，保留CBS/WU及实际Office文件／目录移动检查。此前38条真实队列下双入口0、队列不变；48原生无害断言。TEMP校验后执行竞态已修为同一byte[]校验／严格UTF8解析／执行，19Windows无害回归与独立审查通过。不是48次安装或19次激活；源码相同时复用已有证据。

副本Office-Test-20261007 UUID4bff7828…；原VM保留、Mac共享关闭。2026-10-08人类“允许”明确对应独占副本、七组件不含Skype实测及必要s1.kms.cx客户端／产品／许可信息传输。恢复前状态保存b2b61749-2416-4956-9a10-daa683e837ee，已恢复已激活快照6286e0c0…；只读确认ProPlus／Skype许可均1、六主程序、LYNC仍缺。工具自动审批仍连续两次拒绝实际七组件CMD重装，第二次将本对话读取证据视为不可信。拒绝动作0次执行，不改用其他执行通道。已要求直接选择完整授权句，待答。默认网页八组件和LYNC必查保留；未接受微软OCT EULA。

本轮Word／Excel在SYSTEM保存失败，唯一文件名Word仍失败；原失败日志保留。改用实际登录用户及其本地AppData全新样本目录后，Word／Excel／PPT创建／保存／重读及SUM=3通过（proof/user-three-documents-20261008.log）；这是Office API证据，非GUI点击保存。六应用Microsoft签名、用户会话启动与响应通过（user-app-start-20261008.log）。OneDrive签名／安装存在，发现已配置账号，未新启动同步，账号连接／云同步未验。未因此修改产品部署脚本或删除旧样本。

三语教程12段及推广1段已更新旁白／章节／字幕／实际网页截图，演示明确不执行终端。固定配置、先准备媒体再卸载、Skype选择、重启与安装／许可分别反馈全部同步。13视频／78动作／QR解码通过，预览图及无Skype截图已看；实际双浏览器播放／字幕／章节／三语四宽等10项通过，Office选项／复制／下载另10项通过。合并后404Node过／1既有Windows-parser skip、3415三语键、类型、lint0错1旧warning、正式模式build通过。视频首次推广缺本项目QR源文件，复用同项目原始QR后修复、仅补跑推广；旧失败保留。证据proof/*20261008*及candidate/.local/office-videos/evidence/verification.json。

待闭环：无Office首次安装、已有Office完整重装、两终端实际卸载／激活矩阵、重启后应用／许可／样本及正式命令复测。Skype ARM仍未验证，不宣称微软全球不支持；OneDrive云功能与实体x64未验。GitHub CI未运行，未推送不冒称通过。执行状态详proof/resume-20261008-status.json及docs31。本轮3197、3198、3165已停止并实际连接拒绝核对；来宾本轮localhost3198转发已精确删除并复核，其他服务保留。当前用户样本／应用状态另存快照70b044bb-5b5d-4321-bb8a-a8128135d2d7；全部原快照／样本／原机保留。继续前重开本轮fixture，不用生产秘密；七组件重装与KMS必要信息传输仍等待工具接受直接完整授权句。

## Windows工具箱：执行驱动接入，检测入口已上线（2026-10-07）

最新继续（2026-10-08）：仅本任务空白Win10测试机EULA获用户“确认”并已实装／进入CTTest交互管理员桌面。x64 Win10Pro19045、UUID f5525a67-e970-4b3a-b0fc-7bc42556a9d8／140GB／4vCPU／6GB，原盘／故障overlay／Office-Test不动；无密码／凭据／安装状态伪改。当前Windows5.1 NativeSafety36及真实cmd0／7／3010通过，DPAPI强名GAC加载、准确SID任务解析／唯一登录trigger两补审已闭，原失败留档。实际8MB同字节Managed2910ms／CNG217ms同SHA；候选增加受核对GAC CNG＋一个完整读取句柄／1MB块到EOF（旧PS／现代.NET仍Create），五真实空／abc／部分尾／篡改向量过，独立复核闭；Mac8包／77核心／126工作流仅各自纯证据。官方7-Zip26.04已真实安装并压缩／读归档exit0；Before四文件含中文／三应用文件／HKCU／注册信息基线SHA4a4c3973固定，UTF8报告从原guest文件重新回传不重建。完整9,047,330,816B官方Win11ISO已guest实际SHA匹配bd4307df、签名与index6Professional/en-US/10.0.26300.9457核验，media-ready且Setup未执行。源经GUI正常重启后PendingReboot=false／source-ready零issues／原SID不变。随后正常关机、一致磁盘＋TPM＋OVMF回滚副本before-win11-upgrade保存，21,479,424,000B源／副本SHA da89bc33完全相同；尚未恢复启动验证，不标rollback通过。同VM重启QEMU22272。Win11新EULA当场确认问题已发出、真人回复待取得（工具accepted仅派发），不创建confirmed文件／私有执行包、不运行Setup。许可同意后编译VM/SID/媒体绑定的私有包，经原完整预检／Scan／升级／重启／After实际验证。Win11许可／Setup／升级重启／After保留仍未执行。未发布候选ZIP9e0df6fe仍inspection-only，线上preview.2检测不变；私有仅upgrade→verify，拒激活／转换，不伪造最后许可结果。仅自己的QEMU／VNC6089／HTTP8080运行，准确PID见runtime.json（QEMU22272／HTTP13924），本轮tab5已markHandoff。证据.local/windows-toolbox/vmtest/与upgrade-test-20261007/、docs31。

用户截图启动问题已处理并发布 preview.2：main887c1e6a46dd20c1f80ba97693f3e6c3df408739、PR29 merged已附；ZIP36f46fe8…48718B/7文件。纯ASCII/单次编码/直接Console三语，环境/身份、未全部解压缺脚本与损坏包分开反馈；hash/签名/SID保留，auto仍关闭。用户原ZIP hash正常，完整重下可检测，原解压脚本未核对，缺少全部解压是候选原因。最终ARM64 Office-Test当前用户18CMD、x64 CI37669576865（77/19纯检查+18CMD）成功；Mac8通过。精确同SHA CI37669576785成功392unit/244Linux双浏览器/3399键/TS/lint/build。生产dpl_FkS2iXnwTN4sfBB7mUG93Hb59ZtY READY/main/两域，新HTML/ZIP/7filehash一致；28实际生产双浏览器三语四宽度/无JS下载/刷新通过0JS错误，指定Windows实际生产ZIP下载hash一致，现有IAB已刷新显示preview.2，桌面截图已看。17Windows关联文件条件同步，其他Office源码/笔记保留；本轮guest临时目录已精确清理，原下载/Office/系统不动。本次启动器修复完成，完整自动升级及真实保留数据升级仍未开放；证据.local/windows-toolbox/launcher-fix/verification.json、docs31。

用户授权完整保留文件应用自动升级Win11Pro并部署。公开Windows页/三语ZIP/源码hash已实现，执行恢复驱动接入（固定同字节loader/UAC、实际DISM版本、媒体校验/严格保留scan、Admin/System工作ACL、DPAPI-HMAC检查点、同账号InteractiveToken任务、精确新boot核对）。当前inspection-only/compilefalse、无已验路线或公开媒体；没有真实Windows升级完成，Home／旧OS桥接／TPM CPU绕过及KMS中断Hook/IFEO/Defender恢复未验，不能宣称完整自动化完成。KMS原始不镜像，候选去Office写入，已有Office/授权配置停止，已有有效Pro保留。AveYo仍固定引用，原auto不等待真实结果，不能原样串联。

隔离release-candidate最新Office main f8ffa23基线，限定31路径，提交/main e4b266305244a9bfaa0c01307f76e6553ee9a0bb、已合并PR28已附本任务；不混入Office控制候选或私有媒体。392Node、3399键、TS、lint0错1旧warning、正式构建、36Windows28/Office8双浏览器通过，最终生产HTML/ZIP/6文件及清单哈希一致（ZIP771cbb9b…43176B）。77Mac launcher/126 workflow纯断言；实际WindowsPowerShell5.1 CI37645778000成功77/19纯断言，未运行NativeSafety或升级。独立专项确认公开闭门无阻断；修复第二resume未取锁仍删active任务及报告缺完整政策绑定。最终同SHA CI37648847235成功392unit/244Linux双浏览器/i18n/TS/lint/build；Windows原生解析37648847230成功77/19纯断言。Vercel dpl_H8qcRRydPunqcGAzxhbNYh3fqFPM READY/production/main/域名，线上28双浏览器三语四宽度/无JS/真实ZIP/6文件hash/工具箱往返/Office标题及最终HTML/清单一致通过，0 JS错误。旧base dff6 CI也成功，新main接入有3处并行冲突，语义追加Windows并保留Office。误用Node20的4失败及旧Node24合成builder挂起已保留，最终正确Node24规范392/392通过；仅结束已审查旧fixture子PID，未放松断言。

本轮官方en-US26H2 ISO SHA bd4307df…实际WIMindex6Pro/26300.9457。新空140GB盘+虚拟TPM/UEFI，Docker4GB/2GB均全局OOM，已改项目内官方SHA校验macOS QEMU与swtpm（不装全局）。本机新VM安装器先缺ProductKey停，答复文件补微软公开GVLK只用于新盘安装、不提供许可证；本机全新Win10安装进入OOBE后出现 Why did my PC restart 要求更新，未登录／无guest原生报告。该新装环境不能作为升级／权限证据。未启动用户原有暂停VM／未触碰其他服务。测试账号与磁盘只在.local/windows-toolbox/vmtest，不能上传／公开；任务结束需停本轮VM/测试服务/测试容器，保留可恢复盘。详见docs31；证据.local/windows-toolbox。完整升级仍未完成，继续Windows真实权限/保留/恢复验收才可开放。

阶段收口：当前公开检测与下载已上线；完整自动化目标未完成。新VM OOBE要求更新、没有NativeSafety／scan报告。回环3151/8080/6089、测试QEMU及本任务Ubuntu容器已停止，磁盘/NVRAM/TPM/日志保留，可恢复；未操作个人VM及其他服务。用户可靠x64 Windows资源问题仍待回复。只读官方复核发现旧source>=10 floor不是普遍技术限制：Win7/8/8.1→10 Setup ScanOnly有微软直接依据，floor当前仅代表未验边界，需要将来按已验路线和旧OS能力修正；多数8.1版不能无人值守桥接，详见docs31新增链接。不要靠伪造报告/原始AveYo DONE/修改EditionID开放auto。

## 已完成并上线：Office 命令整体开关（2026-10-07）

用户批准指定网站账号管理整体开关＋公开工具箱无需登录，允许复用已完成助手只读专项审查后继续上线。四脚本原字节移入server-assets，客户端只有联网启动器；独立256bit服务器HMAC绑定action/epoch/原始SHA，获取时实时查DB状态，失败关闭。账号设置服务端显式capability，真实会话/同源/身份header/版本/幂等及强制RLS再次检查；运行角色不能改管理员绑定。关开均递增版本，重开不恢复旧命令；旧静态命令、已下载/已开始操作不能召回。入口[Office](https://www.chinatech.in/toolbox/office)、[账号设置管理](https://www.chinatech.in/account/settings#office-toolbox)，当前开启version4/revision3。

最终main **f8ffa230cbd6fdde7545cd697e8b9803eb2b14ad**，PR27 merged，合并保留视频06ba753与最新登录设备167b766；45限定路径/458其他main文件、36媒体原字节保留，根Windows候选及其他改动保护。独立core/视频/共享就绪/登录融合权限补审均通过。最终同SHA CI37642982270 success：384unit、3371键、216 Linux双浏览器(12.5m)、类型/lint0错1旧warning、正式build。实际本地44API/7SQL/8会话（换SID旧确认409、撤销/30天闲置31天反例读写401）/48三语四宽度管理员与身份切换/18Office-video；24PowerShell AST、仅无害hash拒绝/exit0/7/TEMP清理、三语12操作采集均通过。根条件合并45路径，公共已开启意译复用Attivo，根389unit/1既有Windows parser未配置skip及类型/lint/i18n通过。

生产仅Office迁移（远端20261007133905对应本地20261007121342；禁止自动重放历史）、唯一已验证active管理员绑定与独立production Sensitive签名变量准备，明文临时文件删除。2表FORCE RLS、anon/authenticated授予0、runtime管理员列UPDATE0核验。Vercel **dpl_Fyq1u8buZ4ZtLce2RUFUAQUpWsLo** READY/production/main/两域及公共HTML部署ID匹配，apex308、匿名账号307登录。真实Chrome指定管理员UI已开→关→开确认保存；线上122HTTP包括24格式两轮源码原始SHA、关后403/重开旧410、新命令200、跨源/篡改拒绝、旧静态404/no-store；最终开启version4。管理卡片无个人信息截图proof/production-admin.jpg，管理员标签保持可见。未执行Windows/Office/KMS、未改业务记录、未发送消息。证据 `.local/office-control/published-verification.json` 与对应日志；3159/3160服务、本次2虚构账号及全部会话/收据/绑定、private fixture与生成token验证文件已清理，其他数据/服务不动。

两轮旧SHA完整CI失败证据保留：旧SW生命周期导航ERR_ABORTED未确认产品根因（原源码/断言保留，Mac原恢复12/12）；随后WebKit初始化前语言选择被保存偏好覆盖与登录重试22ms/29px点击位移。前者共享LanguageSwitcher复用useFormReady并新增冻结JS首选/刷新回归，后者仅测试解锁/instant居中/两帧/原click与POST2保留，54定向双浏览器和只读补审通过后完整CI成功。发布前main变更被祖先检查阻止，合并登录后重新通过同SHA门禁；GitHub一次push500在确认旧ref后非强制重试成功。未绕过门禁或修改断言掩盖失败。

## 已完成并上线：Office微信推广与三语操作视频（2026-10-07）

补充微信推广海报：`交付/Office工具箱微信推广-20261007/Office工具箱微信推广海报.png`，内置image_gen生成并原字节复制，1024×1536／1,592,086B；已目视核对中文、适用Windows／Office LTSC 2024及批量授权提示，成图二维码实际解码为`https://www.chinatech.in/toolbox/office`。提示词、逐项三语文案与SHA／二维码校验保留同目录；仅中文微信成图，未改网站／部署／执行Office／发送微信，微信App压缩后识别未验。

用户确认1中文竖屏推广＋4横屏教程、文件交付并同步网站三语。13成片（推广32.54秒／12三语69–84秒）使用自然女声／硬字幕／真实网页鼠标指引，Windows终端明确示意、不执行或虚构成功。Office独立目录复用TutorialLibrary的16:9／章节／重试／懒加载／语言清理与对应命令hash；手动改选、刷新、前后返回保持一致。原首页4:3／15媒体与Office全部命令字节保留，无业务／权限／API／依赖改动。

正式main **06ba7530af771788b761e46f9e6cab7fce74e029**，基于4d3a8ec2，56限定路径／413其他Git blob保留；根52源码／资产匹配，public三条词语和package测试仅追加、保留同期Windows文案／测试及登录测试。Vercel **dpl_2vMnGSLWJGqsWnCKPwbR37T4RyQG** READY/production/main/双域名及HTML部署一致。同SHA候选CI **37625170845** completed/success：366业务／212 Linux Chromium-WebKit（14.7m）／3298键／strict TS／lint0错1旧warning／正式build通过。main重复CI37627517886最后读取in_progress，复用同SHA成功门禁，不冒称重复完成；首次branch-filter读到其他历史结果，已按精确SHA核对并保留原记录。

媒体13全解码／H.264-AAC／固定24fps／faststart／非静音声轨／字幕／78鼠标步骤、原图／实际成片末帧／JPEG封面二维码均过；先前concat时间戳漂移已改CFR，二维码遮住鼠标层已调整层次，未放宽断言。最终Office10＋原命令／首页24本地双浏览器、最新正式16三语四宽度／12播放／字幕／章节／语言释放／503恢复／copy字节通过；复制用内存替身，不代表OS剪贴板验收。生产36媒体SHA／12原文本字节／Range206／两域匿名200及backend401通过。最终电脑／手机教程截图已查看；截图等待真实滚动位置，早先过渡截图保留，网站运行时未改。

微信交付 **交付/Office工具箱微信推广-20261007.zip**（15,320,533B）：5中文MP4／5封面／二维码／4VTT／文案／说明／校验清单，ZIP完整性及视频字节已核对；公开教程在/toolbox/office#office-tutorials。匿名Chromium最终单样本DCL329.3ms、切换5–10ms、脚本297934B、初始MP4=0，无JS错误，非性能保证。0Office执行／生产业务写入／微信发送，Windows实际安装／实体手机／微信App和真实弱网未验。

源码scripts/office-tutorials，证据.local/office-toolbox/candidate/.local/office-videos/{published-verification,source-manifest,ci-final,production-http,production-results,production-measure}.json及evidence/，规则／进度06／04同步。3147本轮预览已停，制作脚本及浏览器进程已结束；其他服务／数据库／未发布任务保留。本轮完成。

## 已完成并上线：Office 命令工具（2026-10-07）

已读取用户指定对话“解释安装脚本并禁用网站弹窗”，只复用获授权的命令／可读脚本。公开 `/toolbox/office` 提供安装、激活、卸载、完整重装及 CMD／PowerShell 两种格式，完整复制、纯文本下载、可读源码及三语提示。沿用 PublicHeader／Brand／LanguageSwitcher／button／segmented-control／token；仅工具箱私有布局，无新增后台／依赖。复制异常和迟到结果不假报成功。

三种独立操作改为唯一 TEMP 文件、固定上游 SHA256；安装取消网页弹窗、进程关闭限定 Office 路径；卸载失败不深清并恢复 Explorer；激活逐项核对 cscript 退出码与 ProPlus2024VL／LICENSED／GCVGB，7种合成授权文本反例通过；最终独立专项复核无新确认缺陷。完整重装保留原脚本 SHA256 f476281a…及配置预检。配置主／备接口本次只读返回403，Windows 安装／卸载／激活均未执行；公开 GVLK 不是个人密钥。

基于 main6725612 的隔离候选 `.local/office-toolbox/candidate`，24限定路径、399其他Git blob不变，保留根目录登录设备未发布任务。最终SHA `4d3a8ec2ed02d4346ddf8b3cd74bd703b4e57e9d`。本地364业务、8启动器＋4源码真实 PowerShell parser、3脚本变换语法、6 Chromium／WebKit复制／下载／字节／失败／迟到结果及48三语四宽度布局通过；电脑／手机截图已查看，3295键三语、strict TS、lint0错1旧warning、正式模式build通过。浏览器 Clipboard 使用替身，仅证明复制调用及状态；零 Office 执行／后台生产业务写入。首轮云CI37595032705为201/202（Office6/6），原商品WebKit检测checkbox点击失败；trace表明保存已完成但取点后28.5ms滚26px，无草稿重置证据，原生事件是否错失未确认。仅测试补保存UI／字段启用／instant居中与两帧稳定，保留原生check及状态／售价／历史／刷新断言，Mac双浏览器6次通过。原用例Mac5次通过；本地Linux代理原登录初始化未完成，2次hook超时后已停、临时容器已移除，不计产品结果。最终同SHA CI37598240463 completed/success：202 Linux双浏览器（13.8m）、3295键、strict TS、lint0错1旧warning、业务及正式build通过。正式main 4d3a8ec2ed02d4346ddf8b3cd74bd703b4e57e9d；Vercel dpl_7UUZmYjJdGSxuww4dyEQH1eeaJnA READY/production/main/双域名及HTML部署ID一致。线上6复制／下载／失败状态、48三语四宽度、4首页工具箱Office往返及17匿名HTTP（12文本raw SHA256、后台401、apex308）均通过，电脑／手机截图已查看。补验导航脚本先等实际首页和GET完成，保留原断言，原脚本两个导航冲突记录保留，网站源码未变。匿名Chromium单样本DCL342.4ms、加载464.9ms、25资源／398591B、切换两帧24.7ms，无弱网，非性能保证。main重复CI37600477199最后读取in_progress，复用同SHA成功门禁，不冒称重复完成。最终配置主／备GET仍403，0 Windows执行／生产业务写入。证据 .local/office-toolbox/published-verification.json、production-proof和日志。本轮3146预览、Linux49561/49562浏览器及49563代理均已停，临时容器已移除；其他服务保留，正式Office页已请求在本任务打开（queued）。本轮完成。详见 docs04／06；证据 `.local/office-toolbox/`。

## 已完成并上线：公开工具箱（2026-10-07）

首页顶部／页脚及无需登录`/toolbox`上线；四类Windows／Office安装、手机刷机、数据传输先标待添加，未放虚构工具／下载。共享PublicHeader／原token／三语与偏好，手机入口直接可见。正式main **60fdbc59e1c73d4bfde640aa3077acc4f6b123d0**，7源码／根6文件与25词条一致，392其他基线文件保留，其他登录／商品任务未混入。Vercel **dpl_FhxznGqBsHwRZYaRCHcGRo7boHMP** READY／production／main／双域名及HTML一致。CI **37541934653** 同SHAsuccess：353业务、184 Linux双浏览器（13.6m）、3184键三语、TS、lint0错1旧warning、正式build；main重复37543641808运行中，复用同SHA成功门禁。

正式站48双浏览器三语四宽度、匿名200／往返／锚点／语言刷新／44px／登录注册导航、0横溢和最终JS错误通过，匿名state401。WebKit渐变已改线性；首轮快速离开登录的预取网络诊断保留，脚本等待GET后原断言全过，运行时未改。正式匿名Chromium单样本DCL336.1ms、切换7.7ms，非性能保证。详见docs04／06；证据.local/toolbox/published-verification.json及production-proof。0生产业务写入，实体手机／弱网未测；本次3136已停，其他服务保留。

## 已完成并上线：商品少步骤闭环（2026-10-07）

用户批准实施并沿用推送上线授权。唯一商品档案、单页新建默认待检测／明确建档可售，检测与可售合并保存；同页客户、成交价、逐笔实收及实际交付，欠款明确授权；原三语打印／客户原销售回链／售后继续。复用retail.workflow事务、子权限／版本／设置／幂等，无迁移；自由原因原文、未知成本null、销售冻结事实。草稿恢复清核验与事实确认。宽屏三组并排、中宽两列、手机单列，16px／44px保留，三语商品教程同步。

基于工具箱main60fdbc5隔离发布 **672561217ed723f945d13fa6f469e1c185bb87d7**，46路径Git blob逐项一致／359其他blob保留，登录设备未发布改动完整保留。Vercel **dpl_FNY8X5dAkW9MjMNFZAvZdzpMWnWn** READY／production／main及双域名一致。相同SHA候选CI **37546513630** success：364业务／196 Linux Chromium-WebKit（10.6m）／3250三语键／strict TS／lint0错1旧warning／正式build全部通过；main自动重复CI37547878460最后读取in_progress，复用已通过同SHA门禁，不冒称重复完成。

本地正式13API＋4实际Chromium保存／刷新／恢复、根36双浏览器商品及最终10布局通过；合成门店／账号／故障触发器精确清理。三段新教程完整验证，12段其他教程哈希匹配且完整解码。两轮云CI原旧缓存用例195/196，根因未确认；原断言Mac12／官方Linux6未复现，仅追加测试上游路由就绪前置，原归档文件／3秒deadline／20秒URL／存储等保留，官方Linux1CPU双浏览器三轮30项及最终完整CI通过。

线上14匿名HTTP／9教程资产哈希与Range、两域部署、匿名state401／演示POST404；现有Chrome老板只读新建入口无下一步／商品详情销售入口／四宽度均无整体横溢与0 JS错误。自动审批拒绝正式选分类和打开售出表单，因可能保存设备或销售草稿，已停止，无绕过；完整表单保存仅本地正式环境验收。0生产业务／真实支付／消息／迁移写入，实体手机／相机／打印机／收款终端及真实弱网未测。3121本轮预览已停止，浏览器viewport恢复／核验tab关闭，独立Linux容器自动移除及840MB本轮缓存清理，其他服务／本地数据库／修改保留。

详见docs/30-retail-simplified-workflow.md及docs04／06／16。证据.local/retail-workflow-release/{published-verification,source-manifest,ci-final,production-deployment,production-http-verification,production-ui-verification}.json与.local/retail-density/workflow-api.json。本轮完成。

## 已完成并上线：保持登录与设备管理（2026-10-07）

默认不勾选；前台实际使用滚动30天，后台不续期。个人退出指定/当前/其他浏览器会话；老板只撤销本店访问，其他店/账号保留，重新登录恢复。四处复核缺口、审计PK竞争/未知结果幂等、重复form key及老板自撤销actor最后提交已修；不改既有业务事实/共享Auth配置。

main167b7668447950f3038ddddfd9df900a2116893b（基于最新Office06ba7530），46路径/442其他Git blob保留；Vercel dpl_7DwAxNvmSZrquPu3FcJZ3xsf3iNL READY/production/main/双域及HTML一致。最终候选CI37636374252及main重复37639686937均success：378业务、212 Linux双浏览器、3337键、TS/lint0错1旧warning/正式build通过。生产迁移20261007131534兼容安装→应用核验→管理员enable严格已执行，FORCE RLS/匿名零新授权/runtime不可enable/缺记录0/1账号1店保持。原CLI SQL不变、文件已对齐生产version，旧候选留release/original-cli-login-migration.sql。

17真实本地API+双浏览器、独立最小UUID老板自撤销200/版本各+1/receipt1/store403/account200通过，合成账号/门店精确清理0；正式36匿名双浏览器三语四宽、11HTTP、0JS、截图通过。严格开启后Chrome原登录实际个人设备20行/当前1/单一form/0alert，老板员工设备本店范围正常，未撤销真实设备。真实外部OAuth/短信、实体多设备/物理重启未验；持久重开与过期证据为本地新context及合成hint+真实refresh token。

3148本轮服务已停，其他服务/原用户页面保留，临时Chrome核验页已关闭。本轮完成。细节docs29/04；证据.local/login-devices-release/published-verification.json、source-manifest、ci-final-fixed、strict-verification、production-http、public-proof/截图、self-revoke-proof.fixed及integration-final.log。不能回退缺登记/门禁的旧版本绕过已撤销状态。

## 已完成并上线：商品详情高密度排版（2026-10-06）

紧凑摘要／多列资料／横向金额及核验，保修移到实物列，历史／原资料单按钮展开；手机原分组、草稿、16px输入和44px目标保留。Gallery／WarrantyPanel opt-in compact，自定义保修完整展开，原照片质量与业务／后台／权限不变，三语保完整词。

正式main **a36e7d7628f784a4666e19600c2049aa50d04421**，13冻结blob一致／382其他基线blob保留；Vercel **dpl_8GqT4NScRgHetzL3d42Z5o8t3Ky7** READY／production／main及两域名、HTML一致。发布前同SHA完整CI **37451900716** completed／success：353业务、184 Linux Chromium／WebKit（13.4m）、3159键、TS、lint0错1旧warning、正式build通过。main自动重复CI37453676193运行中，复用同SHA成功门禁，不冒称重复完成。

首轮CI37448049516为181/184，实际手机Avanzamento断词已修复；单次原WebKit折叠失败4次Linux未复现，保留原代码／断言，最终完整CI全部通过。20本地流程、6密度、2金融词、2全15集播放；修复后Mac2长词、官方Linux限1CPU6密度及原折叠1＋事件诊断3、最终正式build均过。三语retail第5／6步画面同步，47PCM／音轨不变，45媒体36,938,054B完整媒体和播放验收；生产三MP4哈希一致／Range206。

真实生产同一商品1440×900高度 **1518→846px（44.3%）**、摘要299→152px、页面高900；1024为1109px，375／390为815px，均无横溢，长资料／历史允许自然增高。生产Chrome四宽度、手机实际展开／收起单组及54px按钮、0JS错误已只读核对，匿名state401。0生产业务写入，3121／Docker／代理已停，浏览器viewport恢复／临时tab关闭；实体手机、物理打印／弱网未验。证据 **.local/retail-density/published-verification.json**、ci-final、production-http／ui、source-manifest与visual-failure及ui-proof/retail-density；截图及保存为合成资料。

## 已完成并上线：全站三语、排版与关联闭环（2026-10-06）

保留最新统一商品main2cc6c2a业务，修复手机标题竖排／状态中文残留、结构化故障／配件规格／缺值、动态系统反馈、图片及可访问名称、历史代码与金融长词；三语显示词可搜索。3159键、0已知静态缺漏／冲突。译文只作显示，canonical、客户自由原文与冻结签名／销售／政策快照不回写，API／权限／schema／事务不变，独立专项审查通过。后续三语与闭环强制AGENTS／06／16／28及CI门禁已提交。

正式main **039c0bf2edb46688371a7c002b071beca2c24525**，123路径／冻结blob一致、271其他基线blob保留；根117源码／资产匹配，6份项目规则／记忆保留同期修改。Vercel **dpl_BB8oM7PmxP1a3Lr35g5srGU8joZb** READY／production／main及chinatech.in、www别名／HTML一致。同SHA发布前CI **37401548200** completed／success：353业务与翻译、完整178 Linux Chromium／WebKit（13.2m）、strict TS、lint0错误1既有warning、check:i18n及正式build通过。main重复CI37402916548仍in_progress／未出结论，复用同SHA成功门禁，不冒称重复运行完成。

本地核心174全浏览器与23正式路径×3语×4宽度552布局（8ff7e69），后续金融断词五宽度2项／三语搜索2项／接机规格保存刷新2项、432有限规格组合及最终18播放回归均通过。隔离localhost正式账号／门店的11组保存刷新／冲突重试／客户采购历史回链／三语打印／只读待授权已实际操作，合成数据精确清理。最新生产公开8项双浏览器三语四宽度、账号草稿／显隐校验、全部15段播放／字幕／旧媒体清理通过；两域login200、匿名state401、45资产SHA及36,208,637字节一致、MP4 Range206。

教程87目标场景重拍、15集当前画面重渲，45资产完整解码／218字幕／90鼠标步骤通过，218原配音及讲稿复用，无新语音API。匿名Mac Chromium单样本DOMContentLoaded314ms、语言切换5–9ms、初始MP4为0／无JS错误；传输JS243,650→277,597字节（新增三语词汇），同12资源；单样本不能作为性能改善或保证。生产业务写入0；实际保存及角色仅本地正式fixture，实体手机、物理相机／打印与弱网未验。

证据 `.local/tutorials/release/.local/i18n-audit/published-verification.json`、release-source-manifest、ci-final／production-http／production-browser／production-measure、formal-proof／closure-proof及scripts/tutorials/.work/evidence/。本轮3124／3141及教程3123均已停止；本地Supabase、其他服务／源码／私有配置保留。本轮完成。

## 已完成并上线：在售商品与可视化详情合并（2026-10-06）

按用户纠正取消独立单机管理；原商品与新商品共用唯一列表及图形详情，本页核对→明确可售→销售／实际收款交付／客户回链／三语打印。原资料不可改写，原容量／识别码保持原文，未知事实不补造，旧客户定位原资料，列表和工作台仅按明确来源去重。严格门店／权限／版本／幂等事务retail.prepare，无schema／RLS迁移；必要独立专项审查完成。

最终main **2cc6c2a8f3ae1a514594162734c91d0991353a34**，基于85fce8b，28源码／测试Git blob一致、360其他blob保留；Vercel **dpl_3SRUauWSPZgG8RELSXhqTW46grC1** READY／production／main及chinatech.in、www别名一致。两域login200且HTML部署标识一致，匿名backend/state401。同SHA发布前CI **37394528634** completed／success：335业务、完整168 Linux Chromium／WebKit（12.5m）、strict TS、lint0错误1既有warning及正式build通过。main自动重复CI37395917038仍in_progress／未出结论，源码／配置与已成功同SHA一致，复用成功门禁，不声称重复运行成功。

12组隔离本地API及正式网页实际保存回读覆盖权限／跨店／伪造／冲突／并发／幂等／回滚／撤权／明确核对和可售；原JSON未变。相关双浏览器、最终原容量与旧客户回链、四宽度及截图已验收；新增容量断言首次误用region，纠正定位器保留业务断言，最终完整CI全过。正式Chrome只读核对唯一入口、81在售／48其他、直接图形详情及同页操作，1440／1024／390／375无横溢，手机实际点击只展开操作组。未提交任何生产业务写入；实体手机／弱网／物理打印机未测。

规格docs05／11，复用06／联动16及进度04同步。证据.local/retail-unified/published-verification.json、source-manifest、ci-final.json／log、production-http-verification、api-verification及.local/ui-proof/retail-unified。3121预览与3117正式本地服务已停，Chrome临时viewport已恢复；全站三语线程的根文档／修改保留。本轮完成。


## 已完成并上线：首页鼠标动画教程与整站三语（2026-10-06）

官网教程增加鼠标移动、目标轮廓、点击脉冲与局部放大；中文／意大利语／英语共享切换并记住偏好，教程画面、自然女声与字幕联动。15段视频／45资产共36,238,246字节，保留六章定位、VTT、失败重试与旧媒体释放，初始不请求MP4。canonical业务值、客户原文及签署／政策／销售快照保持；客户签署和打印语言独立选择，无API／schema／权限或生产业务写入。

最终main `85fce8b423b928c539402862dea2f897bbb2ed06`，基于商品正式649f0fa，冻结165文件／Git blob一致，根162源码／资产匹配，3份根规范保留其他修改。Vercel `dpl_2nirDHk43E1UX51RokTdwn3DvycT` READY／production／main及chinatech.in、www别名一致。同SHA发布门禁CI `37384789427` completed／success：327业务／翻译、完整162 Linux Chromium／WebKit（11.6m）、strict TS、lint0错误1既有warning及正式后台build通过。Mac完整162（ac266f1）及c2最终16项为此前验收。main自动重复CI37386423678当前in_progress／未出结论，与已完成候选同SHA、配置和测试环境，按规范复用成功结果，未冒称该重复运行成功。

最新生产6项双浏览器通过（35.8s）：三语四宽度、账号草稿／显隐／验证、全部15段实际播放与字幕、语言切换清理旧媒体。两域login200且HTML部署一致，匿名backend/state401；45资产全部SHA／字节一致，MP4 Range206。此前同首页源码c2的匿名Mac单样本DOMContentLoaded771ms、切换7–12ms、初始MP4请求0，无JS错误；不是性能保证。375 WebKit与1440 Chromium可见教程海报／鼠标目标截图已查看。

首次发布c2的候选CI327／162通过，main重复37381489687为159／162。独立trace核对：来源继续确认点击期间滚动28px；照片在身份加载时isVisible false跳过展开；现金选择点击期间滚动46px而未选中，后续正确拒绝缺收款方式。只把来源编辑与收退款表单自动定位改instant，照片测试等待gallery可见；此前售出表单instant及Safari语言选择器.module-select44px保留。原click与全部业务断言保留，Linux原3流程各重复5次／15项、双浏览器事件6项及现金专项1项通过；19组mouse down-up滚动／目标位移均0。最终完整CI及最新生产检查均通过，失败日志和合成trace保留。

证据 `.local/tutorials/release/.local/tutorials-v2/published-verification.json`、main-fix-source-manifest、ci-main-fix-final-result／log、production-final-deployment、production-final-http／browser.log、production-browser-result、main-ci-review、main-gesture-evidence、root-sync-main-fix与proof/；创作与合成帧scripts/tutorials/。实体手机／弱网／真实云保存未测，0生产业务写入。本轮3123预览已停，临时Linux容器自动移除，诊断测试移出测试目录保存；其他服务／修改保留。本轮完成。

## 最新完成并上线：商品档案、手机折叠与销售打印闭环（2026-10-05）

照片／售价／检测图形摘要、电脑双栏，手机单组折叠与草稿保留；已有客户明确带入联系方式，销售冻结本笔买家／实物／保修。登记→分次收款→实际交付→三语双联打印，客户按原saleId回链，复售仍打印原快照。买家备注可印，长期备注与成本利润不印，触摸关闭返回实际打印按钮。售后活动类型与RepairActivity穷尽对齐，保留来源／完成／日期／唯一性，独立审查通过。复用公共控件与原命令，无schema／API／权限变化。规格docs05／11，复用06、联动16及进度04同步。

最终main `649f0fafd0dfb0ba68a8ec394a2715aa98efc510`，基于维修版 `0fa8c86`。累计20代码／测试与冻结Git blob一致，其他308跟踪文件保留。Vercel `dpl_44nVqqT3tFPQb9RRZRM4k7ezCoDQ` READY／production／双域名及SHA一致；两域名login200、HTML部署ID一致，匿名backend/state401。

官方Playwright1.63.0 Linux arm64／Node24.20.0／1CPU独立完整检查通过：322业务、152 Chromium／WebKit（11.9m）、strict TS、lint0错误1既有warning、默认Turbopack正式后台build；另24项定向复核通过（2.3m）。本轮源代码与Linux被测20文件一致。

云端首轮CI `37361865766` 148／152，4项WebKit测试缺少加载等待／折叠操作；修正3测试文件，保留原业务断言，运行时未改。最终CI `37364428122` attempt1没有分配到hosted runner、0步骤，被取消；公开注释已保存。一次重试attempt2已完成并为success；2026-10-05本轮读取确认，不以旧in_progress记录替代当前证据。

正式Chrome只读验证单机全部记录0台、新建入口375宽正常无横溢；现有导入商品仍为原历史页面。详情、实际销售／收款／交付与打印业务以合成测试验收，0生产业务写入；实体手机、弱网和物理打印机未测。本地375单次预热内容872px／进入119ms／检测打开43ms，不作为线上性能保证。

证据 `.local/retail-mobile-closure/published-verification.json`、published-source-manifest.json、linux-full.log、linux-targeted.log、ci-first-failure.log、ci-runner-error.json、production-ui-verification.json／production-http-verification.json及相关合成截图。3121预览已停，Linux容器自动移除；候选依赖与构建缓存已清理。

## 已完成并上线：四个日常分组（2026-10-05）

按用户授权实现返修／处理中／等配件／等取机；实际下单／分次到货驱动移组，通知子筛选／历史与待收尾、独立返修新单及不可变来源、双向追溯／原实物关联、锁定历史新采购／项目与显式恢复均完成。旧设置只读规范，不造业务历史，客户／工作台同源；规格docs22／10／09、复用06、联动16及进度04同步。38个获授权代码／测试已发布，保护本地商品及随后新增的客户销售改动（customer-detail保留本轮维修投影）。

319业务、20组真实隔离本地API、68相关双浏览器／四宽度、strict TS、lint0错误1既有warning、正式后台build通过；关键来源／事务／采购门控独立审查完成。手机提示挡后续按钮已修复并回归。正式Chrome只读确认四组设置、3现有工单（处理2／取机1）、通知子计数／筛选、历史及阶段下单入口；四宽度1440／1024／390／375无整页横溢、主要按钮44px、菜单状态正常。login200部署标识匹配／匿名state401。0生产业务写入；实体iPhone／弱网／生产实际保存未测。

最终main **0fa8c86fe3b30df0d41e7e95c549ca39cacd1090**，38代码／测试与冻结Git blob一致，其他288跟踪路径保留。Vercel **dpl_J9S19zouZYJocjRYVcHntoU5YtN1** READY／production／两域名及SHA一致。完整CI **37326963799** attempt2 completed／success：319业务、138 Linux Chromium／WebKit（9.4m）、strict TS、lint及默认Turbopack正式build全部通过。首轮137／138，未改动的旧站纯fallback快跳转一次出现net::ERR_ABORTED；原断言与运行时均未调整，官方Playwright1.63 Linux arm64／1CPU重复6项通过后，同SHA完整复跑通过，不把首次失败当成功。

证据.local/repair-four-groups/source-manifest.json、local-verification.json、published-verification.json、production-ui-verification.json／production-http-verification.json、ci-first-failure.log／ci-first-artifact.zip与ci-final.log；截图及局部日志在release/.local/。本轮预览及正式本地服务已结束、临时Linux容器自动移除，其他root3121服务与原隔离后台连接保留；候选依赖／构建缓存清理后保留源码及合成验证证据。本轮任务完成。


## 已完成：维修阶段与分组统一（2026-10-05）

每个可选阶段对应同名九分组，保存成功后移组／展开／焦点、筛选跟随及作废可见、刷新和详情同步。旧11项配置补齐四阶段、保留已有相对顺序，维修分组名称随阶段固定／排序可调，配件名称／排序独立。旧跟进无已知修好周期归待确认、有周期或旧已通知归待取机，原状态／通知／交还不改写。到货通知和工作台配件跟进继续读取实际采购，不以分组推断；无schema／阶段写命令／权限／事务改动。规格docs10／09／22、复用06、联动16和进度04已同步，仅本地文档。

304业务、50相关Chromium／WebKit、四宽度1440／1024／390／375的实际交互和截图、strict TS、lint0错误1既有warning、默认Turbopack正式build通过；首轮6设置测试引用错误配件名称，定向修正后50通过，不放宽权限／版本／重复名称断言。截图和业务写入均本地合成，实体iPhone未测。

最终main **d9323c448fe1a69cf2e2ea2cd0228cef1c0a6438**，15代码／测试与冻结Git blob一致、其他305跟踪路径保留。Vercel **dpl_3ixPDRBCW7RE9ozTALHLFrC7cXmP** READY／production／两域名及SHA一致，login200／匿名backend state401。正式Chrome只读核对九名称与3现有工单阶段／分组一致，0生产业务写入或客户资料落盘。完整CI **37239545214** completed／success：304业务、134 Linux Chromium／WebKit（9.3m）、strict TS、lint0错误1既有warning、默认Turbopack正式build均通过。

首轮CI37238259463为133／134，仅新移组用例在Linux WebKit控件出现前跳过筛选；失败快照确认筛选仍关闭。补await可见并保留原断言，官方Playwright1.63.0／Node24.20.0／1CPU Linux 10项通过（58秒）后，仅测试文件补丁进入最终main，运行时代码保持。证据.local/repair-stage-groups/source-manifest.json、local-verification.json、published-verification.json、ci-final-result.json／ci-final-log.txt及release/.local/ui-proof/。3121与临时Linux容器已停，本轮候选依赖／构建缓存清理，源码和证据保留。当前任务完成。


## 已完成：旧站退役与云遗留清理（2026-10-04）

用户要求清理并上线干净版本。从最新main595c958隔离发布17文件、保留其他同期实现；正式main6c0c7ae831d9e431eedcca3e4669474772d06bf2／Vercel dpl_CQn6wg4yQ6gTiWw89m1zoVF1FyEG READY，远程main／冻结blob及两个别名一致。sw先claim后仅清repairdesk-shell／注销，新设备不注册，503失败保留壳／联网重试；两源sw／probe直接200/no-store，apex应用普通页308，旧3入口转login／其他旧资产404。当前新页面无强制reload/navigate，草稿／cookie／IDB／其他缓存与worker保留。

CI37234361775 completed/success：301 Node、130完整Linux Chromium/WebKit（8.2m）、strict TS、lint0错误1既有warning及默认Turbopack正式build全部通过。另本地130完整双浏览器／10正式构建清退／18Host路由／webpack build通过；57线上HTTP与10线上资源双浏览器清退成功，两端生产截图已查看。真实归档SW3秒回退／probe404→200纯旧页自动恢复、精确导航update并发、503online重试和活输入保持通过。初期端口／启动锁及本地依赖链接越根失败保留日志、已定向修正，不放宽断言；Vercel／CI原生默认构建均成功。实体手机／真实登录未测；仅2旧公共文件在测试fixture有意原样复用，不属于运行时旧站。

独立审查后精确删除78旧别名、566旧时期部署（515有旧源码＋51最晚9/20无完整源码证明）、88环境项／87未用名称。CLI两次限时先分页核实再续删；官方DELETE按200限额/reset暂停后完成。最终分页零目标遗漏，41新部署／6当前别名保留，原39新部署ID及18所需配置完整元数据不变。旧public133表／189函数、4私桶5对象／Auth trigger／所有本地备份保留；无业务删除或写入、无Secret值落盘／跨项目访问。

docs06/16/04/25和15源码本地同步保护其他修改；docs25按既有ignore保留私有报告。本轮3130/3131/3132均停止；证据.local/legacy-cleanup-20261004/的release-manifest／cleanup-verification／production-http-verification／ci-result.json及ci-job.log，线上浏览器结果在release/.local/ui-proof/legacy-cleanup/。本轮完成。

## 已上线：输入框全站状态统一（2026-10-04）

已统一默认／聚焦／错误／已填及清空、只读、禁用、提交锁定；InputControl／TextareaControl／control-feedback作为共同入口，42个使用文件、146处引用，保留业务校验、客户／型号联动、金额／规格与null／0语义。隐藏扫码和Safari显隐目标移动已修复。根／组件AGENTS、docs06／16维护声明和ESLint绕过限制同步，详细证据见docs04最新输入节。

用户明确“推送上线”后，从最新教程main5d362eba隔离发布46个源码／测试／规范文件，其他262跟踪路径保留。首批2381809；首轮CI117/118发现注册页初始化前填值在blur时被空草稿覆盖，4类公开账号表单复用useFormReady锁住初始化窗口，保留密码错误断言并新增延迟脚本反例，补验44双浏览器／TS／lint／正式build通过。

最终main **595c95846a24726ecb9ce3d207a3586e9ded68e2**，冻结内容、远程Git树／blob一致；CI **37232434099** completed／success，296业务、120完整Linux Chromium／WebKit、strict TS、lint0错误1既有warning及正式构建全部通过。Vercel **dpl_4mTt1Hz6mpMUuH3CXhKgZTqy7KWf** READY／production／两域名；官网8组双浏览器四宽度四态／清空／显隐与注册共享控件、8组公开账号页延迟加载／首次输入保留通过，login200／匿名state401／主域308，截图已查看。0生产业务写入；实体iPhone／第三方输入法和线上性能指标未测。证据.local/input-states/published-verification.json、release-manifest.json、ci-final.log、production-checks.json与production-proof/。本轮3121随测试停止，候选副本保留；本轮完成。

## 已完成：首页有声视频教程（2026-10-04）

用户选择中文配音＋中文字幕并要求小红书那种语音。已上线5集自然中文女声教程：注册登录、接机建单、工单跟进、采购分次到货、整机一机一档；采用真实正式界面与明确标记的虚构资料。首页#tutorials／首屏／页脚进入，分集、六章节、对应功能链接、画面字幕和VTT、加载／失败重试。点击才加载MP4，选集／离开释放旧媒体；复用按钮／token／Lucide／原生video，无运行时语音API、业务事实或权限改动。讲稿与复现scripts/tutorials/，规格docs01／复用docs06／进度docs04。

最终Node24的296业务、严格TS、lint0错误1既有warning、正式后台构建及完整96 Linux Chromium／WebKit CI通过；CI **37211665169** completed／success，构建与原断言保留。本地四宽度1440／1024／390／375、Mac8及Linux24；最后保护在限1CPU Linux12项与线上4项播放／字幕／章节／503重试／实际离开清理通过。5集64–71秒、MP4合计5,996,833字节，完整解码、AAC音轨、前置索引、字幕时长一致；线上15资产哈希／5集双浏览器播放／初始零MP4请求验证，媒体在后续清理补丁中不变。实体iPhone未测；无真实客户资料或生产业务写入。

首批26文件e63ddf6，随后保留同期retail排序main74eeeb5，只改媒体清理及测试。前两轮CI91/92、94/96：真实诊断src=null／networkState0／paused，Strict开发回放误清首播；稳定ref单独不足，最终microtask确认旧元素未被重新绑定才释放，源保持／播放／重试／离开断言不放宽。最新正式main **5d362eba5d86d58cc0b7ea3ce6187ea12247d04d**，最终单文件保护保留其他304跟踪文件；冻结源码与Git blob一致，未夹带根目录其他未发布更改。Vercel **dpl_FYuBc1sTs2eRY3rKLPYjJdUqhaJW** READY／production／两域名，官网HTML部署ID一致、匿名state401。证据.local/tutorials/published-verification.json、release-manifest.json、ci-success.log、production-rebind-guard.log及原失败trace；截图.local/ui-proof/home-tutorials/。本轮3121／3123与临时Linux容器均已停止，隔离副本／合成证据保留；本轮完成。

## 已完成：商品排序与简化标注（2026-10-04）

在售默认名称A–Z，已售按售卖时间倒序；新系统用销售登记时间，旧历史用已有拿走日期，未知末尾。列表移除重复分类／内部编号／类型及空“未记录”，真实值、待核对、编号搜索与详情保留。规格[docs21](docs/21-seatable-retail-history.md#2026-10-04-商品排序与列表精简)。

独立候选296业务、8 Chromium/WebKit、1440／1024／390／375及排序／筛选／刷新／搜索／详情返回、strict TS、lint零错误1既有warning／正式build通过，截图已查看。排除既有本地InputControl改动，保留首页教程最新main e63ddf62；合入后正式build再通过。测试改用页面演示登录，改动的测试文件不含认证字面值；5源码／测试发布，文档与记忆仅本地更新。

main **74eeeb572457869fac0a83eed1904e6d4609896a**，5文件与验收Git blob一致、其他300路径保留；CI **37208912406** completed/success，全部门禁通过。Vercel **dpl_8GLPfPAgt5357B8zzcqVEJVFaiVw** READY/production/两域名，login200部署一致、匿名state401；正式Chrome只读确认81在售／1264已售／48其他、各首页50条名称／日期顺序及空标注正确。无生产业务写入、无实体iPhone测试或客户号码／识别码落盘。证据`.local/retail-sort-simplify/`与`.local/ui-proof/retail-sort-simplify/`；本轮3126已自动停止，原3121未停止。本轮完成。

## 已完成：GitHub 新旧文件隔离与旧分支清理（2026-10-04）

用户要求区分旧站与10月2/3日新网站文件并准备清理。实时main仍f944d3e3，282文件；旧正式67858660共5326文件，其中5314路径已离开当前main，12同名配置全部替换，当前所有blob与旧版无完全相同文件。315b84e切换树精确等于188文件候选，旧历史保留不代表旧文件仍部署。按Europe/Rome，切换后main为10月2日10提交、3日9、4日7。

81远程分支已逐个根结构分类：main＋新站初始／性能2分支保留，78旧站分支单列。旧bundle重新verify及SHA256通过，78旧分支当前SHA全部与备份同名heads一致；PR26仍为唯一开放PR。详情[隔离清单24](docs/24-github-old-new-file-isolation.md)，逐文件／提交／分支证据.local/github-file-isolation-20261004/。用户随后明确确认删除78旧站分支，独立复核通过后以atomic＋逐ref精确SHA lease一次删除，exit0／78回执。删除后GitHub仅3保留分支且SHA均未变，main仍f944d3e3／tree3770583c，PR26仍open。证据deletion-receipt.json及post-delete-verification.json；未改当前源码／业务数据／提交历史／备份，未生成main新提交。本轮已完成。

## 当前实施：手机连续两行及按钮美化（2026-10-04）

用户接受两行推荐并授权实施／美化。正式源码改手机无独立卡片的连续行，标准93px；上行设备／客户／阶段，下行配件／跟进／负责人时间。配件浅紫、跟进浅灰、阶段原状态色；真实短文案及适用事实在同一个跟进按钮中排版，多状态／长型号自然增高，只读事实与默认详情保留。普通parts-cell及100%按钮保留防跨行误点，手机供应商省略、真实窗口完整读取；原业务／成本门控／写入／返回规则不改。规格docs09、复用docs06。

22定向及完整84双浏览器通过，375／390／414标准93px、44px／五点命中／所属行边界／窗口开闭焦点、长内容／多状态、1440／1024及返回恢复通过；292业务、strict TS、lint0错误（1既有warning）和正式后台build通过。实际截图已查看；读写与权限回归保留，合成数据，无生产业务写入，实体iPhone未测。

只发布7个获授权代码／测试／文档文件，其他275跟踪文件保留；冻结源码与Git blob一致。基于01f78b79发布main **f944d3e38e1e4104cf13f3183c80bd9da6db2ad0**，CI **37187326614** completed／success（292业务、完整84 Linux Chromium／WebKit、lint／TS／正式build），仅失败时上传产物步骤按配置跳过。Vercel **dpl_7aB8eqW5daVeZ7P3uxGTuQ11B96D** READY／production／两域名；/login200部署ID一致、匿名state401、线上CSS已含93px紧凑行／跟进按钮及原parts-cell与100%宽度。截图.local/ui-proof/repair-mobile-implementation/，源码／CI／生产只读证据.local/repair-mobile-implementation/。本轮3121预览已停，未改生产业务记录或后台schema；发布后仅本地补记执行结果。当前任务完成。

## 历史设计预览：手机工单紧凑行（2026-10-04，实施前）

用户要求将截图中的分组工单去卡片并压缩至约三分之一高度。本轮只规划与生成预览：内置image_gen两轮，真实本地应用临时注入手机CSS，标准行257.234375→93px（减64%）、两行集中型号／客户／阶段及配件／跟进／负责人时间。长供应商在列表省略、真实窗口完整核对；长型号和多个通知／跟进事实允许自然增高。方案与正式落地顺序见docs09最新节，提示词／样式／截图／浏览器证据在.local/repair-mobile-dense/与.local/ui-proof/repair-mobile-dense/。最终6项定向检查通过（双浏览器375／390／414、长内容与多状态、1440／1024桌面几何及业务字节不变），三类实际入口44px／五点命中及取消焦点通过；3121本轮预览已停。不改变业务事实、权限或返回位置规则；正式main仍01f78b796b0110e1b5e452784b705c58525ba0d2，尚未将候选应用到正式源码／线上。实体iPhone未测，验证的是本机浏览器模拟和合成数据。

## 最新完成：工单简化、报价跟进与返回恢复（2026-10-04）

方案[docs09](docs/09-repair-table-layout-plan.md)、业务边界[docs22](docs/22-repair-supplier-batch-notification-plan.md)。列表六列去独立配件进度/型号下ID，负责人更新末列；分组管理只在设置订单管理。Figma紧凑项目行，保存前加车提示与实际cart分开；获权进价与报价-only保留。详情左栏需求→配件→签名连续14px（手机10px），右栏独立流，少/多项目与12随件实测不撑开主任务；signature embedded只取消该嵌入的额外外边距，fixture默认不改，签署/快照不变。

fixture/LOCAL返回禁用默认重置，视图按门店/成员版本/权限隔离，搜索仅同页签内存；刷新保留非敏感视图。返回曾丢纵横位置，修复Strict Mode清理和路由滚动冲突后精确位置断言通过。接单新增quote_contact三结果与说明，列表/详情/历史同源，由服务端生成时间/操作者，不等于客户同意，不改变阶段、保管、到货/取机、签名/打印；旧workflow兼容，无schema/SDK变化，沿原权限/门店/版本/白名单/幂等事务，独立复核无确证新数据/权限问题。

最终292业务、完整82 Chromium/WebKit、更新后20定向、四宽度实际交互/截图、strict TS、lint0错误1既有warning、正式build通过。10组真实隔离本地后台覆盖重复请求/版本冲突/坏输入/actor伪造/跨店/撤权/只读/作废拒绝及页面→API→DB→刷新；本地单次168ms，仅实验室样本。旧数量UI断言改为真实采购到货记录；签名新测取消不写。所有写入合成数据，无真实下单/客户消息/生产业务写入或删除，实体iPhone未测。

第一批29文件737671f9与签名布局9926d801合计31不同文件；以下补丁仍只改这些公开路径。Linux云端曾81/82：长供应商按钮434.95–576.42越出本行440.5–571.875，底部误点下一单；仅改grid不能修复。官方同版本Playwright1.63.0 Linux WebKit2359容器复现后，增加普通repair-row-parts-cell、按钮100%宽和手机cell定位，同一原断言完整82通过；Mac最终20定向通过，保留五点命中、按钮所属行边界、完整文字/44px/焦点要求，不断言引擎内部根因。最终lint0 errors（1既有warning）、TS与正式build通过。最终main **01f78b796b0110e1b5e452784b705c58525ba0d2**；最后6文件基于7234c58发布，Git blob与冻结内容一致、其他276跟踪文件保留。CI **37165158553** completed/success（292业务、82浏览器、lint/TS/正式build）；Vercel **dpl_H6uGDBL8aB4TnVt1GoExLXGKDx1a** READY/production/两域名，/login200部署ID一致、匿名state401，实际CSS含最终cell与100%宽度。先前失败不当成功；成功证据.local/repair-refine/wrapper-release/。仅本地补记此执行结果，不额外提交状态变更。Chrome正式只读设置页被旧RepairDesk离线缓存页面阻挡，未清除业务数据，暂未作为线上UI验收证据。证据.local/repair-refine/及.local/ui-proof/repair-refine/；3144、3121与本轮临时Linux浏览器容器已停，隔离数据库与合成测试历史保留；当前任务已完成。

## 最新：工单列表 Figma 适配与两端统一（2026-10-04）

重新核验原Figma任务页截图及分组／数据格／短状态／搜索上下文，适配方案见[docs09](docs/09-repair-table-layout-plan.md)。电脑白色独立分组、细线对齐、轻量阶段标签，窄电脑保留全部列内滚；手机同风格分层卡片、四个同排44px操作及按需筛选。每单统一一个配件按钮，Stage／Contact仅列表外观变体，默认详情／扫码使用方不变。未改变后台、采购／报价／通知事实与权限。

同时修复原手机CSS隐藏待核对提示、重复配件入口导致主按钮缺少返回焦点ID、长按钮关闭后因滚动取整贴边：统一ID、preventScroll＋nearest及8px滚动边距。原ratio=1完整可见断言保留，几何证据确认从0.9963恢复1。284业务、26原维修分组／采购／通知双浏览器及4新增长文字／四宽度／键盘焦点／刷新不改事实用例通过；strict TS、lint0错误1既有warning、正式后台build通过。独立静态复核无新明确问题。截图使用本地合成数据，实体iPhone未测。

仅10个公开文件基于main a1f78fc发布至 **c71b8cc7fb4afd1f5be35d86a73d83f84e18167d**，冻结验收内容与Git blob逐项一致，随后仅本地补记执行结果。Vercel **dpl_DWwnzxHi4MJav9zAmL2zWgbuZ9UB** READY／production／两域名，/login200且部署ID一致、匿名state401。完整CI **37158292273** completed／success：284业务、64 Chromium／WebKit浏览器、lint／TS／build通过。证据.local/repair-list-ui/release.json、source-verification.json、ci-final.log、production-checks.json及.local/ui-proof/repair-list-ui/；本轮预览3121已停，数据库保留。当前任务完成，无新数据库／生产业务写入。

## 最新：维修列表按钮与组内简化（2026-10-03）

按用户反馈将列表供应商／配件入口改为常态有边框、配件图标和箭头的按钮，直接打开已选维修项目。移除到货／修好组下方的联系状态筛选与隐藏行逻辑；单条通知、久等／欠款及操作记录继续保留。只改列表与作用域样式，复用现有secondary按钮和手机44px入口，无数据结构／权限／采购或通知写入改变。规格见[docs22](docs/22-repair-supplier-batch-notification-plan.md)。

基于正式main2cce8c7，仅6文件发布至main **a1f78fc68a20450171246140e6c798235448a48e**；6个Git blob与冻结验收内容一致，之后仅本地更新记忆状态。Vercel **dpl_Gn4r4GjVxSjgACgE9kU1urGw2Kt1** READY／production／两域名，/login200且部署ID匹配、匿名state401。284业务、26项Chromium／WebKit相关交互、四宽度实际点击／布局、strict TS、lint0错误1既有warning和正式build通过。完整CI **37154721844** completed／success，284业务、60项双浏览器、lint／TS／build全部通过。截图／填值仅本地虚构数据，不保存演示修改，实体iPhone未实测。本轮3121已停，数据库保留；证据.local/repair-button-release.json、source-verification.json、ci-final.log、production-checks.json及.local/ui-proof/repair-list-button/。

## 最新：接单项目直填供应商与金额（2026-10-03）

用户最新要求已实施：弹窗直接列接单已选项目与要求，逐项目选填供应商／报价，获权进价按需显示；取消重复选项目／逐条按钮，一次保存实际修改项，成功关闭。blank supplier仅报价，不生成采购／无需采购／到齐事实；选supplier保存即加车，维修阶段仍手动。旧采购操作与异常核对按需展开，不猜未关联旧记录、不合并同项旧多采购；已下单只改报价。新建报价、详情／三语打印、旧签名和真实采购事实规则延续。规格[docs22当前方案](docs/22-repair-supplier-batch-notification-plan.md)。

本轮基于main44de758仅发布17个公开文件（无新schema/私有配置）至main **2cce8c7d42785b80c14b2edd6ba0e8e5daddb65e**；17文件与验收源码／Git blob一致，发布前记忆另核对，之后仅本地更新执行状态。Vercel **dpl_27trc9dLoGATzY5d9H4SXmfbcfqL** READY／production／chinatech.in与www；两域名/login200且部署ID一致、匿名state401。新增`save-items`共享helper+服务端单事务+一次POST；报价-only不写workflow或procurement，无权null保留真成本／非null403，版本／门店／实时权限／回执保留。独立审查2个P2已修复：旧多采购／已有单条新ID服务端拒绝，并发下单核对后供应商成本锁定但报价可保存（可见说明，保留用户报价输入）。284业务、完整58双浏览器＋新增并发2、四宽度、16真实本地API、3正式页面→API→DB→刷新链路、TS／lint0错误1既有warning／正式build通过。本地两项save1POST／172ms单样本；非线上性能。证据.local/repair-inline-*、repair-item-editor-api-final.log及ui-proof/repair-inline*。全部写入仅本地合成数据，无真实下单／消息／迁移／生产记录删除；实体iPhone键盘未实测。完整CI **37151427811** 已completed／success，lint／TS／业务／完整浏览器／build全部通过；独立复核确认两个P2已闭环无剩余确证问题。本轮3121／3144均已停，数据库与合成复现历史保留。最终证据.local/repair-inline-release.json、source-verification.json、ci-final.log和production-checks.json。

## 最新：供应商与报价流程简化（2026-10-03）

用户要求去掉复杂登记步骤，只选维修项和各自供应商，选填报价及获权进价；新建工单只填报价。正常保存自动确认项目并加车，未下单编辑仍在车；无需采购是供应商字段中的明确选择。报价按项目独立于成本保存，详情／三语打印同源，未知不当0，变更追加历史，旧签名不改。已下单仅独立改报价；旧要求变化时显式核对完整项目关联，原采购／到货保留，来源移除后保留为独立项目。规格与权限闭环见[计划22最新简化段](docs/22-repair-supplier-batch-notification-plan.md)。

以正式main bedc26e为基线，不恢复已放弃性能分支。已发布最终main **44de7587e5fac1c9a461903801cdb1826fd68fa1**（功能cd77a278、测试依赖修正a403e5c、手机焦点滚动修复44de758）；Vercel **dpl_3rPKZGq7rJxEz9oF9DYALwBY781K** READY/production/两域名。29个当前源码／测试／规格文件与Git blob一致，发布前记忆单独核对、发布后仅本地更新状态；线上/login200且部署ID匹配、匿名state401。最终CI **37149154515** 全部success，含270业务、56双浏览器、lint/TS/正式build。另有四宽度、37组真实本地API、2条正式构建页面→API→DB→刷新链路及权限独立专项审查；失败回滚、版本并发、幂等和成本投影通过。测试加载器新依赖漏接造成8项用例启动失败已补齐且未删除断言；WebKit关闭联系窗口时焦点恢复滚动影响阶段点击已用preventScroll修正，原完整联系→作废用例两浏览器各重复5次通过。首轮卡住CI已取消，完整最终CI替代旧结果。所有测试写入仅独立本地合成数据，没有真实供应商下单、客户消息、删除或数据库迁移。Chrome CDP与原生电脑接口均超时；实体iPhone键盘未实测。本轮3121/3144已停、数据库保留。证据`.local/repair-simple-release.json`、final-hashes.json、ci-final.log及本轮日志／四宽度截图。

## 最新：按用户要求放弃本地未上线改动、恢复正式main（2026-10-03）

用户明确要求删除本地这些分支改动、只保留已上线main。本轮核对GitHub main及chinatech.in/www的实际生产部署均为 **bedc26e022e4d37f97210798736430aa5dc73e6a**、dpl_9JKoBs9sgdrz2zxPQqvUQAQDqio9 READY/production。以此提交恢复工作目录，删除未上线性能代码与本地候选副本、旧构建缓存；远程性能分支与PR26不动，不改生产和业务数据库。

原性能P1/P2/P3测试分支本地已放弃，不再作为当前实现或下一步执行计划；docs20只保留历史说明，AGENTS/docs06/16/04同步纠正当前能力描述。根`.env.local`、`.local/backend`、数据/原型/设计/业务文档和候选中的私有配置保留。3117已确认属于本项目并在恢复前停止，数据库未动。264个公开文件均与正式Git blob及下载源码SHA256一致；恢复82处文件、移除25个未上线运行文件，清理30处候选代码副本及性能/旧构建/类型缓存。266业务测试全部通过、strict TS通过、lint0错误/1条既有warning。恢复后未重跑构建/浏览器，不把旧性能分支证明用于main；下载的临时源码和压缩包也已移除，只有当前根源码可运行。证据`.local/restore-main-20261003/source-verification.json`及production-version.json、restoration.json和检查日志。后续以此main为基线，不自动继续原性能优化。


## 最新：Apple 接口与个人账号关联已发布（2026-10-03）

用户批准后已开启 ChinaTech_date 的 Allow manual linking，刷新复核成功。登录/注册共用 Google/Apple 入口；个人 `/account/settings` 提供邮箱双重确认更换、当前用户 Google/Apple 绑定、34常用区号＋自定义区号、手机号短信验证流程。入口在侧栏账号菜单和待授权页，不依赖门店快照，不改变用户ID或门店权限。真实 Google 沿用原配置；Apple Developer 和短信服务配置尚缺，相关入口明确显示未开放，未测试真实 Apple 授权或短信送达。规格与安全边界见[docs23](docs/23-account-linking.md)。

从 main35569767 隔离合入28路径，发布 **52b7f67747f1cecaae2a3b2a45d012464e3af0c8**；Vercel **dpl_YqDjsvFDFWqmjhqTuuTBj9CnaXTg** READY/production，两域名已绑定。未夹带根目录并行维修/性能改动，后续任务需以此新main为基线。249单元、19定向安全/SDK、7真实本地Supabase邮件集成、strict TS、lint0错误/1原有warning、两模式构建通过；CI37075940272全部success，包含Chromium/WebKit控件回归与正式构建。四宽度账号/登录/注册布局和实际交互通过。线上14接口检查通过，现有Chrome会话确认Google已关联、侧栏入口可用；没有修改真实邮箱/手机号、发送外部邮件/短信或写入生产业务。云邮箱镜像触发器已正确，无云迁移。

证据 `.local/account-bindings/`、`.local/ui-proof/account-bindings/`；本地账号GET10样本345B、P50 52.66ms，仅实验室结果。隔离发布目录 `.local/account-bindings/release`，本轮3137服务已停止，原3117保留；Apple与短信需补服务配置后再做真实链路验收。


## 最新：整机默认在售与新机／翻新机（2026-10-03）

已按用户要求上线默认在售／已售历史／其他状态，每区全部／新机／翻新机切换；保留搜索、日期／问题／号码、待核对、分页、原详情及单机管理识码。正式在售81（新机0／翻新机81）、已售1264、其他48，Chrome切换／刷新验证通过；只变列表投影，不改原事实。复用组件和样式，列表最多50行；服务端全店快照仍属P2，详见[规格21](docs/21-seatable-retail-history.md#在售优先与商品分类)和docs20。

在同步main2f07ca3上仅发布10文件至35569767b0e849c7ea555d23a59a5ceb0584f471，字节一致；Vercel dpl_J2ohswdR5eSoBkmzbnfWAEwuWzuT READY/两域名。235业务／4新增双浏览器／四宽度／TS／lint0err1既有warning／正式build通过。CI37071293875第二次运行全部成功（235业务、40浏览器、lint/TS/正式build）；首轮唯一既有维修用例因WebKit建页27.943秒挤占测试时限，原代码原断言重跑后通过。证据.local/retail-available-first/；5本地合成单机和3137/3138已清理，其他任务与原服务保留。

## 最新：维修采购与单条状态已发布（2026-10-03）

用户“开始按照计划执行，确保逻辑关系正确并找出不合理点”。[计划22](docs/22-repair-supplier-batch-notification-plan.md)已实现工单→通用项目→独立采购、确认即加车、同供应商1–100条原子下单／分次到货、通知合回主组、修好跟进、空作废组。到齐不自动开修；旧签名／记录／隐藏分组设置保留，业务沿原私有schema。六个P2全部修复，细节见计划22，不自动真实下单或发消息。

隔离候选`.local/repair-operations-release/candidate`最终合入账号版52b7f677，发布main bedc26e022e4d37f97210798736430aa5dc73e6a，35文件逐字节一致／其他正式文件保留。Vercel dpl_9JKoBs9sgdrz2zxPQqvUQAQDqio9 READY／production／两域名。266业务、18真实本地API、46完整双浏览器＋最后8定向、四宽度、TS／lint0err1既有warning／正式build通过；CI37076940674全成功（266业务／48浏览器／lint／TS／正式build）。Chrome七组／空作废／原名称排序／采购车到货空态／项目要求只读验收，无正式业务写入，不冒称实体iPhone。证据release/published-verification.json、production-verification.json与candidate/.local日志。

根目录35文件已安全合回，保留账号／未发布性能分页／context拆分；补正式dispatcher、需求摘要、七组、分页前联系筛选、batch/link依赖与回执、弹窗跨页恢复原scope。最终root TS／282单元PASS+1原有opt-in skip／lint0err1warning；冻结273文件副本真实API20通过（61工单分页、跨页两条原子下单、回执、财务／门店隔离）。证据`.local/repair-operations-root-validation/source-sha256.json`、root-unit.log与`.local/repair-operations-root-api.log`。关键后台/query/batch文件匹配冻结；其他线程冻结后继续改4个列表UI及性能集成测试，最新UI交互不在此证据范围，未回退／未夹带本次发布。本轮3144／3145已停止，原3117和DB保留；合成历史留本地复现。本轮正式计划执行／发布验收完成，后续性能版独立验收。

## 最新：分组拖动实时动效（2026-10-02）

用户要求拖动有实时跟手效果。RepairGroupEditor整行实时移动、其他分组平滑让位、目标占位、松手归位；边缘持续自动滚动，Escape／失焦／指针取消恢复，减少动态偏好保留即时反馈。仍需保存才对全店生效，老板或settings.edit权限及后台版本契约不变。

只叠加3文件到最新main f578499，候选.local/group-motion-candidate；10项Chromium/WebKit回归（含原生触摸、移动中坐标、取消、滚动、两套保存、权限／撤权／并发）及191业务测试、TS、lint0错误（既有1warning）、正式build通过；1440/1024/390/375无横溢。已发布adc58de1e7d2421d281310981c53d069340729f0，3文件字节一致，Vercel dpl_EAq1FXiHKgbBHpUvoQ8yNMq1ck8Y READY/production/两域名。用户Chrome确认新管理窗口及动效列表，取消未保存，不写生产测试数据。CI37068106768全部成功（lint／TS／191业务／36浏览器回归／正式build）；证据.local/group-motion-verification.json和group-motion-*.log。保护其他未发布同步工作，未混入本轮发布。



## 最新：实时同步正式发布（2026-10-03）

用户“开始执行”后，整合恢复闭环和既有stateToken轻量响应，新增事务内私有Database Broadcast、ct:store命名空间restrictive接收RLS、同源HttpOnly SSE（JWT仅服务端）、45秒有限连接、逐消息/5秒权限复核、隐藏/离线关闭及重连补查；健康30秒核对，失败5秒兜底/退避。通知只发revision，不按相同revision丢弃名单变化；读取中的通知保留dirty再查。未提交草稿仍仅在设备，不自动成交。详见[docs19实时实施/最终验收](docs/19-sync-failure-scenarios.md#实时通知实施与本轮验收2026-10-02)。

云迁移chinatech_v2_private_sync_broadcast成功，2策略/3触发器，旧权限保留、匿名helper拒绝/历史raw_data仍无运行角色权限、历史1393不变。独立权限/事务专项审查无确证P1/P2；8真实Broadcast、16 Chromium/WebKit HTTPS正式构建实时链路、44API、230单元、36控件、恢复26＋最终WebKit13、TS/lint0err1既有warning/build通过。WebKit Fetch日志被Playwright转pageerror已用18原生对照/16实际相关性查明；测试增强真正window error/unhandled观测，未知错误仍失败。证据`.local/sync-release/`；不冒称实体iPhone/异地硬件验证。

基于最新adc58de分组动效发布main2f07ca36810879a7651ead42d003a90845dd1d7b；40文件逐字节一致/3分组文件保留/私有路径未发布，候选`.local/sync-release/candidate`。Vercel dpl_DBUhCfi2kTvrZQGK5r2fiaijcBba READY/production/两域名；10正式只读/拒绝检查通过，现有正式Chrome登录会话SSE ready＋3心跳、历史入口1393/无连接错误，无生产业务写入。CI37070930552所有门禁成功（lint/TS/230单元/36控件/正式build），发布验收完成。随后整机视图任务main35569767b0e849c7ea555d23a59a5ceb0584f471以本同步commit为直接parent，未改同步运行文件、测试门禁保留，Vercel已success；当前main以其为准。根目录其他性能任务的修复和配置保留，未把未验收改动夹带发布。

剩余：按页面读取/分页及命令依赖减负；PWA离线冷启动、未提交草稿跨设备转移未实现；浏览器清理/设备损坏的未提交内容不能承诺找回。原3117保留，本轮3141/3142/3143验证服务已停止，原3117未停止。

## 最新：SeaTable 整机导入完成（2026-10-02）

按用户确认将电子产品全部1,393行/19列写入正式历史整机，全部翻新机；在售81、已售1,264、其他48，509待核对，1,207行有效号码进入客户历史。PREZZO/成交/定金/成本及DATA/拿走日期按确认映射；未知原值保留，不生成假收款/检测/物理合并。入口/app/retail?source=history，搜索、筛选、50条分页、只读详情、客户关联已上线。规格[docs/21](docs/21-seatable-retail-history.md)。

云新增retail_history_records只读RLS表，35批隐藏暂存，最终事务全部内容摘要核对后统一published=1393，审计/回执各1。源快照909f55ee…7acde6，原资料仅.local/seatable-retail-import/。独立审查＋10项RLS检查＋9项领域/事务反例；最新main6c9ef15上合入18文件，191测试/TS/lint0错误/正式build通过，CI37063207897全成功。发布f578499b49ef8276dc5449dbf2ab19464d188cce，Vercel dpl_Hq2iRmLkmKtqdX3ftATDKYwqqqPN READY/两域名，18文件字节一致。真实Chrome验收总数/状态/待核对/型号搜索/详情/客户关联，合成四宽度无横溢；证据production-verification.json。保留其他并行任务，不把当前根目录全部改动视为已发布。

## 最新同步恢复闭环（2026-10-02）

本轮已在本地实现并验证，尚未提交／发布同步代码；不混用其他任务的线上证明。详见[42场景报告19](docs/19-sync-failure-scenarios.md)。落地门店版本行锁＋整事务最多3次重试、成员绑定／409冲突、操作回执查询与取消墓碑、20秒HTTP限时、IndexedDB原命令持久化／手动核对重试、按成员权限隔离且每编辑器独立的设备草稿、照片字节和未完成签名恢复。可见页面5秒轮询及前台／联网补查，Broadcast／outbox和PWA离线冷启动未做。草稿不会自动跨设备或自动成交，浏览器清理／未落盘即强制终止仍不能保证恢复。

最终 npm test204通过／1独立历史导入集成未开启而跳过；隔离真实API44项（取消迟到竞争10次、售后中途故障回滚）；Chromium/WebKit实际IndexedDB与断网26项；既有公共交互34项；1440/1024/390/375布局、TS、lint0errors/1既有warning、隔离副本Supabase-mode webpack build通过。独立专项审查修复草稿失败清理、慢写入回到原值、异步身份窗口，最终关键路径无确证P1/P2。照片测试还修复WebKit落盘与离线文件句柄问题；不冒称实体手机／异地硬件验证。证据`.local/backend/sync-*`、`.local/ui-proof/sync-recovery/verification.json`；隔离源码副本`.local/sync-validation`。原本地3117服务沿用且未停止，未写生产业务。下一步按docs20先减小查询投影，再接私有Broadcast及可靠补查；发布需只包含明确验收代码，保护同目录其他任务改动。

## 最新字体可读性优化（2026-10-02）

用户要求主流网站字体参考并改善屏幕刺眼／模糊。已改系统UI字体优先＋中文回退、移除Source Sans 3及强制平滑；后台14px、辅助至少12px、手机输入16px，650/750收敛600、800改700，正文深灰、辅助文字提高对比。原1024px账号页固定列溢出修为弹性列。5个官方体系对照、21CSS声明统计和使用规范见[docs/06字体段](docs/06-ui-components-and-styles.md#字体与可读性2026-10-02)，详情见docs/04。

因首页和同步任务并发修改根目录，本轮用线上8254b4f＋7字体文件的独立副本验证：Node24，177业务测试、26 Chromium/WebKit交互、严格TS、正式build通过，lint只有既有warning；12路由共72布局检查（1440/1024/390/375、Chromium DPR1/2、WebKit手机模拟），三语接机单预览通过，截图已查看。其他任务的根目录新增文件/同步CSS保留，未随本轮发布，也不声称已验收。证据`.local/ui-proof/typography-20261002/`；Windows/ClearType及用户物理显示器未实测，不把DPR模拟当硬件验收。

已发布main666af411cdbe86225b858c2f27890bcb84dd42ed（7文件），Vercel dpl_8jkAJzhrnZqYB8hS5D6Pth8FqFa2 READY/production/两域名。线上四宽度首页/login/register共12项通过，匿名state401、密码显隐/注册导航通过，网站字体请求0，无控制台页面错误；未写真实业务数据。CI37055699353全部成功（lint、TS、177业务、26浏览器及正式build）。7公开文件与已验收副本逐字节一致，无其他文件改动；线上Chromium实际字形为系统.SF NS与PingFang SC，非自定义下载字体。

## 最新进行：分组改名与拖动

2026-10-02 用户要求分组可改名/拖动排序，仅老板或有权限账号。已实现两套分组配置、门店共享保存，复用settings.edit；服务端版本/权限校验、旧配置兼容、工作台/配件筛选联动。178单元、8真实本地API、32浏览器回归通过，合入main666af411字体改动后12定向回归及正式build通过；新增配件回归也已通过，合计8个编辑器用例。隔离发布候选.local/group-edit-candidate保留其他本地未发布工作，13文件白名单.local/group-edit-files.json。已发布 main ee3099b96a2b6ef6bb0990358f77916f4b311bef；Vercel dpl_Bnq4ZcbUZbkSdna4aA6frPYt3UFz READY/production/两域名。用户Chrome店主可打开真实管理弹窗；连接短暂中断后已恢复确认弹窗关闭、原分组顺序未变，页面保留。未点保存、不写云分组数据。CI37057179599全部通过（178业务测试、34浏览器回归、lint/TS/build）。196发布文件与隔离候选一致（测试端口/生成类型路径归一化），不包含其他本地未发布工作；详见docs/10新增章节。

## 当前：首页与账号体验改版（2026-10-02）

用户要求电脑/手机公开首页美化、图形/轻动效及完善登录注册并增加Google。已实现首页图形工作台、功能卡片、切换流程、双端示意/FAQ；AuthFrame统一登录/注册/验证/恢复/待授权页。注册确认密码及强度提示、成功留在邮箱确认/重发、独立verify-email、真实forgot→PKCE→reset、新密码再次登录。Google仅同源固定provider/回调、S256 PKCE/HttpOnly，注册与OAuth仍无自动门店权限。恢复凭证15分钟绑定user/session，临时故障保留重试；修改密码会撤销同Auth旧会话。详见docs/01最新节和docs/06。

验证：Chromium/WebKit 1440/1024/390/375共48布局+2交互组；verify-email新增4布局；真实本地登录/退出/重置7项；本地捕获邮件/API10组；5项OAuth/恢复反例。最终发布副本183单元、严格TS/正式build通过；此前26既有浏览器回归通过。未发外部邮件或测试真实Google授权。证据.local/ui-proof/public-redesign/。根目录并行业务改动未夹带；发布副本叠加31文件到最新main ee3099b并保留其13个维修分组修改，全部公开源码字节一致。main现6c9ef15ecff9b59a245a2068403331312dc1bf4f，Vercel dpl_D2fNAsjhQGcHmPotiWK72KsR7RE1已READY/production；两域名已绑定；线上13项匿名检查通过，未创建真实账号/未发邮件。CI37062208049全部success（lint/严格TS/183单元/浏览器回归/正式build）；证据见本轮ci-verification.json。

Google登录已配置并真实验证（2026-10-03）：用户同意政策与创建/保存凭据后，在既有Google项目kyox215创建ChinaTech品牌及ChinaTech Web客户端；未新建云项目。只授权openid/userinfo.email/userinfo.profile，实际Supabase请求email/profile；正式来源www/chinatech.in，唯一Google回调为xluzcoduqsdvjoouqhkc.supabase.co/auth/v1/callback。Secret仅经内存传入该Supabase provider，未写项目、截图或日志；已清理内存变量。provider已Enabled，nonce校验保留，不允许无邮箱登录。

真实Chrome从/login点击Google→选择已确认账号→授权姓名/头像/邮箱→/app/dashboard，刷新仍登录；只读云核验原邮箱仍1账号、Google身份已关联、email身份保留；未写业务资料/门店权限，未创建测试账号。正式HTTP验证入口200、固定client/callback、S256/HttpOnly/Secure、异源403、外加provider400、缺code回login通过；初始scope断言误预期openid也出现在实际请求，按实测email/profile及官方基本权限子集更正，未放宽额外权限。证据.local/ui-proof/public-redesign/google-live-verification.json及google-provider-enabled.png。

Google发布/品牌限制：控制台仍为Testing，发布按钮提示品牌资料未完，网站尚无经确认的公开隐私政策；未冒造法律文本或声称完成Google品牌验证。Google官方基本登录例外允许此email/profile范围无需测试名单（本轮测试名单0也已实际登录），不受该例外中的7天授权过期约束：https://support.google.com/cloud/answer/15549945?hl=en。授权页当前显示Supabase域名；正式品牌发布/验证需补齐经用户确认的隐私政策及Google要求的资料。新无门店Google账号实测未做，已有门店门控源码/前轮本地反例证据沿用。此轮仅云OAuth配置/验证和文档，无业务代码、构建或发布变更；Chrome登录成功页409306595保留。

## 当前目标与选择

用户要求重构版替换 chinatech.in/www、既有Vercel及GitHub；旧站源码/数据在ChinatechOS备份并可本地运行。先接正式后台再切域名，新业务空数据。复用既有Supabase项目，未批准新建每月10美元项目；指定首位老板邮箱kyox120@gmail.com，已绑定其现有已验证Auth身份，不改密码。真实支付退款服务/发单/外部测试邮件短信未授权。

## 历史：性能计划与已放弃的本地实现（2026-10-02）

用户随后明确按计划安排并开始执行，要求后续新增／修改功能遵守性能要求。已写根AGENTS“响应速度与加载要求”、联动规则16和公共样式规范06，默认npm test加入维修模型回归。首批P1本地完成：状态令牌轻量核对与同引用不发布、权限同版本变更重投影、维修配件索引／单次分组／折叠按需行、恢复读取合并／离线竞态保护、根加载及错误重试。后续阶段与详细证据见[计划20](docs/20-performance-optimization-plan.md)。

最终本地验收跨至10月3日。隔离生产构建＋合成100／1,000／5,000工单，每组30暖请求：未变化JSON210B，减少99.662%／99.965%／99.993%；5,000请求P95 1125.3→66.5ms。5,000维修CPU模型P50 3767.39→7.29ms，不含React／DOM／网络，不代表真实INP。236业务回归通过／1集成未启用跳过；TS、lint0错误／1既有warning、正式隔离build通过；42公共浏览器回归＋样式6项补验、6错误恢复、10状态API检查及Chromium/WebKit各13恢复检查，四宽度无横溢。WebKit仅测试浏览器适配本地HTTP cookie；Playwright将部分fetch网络诊断转为pageerror，单列保留，跨导航实际未捕获异常为零，详见docs20。证据.local/performance-p1/；保留并行实时／分组等工作，本轮不冒称独立实现或上线它们。

本批无迁移／生产写入／发布。P0冷启动、弱网、并发、真实LCP/INP尚未齐；下一批P2先维修摘要＋全部获权结果计数＋稳定分页＋详情，闭环识码、客户历史、保存后刷新与三语打印，再扩展其他模块／附件和请求隔离首屏；P3命令最小读取及协作延迟按证据继续。原审计.local/performance-audit-20261002/仅匿名抽样和既有构建统计，不能替代本批或生产业务证明。

## 已完成真实后台

详见[正式后台与切换](docs/18-formal-backend-and-cutover.md)。Next16.3.7/React19/TS strict，新增Supabase SSR0.12.7/JS2.117.2、postgres3.4.9、sharp0.35.5，Node24，npm审计0。复用既有项目ChinaTech_date/xluzcoduqsdvjoouqhkc，新增chinatech_v2/chinatech_v2_private 12表、受限chinatech_runtime、一个空ChinaTech门店及一老板。共用Auth身份，独立ct_rebuild_auth HttpOnly cookie、成员和业务数据；旧账号不自动授权。云新工单/客户/整机/照片0；旧public133表、Auth14、profiles14，原on_auth_user_created触发器保留。运行角色对旧public表读/写0；浏览器对新表权限0。密码仅.local/backend私有文件与Vercel sensitive环境；公开SQL无密码。

服务端验证真实已确认用户/有效session、门店、实时成员状态、能力、版本/幂等，事务保存审计、客户设备、工单、采购、销售事实、签名、设置和员工；售后维修及销售关联原子提交，财务投影先于序列化。后台读取真实快照，无fixture首屏；15秒/聚焦查询、保存后刷新，未实现规划17 Broadcast/outbox。注册验证后仍待门店审核，无自选老板。标准PKCE、首页/旧login回调及/auth/callback兼容，不接受外部next。

接机照片同事务写私有bytea表，快照仅refs；GET核对有效会话/门店/repairs.view及当前引用。JPEG服务器完整解码、每边1000px/240000bytes、当前6张、历史30张/7200000bytes；不可变photoID，超限/失败整次回滚。整机压缩照片随私有档案保存。

独立本地栈API55421/DB55422/Studio55423/捕获邮件55424、应用3117，均loopback，project_id chinatech-rebuild，与旧站栈分离。启动脚本scripts/start-backend-local.mjs仅接受此栈和运行角色，私有配置在.local/backend；根.env.local原3000样板保持。正式.next-backend、样板.next。最终构建时3117已停止；如需启动先检查端口，不能停旧站或3000。

验证：174单元测试、36真实本地API、8本地邮箱PKCE、空临时库完整安装12表与Auth兼容通过；严格TS、正式build通过，ESLint无错误（会话失效整页跳转一条建议警告）。独立审查共享Auth、权限/财务/事务、异步身份窗口、私有照片和历史上限。IAB实测本地合成老板登录、无照工单LOCAL-3A6082BF99CE4BE9及带照LOCAL-312B413DA5B847E8保存/刷新私有JPEG、客户/设备目录2条、工作台待检测2、退出后受保护页回登录。详情/工作台1440/1024/390/375无整体横溢，手机菜单实际导航。照片首尝试使用未刷新旧页面被拒，完整载入新代码后通过。没有独立保存截图、硬件镜头/扫码枪/实体打印/跨物理设备验收；不把本地合成登录当云老板验收。证据.local/backend/*-verification.json和final-*.log，不包含真实会话。

## 最新任务：SeaTable 分组与整机宽屏（2026-10-02）

用户要求维修工单分组/排序匹配 https://cloud.seatable.io/workspace/30461/dtable/ChinaTech%20(1)/ ，并修复整机在宽显示器比其他页面窄的问题。整机已移除 retail-surface.module.css 的额外1200px限宽，列表/详情/新建与复制共用 AppShell 宽度。24 本地 Chromium 布局检查通过（维修对照及整机三页，1920/2560/1440/1024/390/375），超宽均1540px对齐，手机详情/表单仍单栏，无整体横溢；正式 Supabase-mode build通过。宽屏修复版本 main9158939f83a9c888befff3fdfcdfbe142c409446，190文件字节一致；Vercel dpl_9DwtXGNsjbMN8tW5aiKvV1acWiu4 READY/production/两域名，匿名首页/login200、state401。CI37025116887全部成功（lint/TS/174业务测试/20浏览器回归/正式build）；证据.local/ui-proof/retail-width-20261002/。以下e6c097a为前一交互修复证据。

维修分组已通过用户 Chrome/hexiang 真正读取（新的browserId3，browser.user.openTabs/claimTab成功，native getApp仍超时）。RIPARAZIONE／进行中：STATO升序，久等 未答复→欠款 已拿走→寄修→IN CORSO→下单→到货→到货已通知→修好→修好已通知→FATTO；默认STATO不是作废，DATA RITIRO(mtime)升序再DATA AGGIUNTA(ctime)升序。已实现为默认分组/筛选，原配件分组保留；新增4人工阶段，沿用工作流服务器写边界，款项/交付不自动变化；列表、工作台、详情、共享客户目录、三语打印联动。177业务测试、20既有浏览器回归及新增6 Chromium/WebKit回归、四宽度、TS/正式build通过；lint仅既有警告。详见docs/10，证据.local/ui-proof/seatable-groups/及.local/seatable-*.log。已发布本轮9文件：当前 main ba540bf28710d9e4adcb3ab2a8cf246d45be2c11，191公开文件逐字节一致；Vercel dpl_4yEzoWJwH7b56zYTudcTJTjcZmbr READY/production/两域名，CI37045060833全部成功（177业务测试＋26浏览器回归＋lint/TS/build）。用户Chrome真实登录页已验证默认排除作废、workflow分组、updated双字段排序，切至配件分组再切回正常；线上未写业务数据，新维修标签页已保留。只保存视图设置证据，无导入SeaTable记录。

用户补充空分组也显示：已修改维修状态/配件分组保留零单组、显示0及展开空提示，顺序和默认排除作废不变。6项Chromium/WebKit定向回归、四宽度、TS/正式build通过，lint仅既有警告。已发布main8254b4f73abef95e1e3c78c7500a25456ccac031的2文件，191公开文件字节一致；Vercel dpl_7yjgesfhMcoVYcH7TEo68ftQHmBL已READY/production/两域名，用户Chrome实测10个分组按序显示（9个零单）、空组展开提示正确；CI37053543332全部通过（177业务测试、26浏览器回归、lint/TS/build）。证据.local/empty-groups-*。

## 最新选项交互修复（2026-10-02）

用户报告 iPhone 搜索候选点选无反应。本轮审查全部选择控件和调用方，修复 SearchCombobox 的 iOS pointerdown 失焦丢 click、已聚焦输入不能重开、候选按钮获得焦点后选择重开菜单、IME 误确认；共享原生 button/option 与 mousedown 保焦点，不取消触控滚动。SingleChoice 新增可选 onRepeatSelect：颜色当前值重复确认只关闭且保留自定义文字、屏幕技术当前值返回主层；整机类别 key 同步重置颜色模式。未改 Auth、数据库、权限、支付或外部消息。

20 浏览器用例在 Chromium/WebKit 触控模拟通过，1440/1024/390/375 下维修/整机无整体横溢；包括客户联动、型号清理、多选取消及虚构工单/采购保存后刷新。174 业务测试、严格 TS、正式 Supabase-mode build 通过，lint 0 errors（保留既有导航建议 warning）。独立审查新增焦点顺序反例已修复并验收。测试显式模拟 WebKit #322721 的 iOS 失焦顺序；未操作实体 iPhone/搜狗键盘，不把 emulation 当硬件验收。

已发布 main e6c097a27575d8a3b3fbad1deecf2d44090986c9，190 公共文件逐字节相同、无无关差异，Vercel dpl_4AdK3iuqvtMAffDEhra8hFvpiZ1M READY/production/两域名指向新版本。CI 37012148575 包括新增浏览器检查及正式构建全部成功；线上匿名 HTTP 6 项正常（2026-10-02 13:20 UTC）。后续 npm run test:controls 自动覆盖此类回归，证据 .local/ui-proof/controls/、.local/ui-proof-choices-*.private.log；详见 docs/06 和 docs/04。以下旧版本 SHA/部署号为此前首次替换证据，当前版本以本节为准。

## 当前 GitHub 与正式站

用户最新明确要求直接替换 main 并把旧站抓取到本地，不再等待云老板手工登录。GitHub公开kyox215/Chinatech-codex，PR25 https://github.com/kyox215/Chinatech-codex/pull/25 已附任务。候选19c2da22dd5e9921d2b0c20b4d3d5c3fda97b29b的188文件逐字节核对/CI通过；main已315b84eaadb57ca1dfaac07e1a93f640477e7e20，树78fb26cf4e4403f6998d2a0d5f8b2ab9f98a0c27相同，合并保留旧main和候选历史，实际main CI37004091465成功。根无.git，发布用连接器与独立副本.local/github-published-verification-20261002；白名单排除真实数据/密钥/history/docs/AGENTS。

既有Vercel chinatech-codex/prj_FZoMRZoHsRNALz4ahEVGaXAxHOFS，team kyox120-9295s-projects，项目framework已同步nextjs/Node24。Preview dpl_CjD4R4fSYTjVZUELzzgZ2riBPuu2 READY；稳定别名 https://chinatech-codex-git-chinatech-reb-1c3937-kyox120-9295s-projects.vercel.app 。匿名HTTP会到Vercel登录，不把它200当应用；已用认证CLI访问真实state匿名401。Vercel distDir.next，本地正式.next-backend。

生产六配置BACKEND_MODEsupabase/LOCAL_PREVIEW0/SUPABASE_URL/发布密钥/受限APP_DATABASE_URL/APP_ORIGIN均production各1核对，DB sensitive。首生产dpl_FB5nnyTteAebh3AyJJ5M4LJVwJmm READY并分配两域名。原域名chinatech.in 308→www.chinatech.in；首次验收发现APP_ORIGIN不一致，已更新为https://www.chinatech.in并重建dpl_BWuqdTHJcrksT1jBWMLmQknT2v4D，最终READY/production/两域名分配/源main一致。保留旧生产dpl_DZBQoAXvF275DZYPyG1k2aLpGup2/SHA678586601cee40e1979f2cfadcb952e4ce25dcf3回退。

正式HTTP11项通过（12:10 UTC）：root/login/register200，state401，dashboard→login，同源空认证400/空command401、异源403、preview-session404。IAB首页→登录→注册/密码显隐/空表拒绝/受保护页回login，手机375无横溢、输入16px/提交44px，视口恢复。PR25已merged/closed。云复核新维修/客户/整机/照片0，1店1老板，Auth/profiles各14。云老板现有密码登录与注册邮件体验未手工实测，未发外部测试邮件。证据.local/backend/production-http-verification.json、production-ui-verification.json、after-cutover-counts.json。原目标已完成；旧云表暂留回退，不自动删除，新业务仍空。后续按用户新功能目标继续，不自动发布业务写入或发送外部消息。

## 旧站备份与运行

已授权目的地ChinatechOS：/Users/kyox215/Documents/文稿 - kyox215的MacBook Pro/Codex/2026-05-17/zip-github/archive.local/online-backup-20261002/，backup私有原始档案、app独立工作副本；保留旧项目数百未提交改动。app origin本机镜像，生产push禁用。当前.local/online-backups/20261002暂存保留。最新补充cutover-20261002-1153已存同目录：11:53 UTC云8张差异表以原Postgres JSON字节抓取，7表已事务恢复本地；163张非会话旧表内容摘要一致，3序列同步。新数据SQL/原schema+roles/云Storage元数据/5原文件重新SHA/manifest16文件29381347bytes复制核验。云5Storage对象原元数据未变，私有桶匿名下载被拒，复用已核验原文件不声称重下载。原不可变backup不覆盖，六活跃Auth表数据排除；最新证据.local/online-backups/20261002-cutover-1125/latest-content-verification.json。3107恢复后/login200。Git镜像640commits/104refs、bundle fsck/verify；精确正式SHA源码；170表45994行/schema/roles/迁移、Auth14用户14身份、Storage5文件238348bytes。164表数量一致、附件SHA一致，5556文件校验通过；375FK中374通过，customer_tags 6条缺门店在线原已存在且约束未验证，保留。不可改原manifest或以新测试覆盖旧验收。

旧本地3107、API55321/DB55322/Studio55323/捕获邮件55324，loopback独立密钥，不连接旧云或启用旧会话；AI/QR/邀请/export/purge关闭。start-local.command实际启动/login200，restore-fresh-local.py拒绝覆盖保护通过；真实Auth及BFF上下文/统计/工单168/客户/库存4通过，匿名401；旧源码lint/typecheck/5217tests/build/risk34/agents checks通过。完整旧Chrome点击未完成；Chrome连接多次超时，本轮新系统改IAB完成验收，不能声称Chrome通过。旧服务器不主动停止。

Vercel sensitive旧变量导出为空，旧QR HMAC/供应商秘密未恢复，不能宣称全密钥备份。以前自动审批拒绝保存会话（已内存替代）和根Git read-tree（用连接器与独立副本发布），本轮不重试这些动作。详细限制看原backup-status.json/恢复README。

## 规则和业务指针

最新用户→根AGENTS→docs/00。更改按[联动规范16](docs/16-change-consistency-contract.md)和[组件规范06](docs/06-ui-components-and-styles.md)核对；docs/04是产品决策/验证进度，本文唯一简明执行记忆，history只追溯，不重读整个历史。业务详见docs/05、07、08/09/10、11（售卖员工）、12（规格）、13（输入）、14（签名/打印）、15（SeaTable研究）、17（同步规划）。此前文档M1授权和规划独立新Supabase建议按本次明确选择更新，不回退到旧限制。

核心边界：客户设备/自有单机/型号三身份独立；维修配件只有工单采购/分次到货/追加更正，不做库存。整机一机一档，未知规格不能填0，显式检测后可售，出售冻结实物/买家/成本/保修与未收款事实，真实结算/交付分开，售后绑定三元组，退回隔离复检，历史不覆盖。成员能力与账户/门店状态分开，不能自提权/停最后老板/公开自选老板；敏感金额服务端投影。签名绑定核对事实和政策、操作者/服务器时间/版本，不表示检测、报价、支付或权利放弃。三语打印默认意大利语；维修/整机初始6/12月，新事实冻结，旧销售不改政策。

UI沿Figma与既有CSS/token，公共PageTitle/AppShell及选择/识码/拍照控件复用，>=768桌面完整列，<=767单栏抽屉，无全局顶栏/底导航，手机16px输入/44px目标。原168项M1详细UI证据及用户原DEMO档案在docs/04、13、14；本輪未删除/改写它们。


MiMover执行收口 checkpoint：新原页面进度必须实际System截图，不仅getText；原decor黑盖/百分比巨字号已改为实际原View白底状态20sp/计数16sp/类别20sp+可滚动列表+原48dp Stop。原页头复用stub，只有一个44dp返回；分页previous栈Bundle保留；sender类目排除未选；Finish只绑定当前completion恢复统计；QR状态投影与新机hint已接。af41真实pair26/selection23/uiproj20与像素已过，当前4607再补新stats/QR/group与exact install/pair，由mimover_research执行。所有失败/SDK环境netsim abort/LOHS SYSTEM_2保留，AVD重启session49620/79442（只自己的5590/5592）。网站B7冻结28/正式build通过；临时3227服务session91832当前，下一步4607需要新build/server/browser。PR40已attach；旧2ac23d06完整CI37921809538 success（不是最终包发布证据），候选分支已推。发布源还有未提交最后APK/UI/docs/tests收口，待native最后通过后一次commit→新完整CI→main正常FF→Vercel/两域正式下载与浏览器验证。不要把旧B7/a17证明混成4607 exact，Source73项ZIP需重新冻结，native resources201。未合main／未上架，根其他work保护。
