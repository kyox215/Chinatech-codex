# ChinaTech 项目连续记忆

最后更新：2026-10-09。当前已获真实后台接入与线上替换授权，旧M1仅本地范围不能覆盖最新决定。


## 进行中：公开导航精简（2026-10-09）

用户要求右上角显示工具箱，退出放账号信息里。已统一公开页右侧工具箱文字／链接，退出仅保留AccountMenu内，品牌返回首页、账号／工作台保留；手机语言第二行独立，1024分区导航另排。沿用现有三语／图标／CSS token，认证／权限／数据协议未改。9源码／测试限定路径及docs06／16／04同步，独立.local/public-header-menu/candidate基于main695f6c6，根其他开发保护。

最终16双浏览器菜单／三语四宽／预览实际退出＋6工具页返回／下载用例通过，手机图已目视；额外发现未验证账号意／英语按钮过长使触发器缩为12px，已改长文案换行与账号60px最小宽，并在原用例加入3语×2手机宽／遮挡反例复验通过。旧e103d1d检查不作最终发布门禁，最终CSS正式build重跑中；TS／3590键／lint0错1旧warning／正式Supabase-mode构建已通过。完整CI／发布仍待，不冒称上线；图为合成账号，真实会话和实体iPhone尚未本轮验证。证据.local/public-header-menu/，后续按精确SHA CI／main正常FF／正式双域和真实只读菜单验收。

## 进行中：公开页具名账号菜单（2026-10-08）

用户要求首页显示当前账号、退出和工作台，点击账号展开详情／设置。已实现本人canonical名称／真实当前主邮箱／有效门店与角色菜单，复用账号设置与个人登录设备锚点；身份通知立即清个人资料，旧响应／故障不恢复旧账号。详见docs06/16/29/04。没有迁移、密码／绑定修改或真实业务写入。

隔离 .local/account-menu/candidate 从 main49c0d5f 叠加限定路径，保护根同期目录／Office等改动。404单元通过／1既有WindowsParser skip、定向13单元、16菜单／会话和58关联双浏览器、3408三语键、TS／lint0错1旧warning／正式build已通过；真实本地Auth十组及设置／设备定位通过，独立只读权限审查无阻塞。正式HTTPS构建十组双浏览器复验通过（实际window.error／未处理Promise零，WebKit原生取消单列）；CI／main／部署未完成不冒称上线。证据.local/account-menu/；实体iPhone、真实账号退出／撤销及外部绑定未测。

## 登录状态闭环：本地完成，待同SHA CI与线上验收（2026-10-07）

已登录返回首页保留公开内容；首页全部账号入口与工具箱同源，登录/注册按有效会话分流，待授权核验项目撤销/过期及重查授权，账号服务故障单独重试。最小GET /api/auth/status显式JWT+live_user/member_access，无Cookie/业务快照/门店访问登记/轮询续期；过期hint409仅让人重核整页。跨标签提示、前台重查、epoch防迟到和持久布局不恢复旧状态；公开可信交互沿原活动服务。公共导航44px、三语，锚点按实际公共栏高度，OAuth/绑定/恢复原入口保持。

隔离候选.local/auth-loop/candidate基于main887c1e6；保护根其他任务，只纳入paths.json限定差异。400单测通过+1既有Windows parser配置skip（401总），34定向Auth，新增8双浏览器、受影响98用例发现4缺口后定向补验；真实本地10组Auth/DB/双浏览器三语四宽度/无JS SSR通过，实际window异常/未处理Promise0，WebKit原生取消诊断另存不冒称网络零取消。类型/i18n/lint0错1旧warning、正式build通过；后续最终CI/发布记录补此段。合成账号/门店已精确清理，3173已停，3174预览待收尾；无生产DB/Auth设置/业务数据写入。详见docs29/06/16/04及.local/auth-loop/integration.json、日志/截图。实体iPhone及真实外部OAuth/SMS未验，不将合成与模拟证据代替真实登录。

## 当前实施：Windows CMD 启动错误修复（2026-10-07）

