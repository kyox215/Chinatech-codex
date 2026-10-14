# B方案加载反馈、初始化与维护契约

用户选定原位反馈＋内容区细线，并授权实施、后续维护规范及验证后上线。基线为fresh main d32dafc20f8b37121923a3d820f23e9874a68577；独立发布分支codex/loading-b-20261014。本文记录实现边界；实际CI、候选及域名发布回执以PROJECT_MEMORY和本轮发布proof为准，未取得回执前不把候选当正式上线。

## 实现

- 根OperationFeedbackProvider按实例token登记真实活动；NavigationLink使用Next真实pending、固定单一svg.spin和原生hash/键盘/新tab语义。ContentProgress在公开header下沿、账号和后台内容上沿显示2px紫色不定进度线，无百分比、遮罩和布局位移。旧任务只能清自己的token，后台轮询不登记；兼容现有可见button/form的aria-busy，后台区域明确排除。
- 移除5个route loading和3个整机显式骨架Suspense；PageLoading退役，首访/区域读取用真实标题及ReadPending，错误紧凑就地恢复。手机菜单和账号菜单在实际路由提交后关闭。同步交互不制造等待。
- BackendProvider组件树内持有逐请求授权initial，通过各领域hook提供SSR/首次水合，不调用服务端全局configure。正式分支不读fixture/localStorage。客户端activate、显式owner release/adopt、clear后的generation隔离，以及readFor首个render的新权限投影共同保护身份变化；同scope server refresh不清原提交回执。
- 目录按身份/门店/成员版本/可见性保存旧结果，新条件等待明确标记；首次尚未activate只等待，不误报无权。订阅树内和全局scope变化，权限版更新无需focus即可重新读取。viewer state401/403/409立即撤下旧行/计数；503保留同范围已确认结果。
- 账号及登录设备普通刷新保留资料、锁住写入；身份通知立即清理，迟到请求受abort/epoch/identity保护。Office账号卡仅补入口反馈及人工读取活动，API、开关、版本、签名、授权及清理规则不变；v3人工任务读取和60秒轮询分开，密钥反馈归实际操作行。
- 失败保留输入，保存确认后才清理；现有unknown/conflict/原requestId核对重试与设备草稿链保持。读取重试不重放业务命令。

## 后续维护

AGENTS.md已要求后续新增、修改与扩展采用B方案；接口及状态适用矩阵集中在docs/06，联动闭环在docs/16。适用的默认/执行中/成功/失败重试/空态/离线/无权/冲突/未知一并核对，不适用说明原因。旧推荐整页PageLoading的活动规范已更新。三语、键盘/触控、减少动画及实际浏览器证据是完成条件。

## 验证证据与边界

- 独立审查推动修复前任Provider正常cleanup被当成身份失效，以及readFor旧成员版本借更高业务版本回显成本两个反例；实际bootstrap/client34项、preview loader相关84项通过。Node24全套498项：497过、0失败、1本机PowerShell缺环境跳过。
- 导航22项双浏览器通过：三语RSC阻塞保留正文、唯一圈、2px线、四宽375/390/1024/1440、后导航胜出、抽屉/菜单提交和Escape/焦点、hash/新tab及失败恢复。
- 本地正式组件壳直接导入发布源码，SSR/水合/换身份/撤权/clear拒绝旧initial和5领域20项通过；目录首访/水合自动读取/成员版本自动重读/viewer503保留和401撤下另10项通过。只用DEMO快照和拦截HTTP，不作为真实Auth/数据库写入证据。
- 初轮相关104浏览器为102过/2个WebKit失败，原日志保留。目录性能用例冻结后3/3通过；账号过期提示复验暴露focus自动恢复抢走重试入口，已将409锁到显式文档刷新，并新增请求计数反例，两浏览器repeat3共6/6通过。最终新head完整远程CI单独记录，不用旧结果替代。
- 静态三语通过4103键，当前类型与lint零错误（保留原client location.assign建议警告）。正式构建及新head远程CI、候选READY/来源、双域上线、实际账号只读导航需要本轮最终回执。

证据根：`.local/loading-b-release/proof`；源码内Node日志和导航截图在`.local`。本地组件壳与预览不进入发布源码，不接真实业务接口；本轮无schema/迁移/业务数据写入。
