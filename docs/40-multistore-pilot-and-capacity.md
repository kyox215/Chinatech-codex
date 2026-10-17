# 多门店独立登录、容量与免费内测

## 2026-10-17 入驻体验整改（隔离验收完成，发布中）

用户批准完整入驻、后台代表页紧凑布局、隔离验收及正式小样。候选独立于已发布main b5，源码在`.local/multistore-onboarding-20261017/source`，不混入性能或其他候选。注册/确认引导验证后创建或申请加入；邀请跨注册/新标签恢复但不自动申请；本人申请有目标店名/时间/状态；管理待审/历史独立准确计数与有界分页。新private本人投影仅auth.uid()对应记录，不放宽stores RLS；邀请与游标使用专用服务端签名key，不复用数据库凭据。

最终本地正式build gx91m8DXsLtnLJu7_9P_g：24三语四宽双引擎组合/正常单店稳定图、26项Clone Phone回归、正式CSS16条件/11资产、原请求恢复、受限审批/权限恢复版本前进、真实密码恢复及SQL/API/私有附件反例已过；Node588通过/1既有PS跳过、类型/三语/lint0错。全部原申请正常归档后待审0、历史102/5页无漏重。原Figma12具体高保真与最终PNG、各精确输入/保留RED/后续建议见[本轮报告](../ui-design/previews/multistore-onboarding-20261017.md)。完整远程CI、新private云迁移/新应用发布及正式小样仍待，不能冒称已上线或真机验收。

生产旧API P0已13:57Z按ecdf最小迁移应用，云ledger20261017135700：15表+1序列收回anon/auth，35项行数/摘要及RLS/defaults/角色/Auth触发器/函数不变。实际匿名旧REST401/42501、原正式会话读取正常；有效权限检查计入继承/PUBLIC，两客户端角色15表及序列全无权限、service_role保留。旧行与运维不删除。新private入驻迁移17124423/b914仍仅本地，云版本映射需准确记录，不盲目CLI重放。

局部切换保全/现时只读独验与既有archive/原件按范围分别留证，未完成全库恢复演练；缺失本地历史91表切换pair不作为独验依据。正式小样获三测试邮箱/最多6认证邮件/2标记验收店授权，密码用户本人填写；仍0本轮生产认证邮件/0新店。本地旧GoTrue v188不支持resend PKCE，生产v197源码支持但成功链须正式小样实测，不放宽confirm校验或冒称本地重发成功。

## 2026-10-17 最新用户决定

用户已明确要求实施方案。独立商户共用 Supabase 基础设施，业务按不可变 `store_id` 严格隔离；每人一个个人账号，可属于多店。验证邮箱后可自助创建空门店，创建者只成为该新店老板，不自动成为任何已有店的老板。邀请链接/二维码申请后经老板或获授权店长批准；不公开搜索店名加入，不共用密码。

免费内测先约20家店，每店1,000,000,000附件字节和5名有效成员（含老板），80%提醒，满额仅限制新增附件或成员。账号每日最多创建3店。先统计使用情况再定价，预留门店套餐版本、权益、有效期及人工运维调额，当前不启用支付、不发布价格、不自动清理业务或附件。

这是对旧“仅待门店授权”流程的本轮明确扩展；注册验证本身仍不赋予现有门店角色。

## 事实来源与边界

前一规划阶段云端只读查询：Supabase组织Pro，项目ChinaTech_date；数据库126,905,491字节，新系统两个schema共11,075,584字节，接机照片2张197,585字节，Storage历史附件5个238,348字节，新系统1店。它是当时查询快照，不是持续监控或当前时刻精确剩余磁盘。数据库逻辑大小不包含全部磁盘/WAL开销，套餐包含额度也不等于实际已分配磁盘。

