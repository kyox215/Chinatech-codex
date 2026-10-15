# B方案加载反馈、初始化与维护契约

用户选定原位反馈＋内容区细线，并授权实施、后续维护规范及验证后上线。基线为fresh main d32dafc20f8b37121923a3d820f23e9874a68577；独立发布分支codex/loading-b-20261014。本文记录实现边界；本文件冻结在发布前；最终CI、候选及域名回执以[PR58](https://github.com/kyox215/Chinatech-codex/pull/58)、当前域名源及本轮发布proof为准，未取得回执前不把候选当正式上线。

## 实现

- 根OperationFeedbackProvider按实例token登记真实活动；NavigationLink由真实onNavigate登记最新实例token，仅当前owner结合Next真实pending显示固定单一svg.spin；旧完成/卸载只清自身，保留锚点/键盘/新tab及无JS语义。ContentProgress在公开header下沿、账号和后台内容上沿显示2px紫色不定进度线，无百分比、遮罩和布局位移。旧任务只能清自己的token，后台轮询不登记；兼容现有可见button/form的aria-busy，后台区域明确排除。
- 移除5个route loading和3个整机显式骨架Suspense；PageLoading退役，首访/区域读取用真实标题及ReadPending，错误紧凑就地恢复。没有AppShell的根级PageRecovery自行提供进度宿主；内部错误继续复用AppShell，避免重试缺线或重复细线。手机菜单和账号菜单在实际路由提交后关闭。同步交互不制造等待。
- BackendProvider组件树内持有逐请求授权initial，通过各领域hook提供SSR/首次水合，不调用服务端全局configure。正式分支不读fixture/localStorage。客户端activate、显式owner release/adopt、clear后的generation隔离，以及readFor首个render的新权限投影共同保护身份变化；同scope server refresh不清原提交回执。
- 目录按身份/门店/成员版本/可见性保存旧结果，新条件等待明确标记；首次尚未activate只等待，不误报无权。订阅树内和全局scope变化，权限版更新无需focus即可重新读取。viewer state401/403/409立即撤下旧行/计数；503保留同范围已确认结果。
- 账号及登录设备普通刷新保留资料、锁住写入；身份通知立即清理，迟到请求受abort/epoch/identity保护。Office账号卡仅补入口反馈及人工读取活动，API、开关、版本、签名、授权及清理规则不变；v3人工任务读取和60秒轮询分开，密钥反馈归实际操作行。
- 失败保留输入，保存确认后才清理；现有unknown/conflict/原requestId核对重试与设备草稿链保持。读取重试不重放业务命令。三主表单把unknown(waiting且requestId存在)与confirmed异步清理(waiting且requestId为空)的显示分开：未知显示待核对且不伪装仍在保存，锁和原ID恢复不变。

## 后续维护

AGENTS.md已要求后续新增、修改与扩展采用B方案；接口及状态适用矩阵集中在docs/06，联动闭环在docs/16。适用的默认/执行中/成功/失败重试/空态/离线/无权/冲突/未知一并核对，不适用说明原因。旧推荐整页PageLoading的活动规范已更新。三语、键盘/触控、减少动画及实际浏览器证据是完成条件。

## 验证证据与边界

- 独立审查推动修复前任Provider正常cleanup被当成身份失效，以及readFor旧成员版本借更高业务版本回显成本两个反例；实际bootstrap/client34项、preview loader相关84项通过。Node24全套498项：497过、0失败、1本机PowerShell缺环境跳过。
- 导航22项双浏览器通过：三语RSC阻塞保留正文、唯一圈、2px线、四宽375/390/1024/1440、后导航胜出、抽屉/菜单提交和Escape/焦点、hash/新tab及失败恢复。
- 本地正式组件壳直接导入发布源码，SSR/水合/换身份/撤权/clear拒绝旧initial和5领域20项通过；目录首访/水合自动读取/成员版本自动重读/viewer503保留和401撤下另10项通过。只用DEMO快照和拦截HTTP，不作为真实Auth/数据库写入证据。
- 初轮相关104浏览器为102过/2个WebKit失败，原日志保留。目录性能用例冻结后3/3通过；账号过期提示复验暴露focus自动恢复抢走重试入口，已将409锁到显式文档刷新，并新增请求计数反例，两浏览器repeat3共6/6通过。最终新head完整远程CI单独记录，不用旧结果替代。
- 实际CustomerProfileForm＋BackendProvider＋IndexedDB合成请求另4项双浏览器通过：hold等待、409保留后新提交、503待核对且锁输入、原ID原内容重试成功；只做本地合成POST。初次脚本控件定位与初始化inert时序失败日志保留，最终先等待真实可交互门解除再填入。
- 根级错误重试另2项真实组件/双浏览器通过：错误标题不替换、按钮等待、唯一2px线及结束清理。
- 静态三语通过4103键，当前类型与lint零错误（保留原client location.assign建议警告）。正式构建及新head远程CI、候选READY/来源、双域上线、实际账号只读导航需要本轮最终回执。

证据根：`.local/loading-b-release/proof`；源码内Node日志和导航截图在`.local`。本地组件壳与预览不进入发布源码，不接真实业务接口；本轮无schema/迁移/业务数据写入。

## 第二轮远程反例与修复

4751的PR完整成功，push为390/392，仍未发布。导航trace确认旧toolbox RSC完成后登录与工具箱仍各显示pending，属于真实显示缺陷，不能放松单实例断言；新增最新onNavigate owner约束并对同一链接连续点击补反例。目录采样90次真实点击耗时30.584秒，P95为103/173/91ms均过；唯一额外请求恰在30.006秒，是同scope、knownRevision=seed且unchanged=true的授权核对。性能脚本必须逐一验证该类响应，另严格断言点击触发新数据请求0，保留native RAF/30样本/200ms与独立撤权场景。最终修复仍待定向、独立审查、新完整CI及同源候选，旧绿灯不替代。

本轮最新owner修复定向验证：完整导航24过、竞争/同链接双引擎repeat5共20过；目录性能及撤权双引擎repeat3共12过，性能真实观测30秒窗口、原P95/两帧/30样本保持。独立导航CODE_GO；类型/lint/4103三语过，Node24全498为497过/0失败/1本机PS缺环境skip；正式构建通过。源码待新head完整CI及同源候选，尚未发布。

返回补查：桌面双引擎等待中Back/迟到响应2过；375手机发现实际路由已返回Dashboard而抽屉仍open，等待圈/细线已清。该UI状态不放行，de90 CI主动取消、46Z候选保留但不晋升。将对AppShell做仅路由归属的菜单状态修复，Back/Forward关闭且不恢复旧open，保留desktop collapsed及原pending保持打开规则。新最终提交仍需完整验证。

返回修复最终本地验收：AppShell仅局部drawer/account按pathname+query归属，旧事件不能关新页菜单，collapsed独立保留；summary同一受控开关消除DOM先open/state尚false的Escape时序。全导航32/32、Back/Forward及迟到RSC核心双引擎repeat3共6/6，含新实际200/2000/5000ms等待。首轮toggle反例保留；主线程独立CODE_GO，类型/lint/4103三语、Node498（497过/1本地PS缺环境skip）和正式构建通过。4份字节完全相同的本次.next-backend/types重复生成文件已备份移除，不修改类型规则。最终完整CI、候选及域名回执另记。


## 同URL刷新与页内锚点的远程反例

5fb的push完整成功（498 Node、402浏览器及正式构建），PR为401/402，唯一失败是父页hash被较早的同URL RSC覆盖。双引擎独立小实验复现：Next16.3.7同URL会刷新动态段，native hash不进入导航队列；旧刷新完成后可剥掉新hash。证据在sameurl-probe-observe-results.json与sameurl-effect-results.json。

共享NavigationLink已移除“同pathname/search即同步”的判断；完整href相等的刷新必须先观察真实pending再等待结束，URL相同不能视作回执。首页、工具箱及账号页的页内锚点统一共享Link，仍SSR输出带href的a；新hash导航可废弃旧请求。如果Next实际读取则显示真实原位单圈/细线，不承诺锚点必然零请求。新增真实同URL阻塞、hash/newtab、旧同URL响应迟到不覆盖hash三条双引擎回归。最终新head的完整CI与上线门禁仍单独取得，不用5fb成功push替代失败PR。

独立复核还发现Next新滚动处理器不转移焦点，普通Next hash会使skip链接后的Tab仍进入页头。现仅skip导航声明focusTargetId，真实提交且当前实例才focus({preventScroll:true})，目标tabIndex=-1；普通章节锚点不强制焦点。五个公开页冷载及Back后的缓存路径纳入键盘验收。

锚点及焦点最终本地：双引擎完整导航38/38，四个新增/调整关键场景repeat3共24/24通过；9路径独立CODE_GO。此前类型失败仅为4个与原文件字节相同的生成types副本，已另存hash/备份后清除，原检查规则未变。最终正式构建及新提交完整CI仍以实际终态为准。

焦点修复后的正式模式生产构建、TS strict、lint（0错/1原有建议）及4103键三语检查已通过；Node498为497过/1本机无PowerShell跳过。发布仍等待此冻结源码的新远程两套完整CI和同源候选。