preview.2 改为纯 ASCII CMD/单次编码启动、三语直接 Console 输出和 TYPE 备用提示；启动环境/签名/身份与文件校验失败分开，仍保留同字节 hash/微软签名/身份校验，自动升级关闭。新增真实 CMD 三语、437/936、特殊路径、损坏/缺失包及无 PowerShell 回归。指定 ARM64 Office-Test 当前用户重新下载旧完整包实际检测成功，原截图包失败原因未确认。候选原生测试发现重定向 CLIXML 输出，现修正而不放宽断言；发布门禁继续进行，详见 docs31。

## 已完成并上线：在售商品与可视化详情合并（2026-10-06）

按用户纠正取消独立单机管理；原商品与新商品共用唯一列表及图形详情，本页核对→明确可售→销售／实际收款交付／客户回链／三语打印。原资料不可改写，原容量／识别码保持原文，未知事实不补造，旧客户定位原资料，列表和工作台仅按明确来源去重。严格门店／权限／版本／幂等事务retail.prepare，无schema／RLS迁移；必要独立专项审查完成。

最终main **2cc6c2a8f3ae1a514594162734c91d0991353a34**，基于85fce8b，28源码／测试Git blob一致、360其他blob保留；Vercel **dpl_3SRUauWSPZgG8RELSXhqTW46grC1** READY／production／main及chinatech.in、www别名一致。两域login200且HTML部署标识一致，匿名backend/state401。同SHA发布前CI **37394528634** completed／success：335业务、完整168 Linux Chromium／WebKit（12.5m）、strict TS、lint0错误1既有warning及正式build通过。main自动重复CI37395917038仍in_progress／未出结论，源码／配置与已成功同SHA一致，复用成功门禁，不声称重复运行成功。

12组隔离本地API及正式网页实际保存回读覆盖权限／跨店／伪造／冲突／并发／幂等／回滚／撤权／明确核对和可售；原JSON未变。相关双浏览器、最终原容量与旧客户回链、四宽度及截图已验收；新增容量断言首次误用region，纠正定位器保留业务断言，最终完整CI全过。正式Chrome只读核对唯一入口、81在售／48其他、直接图形详情及同页操作，1440／1024／390／375无横溢，手机实际点击只展开操作组。未提交任何生产业务写入；实体手机／弱网／物理打印机未测。

规格docs05／11，复用06／联动16及进度04同步。证据.local/retail-unified/published-verification.json、source-manifest、ci-final.json／log、production-http-verification、api-verification及.local/ui-proof/retail-unified。3121预览与3117正式本地服务已停，Chrome临时viewport已恢复；全站三语线程的根文档／修改保留。本轮完成。

## 当前实施：全站三语、排版与翻译闭环（2026-10-06）

已保留并合入最新商品main2cc6c2a；候选8ff7e69，随后补金融长词自适应和当前教程画面。3159键、静态门禁／动态系统出口、结构化故障／缺值来源、共享展示及三语强制AGENTS／06／16已实施，维护规则docs28。只改显示，canonical、客户原文与冻结快照不回写；最新统一商品业务与权限／事务不变。

353业务／翻译、TS、lint0错误1既有warning、完整174双浏览器、正式23路径×3语×4宽度552布局，以及金融断词2项五宽度、三语搜索显示词2项、接机规格保存刷新2项通过；432规格组合保留canonical。隔离localhost正式门店的保存／刷新／失败重试、回链／三语打印及角色页已操作，11组正式本地闭环通过，合成门店／账号已精确清理。教程87场景重拍、15集当前画面重渲，复用三语配音；45媒体资产／218原音频／90鼠标步骤校验、最终18播放回归及正式build通过；发布核对同SHA完整CI／main／正式域名，实际回执见.local/i18n-audit/published-verification.json。证据.local/i18n-audit/及scripts/tutorials/.work/evidence/。没有生产业务写入，实体手机／物理打印／弱网未验。根其他已完成记录与改动保留。

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