本轮随后通过用户Chrome只读进入该项目Infrastructure，等指标实际载入后读取：已分配磁盘8GB，总占用0.46GB/6%；DATABASE 135.6MB、WAL 160MB、SYSTEM 175.5MB。当前选中Nano（最多0.5GB内存），实时卡显示CPU4%、RAM53%、11/60连接，历史摘要CPU12%、MEMORY60%、DISK IO1%；实时与摘要时间口径不同，不合成同一性能测试。费用上限已开启，磁盘上限8GB。未更改规格、上限或任何表单。页面明确提供Micro同小时价的Free Upgrade，但没有执行升级；扩店前按真实负载另核，不凭磁盘余量承诺承载店数。控制台采样/单位与SQL逻辑大小可能不同，保留两份口径，不相互覆盖。

Vercel项目为chinatech-codex；Chrome只读确认Pro套餐，正式main bcbc691/Hmt保持。详细Usage被2FA设置提示挡住，自动审批拒绝Skip，已停止且未改安全/套餐设置；详细账单和剩余流量未核。未把函数临时目录当持久附件存储。旧public及导入schema保留，不将其费用转嫁某个新商户，也不自动清理。

根为非Git复合工作区，保留接机单、无限滚动、Phone/Office等候选；已发布基线以ui-design/baseline.json及最新可核部署绑定为准。实现和本轮验收不自动修改正式baseline，未通过门禁不部署。

## 核心安全与数据契约

- 认证只证明个人身份；每次业务请求仍核会话、门店成员状态和具体能力。门店ID、Cookie、注册资料、角色标签不充当授权。门店上下文由当前文档URL及明确请求范围绑定，跨标签不依共享Cookie更改操作目标。
- 新店、首老板、默认设置、回执及审计原子创建。专用bootstrap只接受店名和原请求ID，不接受目标老板或已有店ID。每日与全平台限额在并发下执行；重放原回执不重复计额。
- 邀请高熵、摘要存储、默认7天、单人申请消费、可撤销。申请人在批准前只有本人身份、目标店名和本人申请状态投影；不得获得客户/员工/经营信息。失效、撤销、重复与并发批准不绕过限制。
- 店长只能分配自己已有且允许转授的能力；staff.manage仅老板授予，不改老板、不自提权、不停最后有效老板。人员停用是本店membership变化，不是全站accounts停用。
- 业务表/关联/审计/回执与附件都绑定store_id；共享Auth/目录/工具能力须按其原业务边界处理，不把平台管理能力给店主。服务端受限角色、RLS、函数权限、视图、触发器和成员撤权并发分别验收。
- 每店附件统计覆盖旧数据库照片、新对象和其他可写业务照片（包括整机图库）；保留历史的字节继续计入。数据库索引和共享表的物理占用只用于平台运维，不作为店主账单。
- 新文件使用私有Storage，服务器校验实际字节/内容/权限，预留、确认和取消有并发配额保护。对象写入与业务提交分别恢复；孤立状态不可成为正式引用，重试不重复计额。旧bytea继续读，不批删/覆盖。
- 满额保留读取及已有工单处理、收款、交还和必要审计；含新增附件的失败保留草稿并明确提示，不静默忽略文件。套餐降级/到期及付款不在本轮启用。
- 数据库与对象分别备份，恢复须同时核引用、字节/hash和权限；数据库备份不能冒充对象文件备份。

## 交接与验收

设计来源、复用和四宽/三语范围见[候选设计](../ui-design/previews/multistore-pilot-20261017.md)。实现owner为multistore_implementation；根独立审查权限、事务和证据。一次交付绑定本轮文件/内容hash，不能以旧测试或静态断言代替运行证明。

必须验证：开店/邀请/审核/刷新/重登；同账号双标签不同店；直接篡改store/member/entity/photo关联；未验证/待审/拒绝/停用；财务与人员权限；店长越权/自提权/最后老板；并发审核、申请消费、上传额度、撤权与保存；丢失响应原ID恢复；附件满额、历史计额、对象哈希/不可变/孤立恢复；实际受限SQL、Auth/API/Storage、浏览器四宽、三语、类型/lint/业务测试及正式build/CSS。

本轮本地候选已完成范围内验收和根独立审查；未发布。最终绑定、证据与未验边界见下文及 `.company-tmp/multistore-pilot-20261017/independent-review.json`。


