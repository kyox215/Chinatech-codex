# ChinaTech 项目连续记忆

最后更新：2026-10-03。当前已获真实后台接入与线上替换授权，旧M1仅本地范围不能覆盖最新决定。

## 最新：供应商与报价流程简化（2026-10-03）

用户要求去掉复杂登记步骤，只选维修项和各自供应商，选填报价及获权进价；新建工单只填报价。正常保存自动确认项目并加车，未下单编辑仍在车；无需采购是供应商字段中的明确选择。报价按项目独立于成本保存，详情／三语打印同源，未知不当0，变更追加历史，旧签名不改。已下单仅独立改报价；旧要求变化时显式核对完整项目关联，原采购／到货保留，来源移除后保留为独立项目。规格与权限闭环见[计划22最新简化段](docs/22-repair-supplier-batch-notification-plan.md)。

以正式main bedc26e 为基线，不恢复已放弃性能分支。270业务、34双浏览器及4新增定向、四宽度、原18＋新15＋新4真实API、2条正式构建浏览器链路、TS／lint0err1既有warning／正式build通过；失败回滚、版本并发、幂等、成本投影与权限独立专项审查通过。所有测试写入仅独立本地合成数据，没做真实外部下单、客户消息或删除。证据.local/repair-simple-*和.local/ui-proof/repair-simple*。源码验证完毕，按既有授权发布main；发布结果待本轮核对后记录。

## 最新：按用户要求放弃本地未上线改动、恢复正式main（2026-10-03）

用户明确要求删除本地这些分支改动、只保留已上线main。本轮核对GitHub main及chinatech.in/www的实际生产部署均为 **bedc26e022e4d37f97210798736430aa5dc73e6a**、dpl_9JKoBs9sgdrz2zxPQqvUQAQDqio9 READY/production。以此提交恢复工作目录，删除未上线性能代码与本地候选副本、旧构建缓存；远程性能分支与PR26不动，不改生产和业务数据库。

原性能P1/P2/P3测试分支本地已放弃，不再作为当前实现或下一步执行计划；docs20只保留历史说明，AGENTS/docs06/16/04同步纠正当前能力描述。根`.env.local`、`.local/backend`、数据/原型/设计/业务文档和候选中的私有配置保留。3117已确认属于本项目并在恢复前停止，数据库未动。264个公开文件均与正式Git blob及下载源码SHA256一致；恢复82处文件、移除25个未上线运行文件，清理30处候选代码副本及性能/旧构建/类型缓存。266业务测试全部通过、strict TS通过、lint0错误/1条既有warning。恢复后未重跑构建/浏览器，不把旧性能分支证明用于main；下载的临时源码和压缩包也已移除，只有当前根源码可运行。证据`.local/restore-main-20261003/source-verification.json`及production-version.json、restoration.json和检查日志。后续以此main为基线，不自动继续原性能优化。


## 最新：Apple 接口与个人账号关联已发布（2026-10-03）

用户批准后已开启 ChinaTech_date 的 Allow manual linking，刷新复核成功。登录/注册共用 Google/Apple 入口；个人 `/account/settings` 提供邮箱双重确认更换、当前用户 Google/Apple 绑定、34常用区号＋自定义区号、手机号短信验证流程。入口在侧栏账号菜单和待授权页，不依赖门店快照，不改变用户ID或门店权限。真实 Google 沿用原配置；Apple Developer 和短信服务配置尚缺，相关入口明确显示未开放，未测试真实 Apple 授权或短信送达。规格与安全边界见[docs23](docs/23-account-linking.md)。

从 main35569767 隔离合入28路径，发布 **52b7f67747f1cecaae2a3b2a45d012464e3af0c8**；Vercel **dpl_YqDjsvFDFWqmjhqTuuTBj9CnaXTg** READY/production，两域名已绑定。未夹带根目录并行维修/性能改动，后续任务需以此新main为基线。249单元、19定向安全/SDK、7真实本地Supabase邮件集成、strict TS、lint0错误/1原有warning、两模式构建通过；CI37075940272全部success，包含Chromium/WebKit控件回归与正式构建。四宽度账号/登录/注册布局和实际交互通过。线上14接口检查通过，现有Chrome会话确认Google已关联、侧栏入口可用；没有修改真实邮箱/手机号、发送外部邮件/短信或写入生产业务。云邮箱镜像触发器已正确，无云迁移。

证据 `.local/account-bindings/`、`.local/ui-proof/account-bindings/`；本地账号GET10暖样本345B、P50 52.66ms，仅实验室结果。隔离发布目录 `.local/account-bindings/release`，本轮3137服务已停止，原3117保留；Apple与短信需补服务配置后再做真实链路验收。


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