## 2026-10-17 本地候选实施记录（未发布）

已实现验证账号开空店/首老板、每天3店/平台20店串行限额、7天单人邀请及申请审核、经理权限子集/禁止owner和委派staff.manage、成员停用仅本店；多店URL/header显式范围及原请求恢复。附件1,000,000,000 bytes/5有效成员默认值、80%提示及可审计运维调整。free-pilot-v1权益含开始时间/可空到期字段，无收费/到期执行。店名经settings事务同步canonical stores.name。

新接机/零售附件走私有Storage不可变原件，旧bytea/零售base64兼容计费。实际字节/hash确认、保守256KB上传预留、上传开始持久标记、取消/上传同序锁，已写孤立对象不会因取消释放额度；未提供自动删除。当前引用与权限共同控制原件GET，禁止签名URL、upsert/update/delete/copy/move。无新增service_role运行客户端。旧public schema/RPC不属于本轮全面审计结论。

可复验命令：`npm run test:multistore`（仅loopback55421/55422；保留合成夹具），`npm run test:multistore:browser`（浏览器origin显式本地HTTPS），`node --test tests/store-scope.test.mjs`。证据在`.company-tmp/multistore-pilot-20261017/`：api-flow.json、storage-api.json、retail-storage-api.json、security-integration.json、limits-integration.json、legacy-integration.json、upload-race.json、rate-integration.json、admission-security.json、independent-final.json。包括并发平台/成员限额、256KB并发预留、legacy原件重放、2连接上传取消和一次40001整事务重试、11个新增未验证账号/店长/失效邀请反例。未验证账号真实Auth登录拒绝；浏览器员工是admin预验证的合成账号，不冒称本轮已跑公开注册/邮件捕获/确认全链。

类型、lint（0错误/2既有warning）、i18n4279词条通过。全npm test542条中529通过，13失败属于既有Office/Windows版本/资产门禁，不修改该候选消除失败。Supabase-mode正式构建使用仅loopback私有环境、LOCAL_PREVIEW=false、VERCEL=1；构建副本仅next.config turbopack.root绝对路径为验证专用差异，根源码未做此补丁。HTTPS自签证书仅解决生产Secure cookie的本地传输，不降低应用cookie安全属性。

边界：新准入/写请求预算已实现，不等于所有state/photo/PDF读取流量均限额；rate反例验证SQL函数边界，独立提交由源码事务边界保障，未声称API业务rollback持久化实测。用量含采样时刻、权限过滤业务记录数；未做平台监控/增长历史/收费定价。Supabase advisor CLI因既有config不兼容未完成，不改CLI或config；实际SQL/API/Storage反例仍单列。未云迁移、部署、真实支付、外部邮件、清理业务数据或执行云备份恢复。正式发布前仍需当前生产备份/回滚与部署专项验收。


最终源绑定：`freeze.json`列77条本轮实施路径SHA256（共享文件包含已保留既有候选，非每行独占归属），正式buildId `rL3Q5JqHmycrX5oa9mOjX`，根app/components/lib与构建副本runtime差异0。编译产物只在本地3118/HTTPS3119运行。主浏览器`browser-final-v6.log`实际30通过，含两引擎/3语/4宽、双tab、原ID恢复和唯一2px正式CSS进度线。此前RED原件保留：v2查出双进度线并修产品；v3定位器误含Next路由通告；v4/v5初始化导航取消请求，v6改等待实际首读后通过；没有泛化过滤pageerror。happy加入后刷新仅申请列表保留状态，清一次性邀请上下文；happy-final-v7.log确认双引擎生成QR→登录→申请→刷新仍待审且无重复按钮→选择角色权限→审批200→员工进入该店，均通过。

`npm run test:multistore`会建立新的合成owner/A/B夹具，再运行各业务模块；浏览器happy每轮新增两个有效成员，应接新夹具运行，不对满员旧夹具放宽5人规则。直接重跑security需先storage模块恢复其当前引用；legacy模块会有意改变引用来验证旧原件不可误读。`security-final.log`保留一次不满足该依赖的fixture RED，按storage→security重跑`security-final-v2.log`16项通过。未删除或隐去原件。

候选UI索引按本地不可变Git `cf793341104f1b67054eae7aa0413d5b9deb57d9`生成并`--check`通过，输出`ui-inventory/`；这是本地复合候选静态清单。默认正式baseline `--check`因root差异变化返回inventory differs，未覆盖正式baseline或旧生成清单，也不把该失败写成通过。

根最终复核：77/77候选SHA、408个app/components/lib运行输入与正式构建副本全部一致；6个核心后端输入与独立11项HTTP/受限SQL实跑时一致。候选UI不可变Git清单再次独立 `--check` 通过。结论仅为本地候选验收通过，不是生产发布许可或零风险保证；详细结果见 `independent-review.json`。

## 2026-10-17 用户授权上线：已暂存，备份权限待确认

用户明确“上线”。独立worktree从正式main bcbc691定向抽取多门店，排除未上线打印/滚动/Phone/Office/性能候选；补receipt后台scope依赖和PDF缺/非法scope 400。HEAD 7c2ef1d3/tree c807e30e，81路径SHA根独立一致；生产build SvVc5Rwzh-V5En56VkRZh，运行输入差异0，544单测通过/1既有PowerShell skip/0失败，30浏览器和双引擎真实邀请流程过。[PR68](https://github.com/kyox215/Chinatech-codex/pull/68)已建并attach。

同项目production --skip-domain暂存BbMFUh1dN4DxBERajDwtroQ5X9Fo已READY，来源CLI上传，不冒称authoritative Git部署；双域仍Hmt/bcbc。根未迁移、promote或merge。备份客户端已官方link至同项目，自动审批拒绝SET ROLE postgres（认为未经明确授权的权限提升/读取敏感schema）；实际未执行该命令，已异步询问仅本次项目只读备份或核平台备份。不会换MCP/其他surface绕过。确认备份后迁移并立刻promote已准备build，再正常合main/Git自动部署并核最终SHA/双域。证据 `.company-tmp/multistore-release-20261017/independent-release-review.json`。

发布补充巡检发现初次freeze另漏 `local-intake-detail.tsx` 两行照片URL scope依赖，7c/BbMF发布资格已撤回，旧暂存不可promote；专业owner窄修并补真实照片读取浏览器回归，新commit/构建/CI须重新冻结。正式数据库、main与双域仍未变。

最新交接：在未执行迁移期间，其他授权发布将main正常推进至1ffdab1a/Bw6（Clone Phone下载），已正常合入而非覆盖。最终候选1d85c2c1/tree afa4a8ed/base1ff，83路径根独立SHA一致，最新22路径除package scripts定向合并外全等main；buildYIwMk0t_jcRgg_m-cj3JO、566 Node通过/1既有PSskip、4296三语/类型/lint及最终30+4浏览器过。新production CLI暂存6nJ9mshCMEiN3XAxtUdjsdCGJfbs实际READY，未绑定正式域；BbMF/4vum均退休永不promote。正式双域仍Bw6/1ff，回滚点更新为Bw6。PR68未合并；准确push39018932492/PR39018935244交接时仍in_progress，不称远程CI成功。备份选择仍待用户；没有迁移/promote/本轮main合并。完整handoff.json与根independent-release-review.json同目录，后续仅从此准确head继续并fresh核CI/main/正式域。


2026-10-17 备份授权与CI纠正：用户已明确允许本项目本次只读备份，archive 6,874,462B、2969目录项及全部块解码通过；5对象238348B按当前ETag/大小/路径与原件哈希逐件确认后复制保留，未冒称完整实际恢复。旧1d85两CI实际PDF像素时序失败179/1/32，后续门禁未跑。54faa563仅测试等待同一真实画布>100像素，保持默认5秒与原阈值；8受控绘制和2永久空白负例、源码/正式CSS各8通过。新准确CI及暂存待，不再有备份待授权问题；未生产迁移/promote/合main。当前Bw6/main1ff回滚点保持。


## 2026-10-17 正式发布完成（当前事实，前述阶段记录为历史）

- [PR68](https://github.com/kyox215/Chinatech-codex/pull/68)正常合并 main `b5bfc1b332fa59c1dcccc64024352591312165d1`，tree `c035f6a6674e901623ec587a569d35556ae3b5f4` 与验收e29be1完全相同。Git自动production `dpl_6AfK7dr4D6WuNfmau9BoNarnQnRn` 已READY，GitHub repo1241328967/main准确SHA、项目prj_FZoMRZoHsRNALz4ahEVGaXAxHOFS及chinatech.in/www两域独立核同。临时EEE曾承接迁移后版本，最终事实以6Af为准；旧BbMF/4vum/6nJ不准promote。发布正常合入已授权Clone Phone和PR70打印源码，未混入其他未发布候选。
- 唯一生产迁移：云MCP记录 `20261017095950_multistore_pilot`，对应本地 `20261016232547_multistore_pilot.sql` SHA256 `3ee762804dc0237887276f03b56ddd25291225a219195508c43aad03c4238a5f`。两者是同一已执行迁移，后续CLI对账不得盲重放或修改其他迁移历史。首次MCP过期返回后核零新对象/零ledger/零活动，才原query重试；没有重复提交未知结果。根比对11函数、10表、20policy、5trigger与已验本地全部一致，13现有业务/Storage范围数量及摘要完全保留，runtime仍非super/nonbypass。
- 私有备份位于`.local/online-backups/20261017-multistore`（目录700/文件600）：DB archive6,874,462B，SHA256 `d14e9d09fc78f5eb4ec607166db1aad8cd98d3c6decde3ce535c229af1881af8`，2969目录项及全部数据块可解码；5文件238348B按当前远程ETag/id/path/size及原件SHA逐项核同后复制，非新下载或实际完整恢复。临时CLI凭据脚本用后移除。数据库和对象引用/字节需成组恢复；新增门店后不自动降级旧app或删除新schema/对象，优先向前修复。
- 10:03Z实际容量：逻辑数据库127,454,355B，新业务两schema11,304,960B，旧维修照片197585B，零售旧照片/新私有对象/预留均0；原5个Storage对象另属历史保留。Supabase已分配8GB/磁盘总占用约0.46GB为前序控制面采样，与逻辑数据库采样不同；Vercel详细Usage仍受2FA设置提示限制未取得，未修改账号设置。每店1GB是附件权益，不是对所有Postgres行/日志的硬容量限制；增长监控、全站读取预算和付费定价未实施。
- 正式Auth公开设置只读确认注册开放、email provider开启、mailer_autoconfirm=false（必须验证）；未创建生产账号或发邮件。老板验证后开空店；员工通过7天单次邀请/二维码申请，再经老板或有授权店长审核。内测20店/账号每天3创建/每店1GB附件与5有效成员含老板/80%提醒，容量或成员满只挡相应新增；既有业务/读取/结算交还继续。权益版本/期限及operator调额已具备，不启用实际收费。
- 最终检验：Node567=566过/1既有PowerShellskip，类型/lint/i18n4296/正式Supabase build `rdeTqYJQYmCKS06FXbQ0D`过，409运行输入与build一致/86冻结路径根核同。原门店30三语四宽及双引擎邀请闭环按未变输入复用；最终4照片、44打印source、8正式CSS和9真实HTTP（6三语A4/A5单页PDF+实际像素二维码含storeId）过。合入PR70后发现空项目未报价单意语422，main等同RED已保留；只将未报价total纳入既有36mm文字金额变体，保留0/正常金额27mm、字体、内容、权限及长文溢出拒绝。6PDF字节/页数根独立核，意语A5原图已目视。
- 最终正式双域14只读HTTP过（6公共页200、8私有API401/no-store且无业务字段），无生产业务造数或邮件/支付。完整远程e29 PR39023793735/push39023791522及merged main39023856689发布收尾时仍in_progress，不声称全CI绿；1d85旧失败及54/ab6正常取消历史保留。安全advisor比原样本仅增3个默认拒绝直读INFO，既有5个public search_path WARN完全同；不代表旧public RPC全面审计。完整证据在`.company-tmp/multistore-release-20261017`，独立终验`independent-final-binding.json`、`cloud-after-independent-verification.json`与`independent-e29-build.json`。


### 邮件接入前检查（历史，已由下方SMTP收尾验收取代）

代码与迁移已上线不代表任意邮箱可完成注册。根在已认证Supabase当前项目 Authentication → Emails 页面读到明确的内置测试邮件警告；没有配置自定义SMTP。按[官方SMTP说明](https://supabase.com/docs/guides/auth/auth-smtp)，内置服务仅允许给项目组织团队邮箱发信，当前还限每小时2封，因此面向外部新店主/员工的注册验证会受阻。邮箱验证保持开启，不能以关闭验证绕过。未改变控制台设置/增加组织成员/发测试邮件。

已向用户询问是否有可复用SMTP/邮件服务，或需要接入新服务；只询问服务商，不在聊天收集密码/密钥。接入所需host/port/user/secret与发件人/验证域名由选定服务提供，秘密只进入授权的安全配置入口；域名验证/相关费用及实际邮件发送按后续明确范围处理。配置后还需实际验证邮件→安全回调→新店/邀请恢复闭环，再宣告任意邮箱公开入驻就绪。证据`smtp-readiness.json`；最终交付manifest补此实质边界。


用户已确认没有现有邮件服务、要求新接入。Vercel实时discover中Resend是适用SMTP出站邮件的产品（AgentMail为收件箱API，不适用此需求），live CLI help已确认free=0，官网额度3000/月与100/天。准备资源chinatech-auth-email、eu-west-1、auth.chinatech.in/from no-reply@auth.chinatech.in，只连接当前production。原生安装查询0、Vercel DNS现5条系统记录均未修改。创建命令被自动审批以缺少具体服务商/域名/区域授权拒绝，尚未执行/创建；没有其他方式绕过，已提交精确方案供用户明确授权。后续服务商登录或条款若需用户完成按实际页面停点交接，不替用户确认法律条款，不自动付费。`smtp-provision-plan.json`记录准备与审批状态。

最新授权：用户已明确允许完整Resend免费配置，原自动审批阻挡已解除。CLI再次确认正确项目/安装0后执行原生add，返回`integration_terms_acceptance_required`，尚未创建邮件资源。已打开当前团队的Accept & Install页面并截图留证，说明向Resend共享Vercel ID/邮箱/用量；按Marketplace技能明确浏览器停点要求及用户先前约定，将条款确认交给用户。没有代点或运行CLI提示的API accept-terms命令。后续先只读核现有安装及资源，防止重复创建，再继续同一免费配置，不自动选择付费方案。


### SMTP实施最新交接（2026-10-17）

用户已亲自完成Terms Accepted，原生add成功创建唯一免费安装`icfg_k4xhTE67jJKZvOZpV9QeHWyM`/资源`ir_3QgPfKu8oNyRph5S`，只连接chinatech-codex production；无付费升级。CLI按slug过滤会误返空，去过滤后准确核已存在，不重复add。实际Resend域名ID为`4f9775a4-df3a-4fcc-a158-04244da4ea05`，与Marketplace外部资源ID不同；首次以资源ID查询404，后仅列新账户匹配域名修正。域名/区域准确且verified，3条DKIM/SPF/MX均与VercelDNS逐值一致，原5系统记录保留；打开/点击跟踪均false。

通过官方API生成专用`chinatech-supabase-auth`，id4222ca5d-1db7-4f28-ba89-2d7c66cf006e，permission=sending_access/domain_id精确限当前域；不会将Vercel管理key复用到SMTP。3个管理/邮件读取GET实际均401 restricted_api_key，首次验证器只期望403导致断言失败已纠正并保留诊断，不是实际权限放开。SMTP_SSL465严格证书校验/TLS1.3/AUTH235通过，仅EHLO/AUTH/QUIT，无MAIL/RCPT/DATA或外部邮件。密钥仅私有目录700/文件600保存，聊天和运行源码没有密钥。

当前Supabase控制台仅准备非秘密SMTP表单草稿（sender/no-reply@auth.chinatech.in、ChinaTech、smtp.resend.com、465、resend）；浏览器新增认证凭据输入规则要求用户接手，故password未代填/未点Save，已向用户给本地私有凭据文件位置。Chrome browser4/tab409309189已保留handoff，supabase-smtp-prepared.png实际截图。保存后服务将默认邮件额度调到30/小时（页面明确提示），不改密码/会话/邮箱验证策略；下一步必须核持久状态再宣告接入完成，实际外部投递不冒称已验。


### SMTP收尾验收（2026-10-17 11:42Z后，当前状态）

用户回复已保存，根刷新当前ChinaTech_date生产SMTP页确认自定义SMTP启用且stored password存在；发件人no-reply@auth.chinatech.in、ChinaTech、smtp.resend.com:465保持。凭据由用户亲自输入，根未读取或代填。当前邮件速率真实截图为30封/小时；Resend免费3000/月、100/日，不升级付费。正式SiteURL为https://www.chinatech.in，两个正式域回调均允许，注册模板使用`{{ .ConfirmationURL }}`。公开Auth settings再次只读核disable_signup=false/email=true/mailer_autoconfirm=false，未关闭验证或修改会话/权限。

用户提供可收信邮箱并授权1封测试后，使用同一专用域名受限key，经严格TLS1.3/AUTH235及SMTP DATA250投递单封三语邮件。服务商邮件ID `01a149aa-ddbd-7163-91e1-93aad5aa3671`，随后仅按该ID查询，实际last_event=delivered；这是收件服务器接收信号，不保证用户已阅读或邮件必在主收件箱。没有重发，未创建Auth账号、门店或任何业务记录。测试是直接SMTP通道，不是新用户实际注册→验证链接→开店/邀请全链；本轮不宣称该生产整链已验。密码仍仅本地私有700/600文件及Supabase加密配置，Vercel管理key仅env run进程内读取、不下载到文件。

控制面复核正式双域仍同指Git main b5bfc1b3 / production6Af READY，没有重新部署或迁移。18个实际只读HTTP响应验证apex9条精确308到www同路径/查询，www首页/登录/注册200、formal anonymous、4私有API401/no-store无业务字段、旧MiMover APK410。首次检查器错把apex按直返200/JSON预期，先因JSON解析中止，随后保留完整RED，再对同批已保存响应按真实canonical跳转合同重评；未重复请求刷绿，也未改产品来迁就断言。

远程完整CI补核：main39023856689已failure，准确日志的24个失败均为tests/browser/mimover-original.spec.ts仍期待已撤下MiMover卡片状态，与PR69已确认Clone Phone替换不一致。该run的lint/三语/类型/Node/早期打印和消费者均过，controls后的build/CSS跳过；本地真实生产构建证据仍独立保留，不能说完整远程CI绿。branch push39023791522亦failure（本轮未另读其日志），PR39023793735最后快照仍in_progress。本次SMTP配置与实投递已完成，未扩展修改旧工具测试或其他并行候选。

证据均在`.company-tmp/multistore-release-20261017/`：`supabase-smtp-persisted.json`、`supabase-smtp-saved.png`、`supabase-email-rate.png`、`smtp-live-send.json`、`smtp-provider-status.json`、`smtp-final-http-check.json`（原误判另存initial-assumption-red）、`smtp-release-control-plane-check.json`及`smtp-ci-status-followup.json`。readiness/plan/handoff/delivery manifest已更新为配置在线且单封实投递成功、CI非全绿，不再保留“等待用户保存”为当前阻挡。SMTP配置由Supabase直接使用，本轮没有应用源码变更，未再触发网站发布。
