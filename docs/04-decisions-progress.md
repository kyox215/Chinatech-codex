# 决策与真实进度

## 2026-10-14 Figma操作反馈修复候选

用户已授权按原Figma补全缺失状态、修复相关闭环并上线。独立分支 `codex/ui-feedback-20261014` 基于main5826131。范围：首页／工具箱／工作台真实导航反馈、Auth核对、后台加载／错误／离线／刷新、客户分页、目录重读、下载请求提示、所有受影响提交的原requestId恢复、父子弹窗与设备草稿保护。无新主题／依赖／schema；公开Office1.3及其他发布资产保持原文件。部署状态与最终证据只以[报告34](34-figma-interaction-feedback-release.md)和PROJECT_MEMORY为准。


## Office 公开产品页与免登录介绍（2026-10-14）

用户确认精简电脑/手机设计并授权实施上线，同时要求女声视频和海报突出“新电脑/客户电脑打开网站→工具箱→下载并运行→许可确认后一键开始”。网站匿名访问和当前1.3.0独立客户端不要求网站账号；宣传保留微软许可、管理员/重启必要确认与未签名测试边界，不把未上线1.4或示意动画当实际Office验收。结构为首屏下载与一次八应用示意、短流程、紧凑视频、三项FAQ及折叠技术资料。详细验收随本轮发布记录维护。

## 2026-10-12 Office 1.2 选择安装、卸载及界面

用户确认完整预览后授权实施并上线。选择组件、兼容补装、按实际检测逐项/全部卸载；主区无滚动容器，菜单独立、按钮固定高度。恢复冻结原范围，旧任务保留明确的旧全量范围。机器级 OneDrive 不支持；真实 Windows 全流程和签名边界保留。实现与发行证据见 [1.2 记录](Office助手1.2选择安装卸载与界面20261012.md)。

## 2026-10-12 Office 1.1 界面与流程候选

先完整交互预览，后制作原生 WPF。保留实际安装器门禁并明确五分钟收尾／继续激活／缺组件修复；安装和移除不显示微软完成窗口。底部只显示可测量操作百分比，未知安装进度显示阶段／用时；三语简化界面。93核心替身、32Node、双架构严格构建、20输入核对和Chrome45状态／12布局验证通过；原生Windows1.1／真实全流程待验，未签名、未公开1.1或切官网。详[报告](Office助手1.1流程与界面优化20261012.md)与[完整预览](previews/office-assistant-ui.html)。

## 2026-10-11 Office 1.0.1 修复候选与远程实测

指定Win10 Home x64测试机用户先发起1.0.0安装，真实微软完成对话框及新鲜双SKU/意语/17932.21000/八程序检测已观察；原任务激活被安装器收尾占用阻止，后续刷新解除。Word启动及打开时阻止操作、关闭刷新解除实测；许可当时ProPlus状态2，未激活。用户已当次明确接受适用条款并授权恢复；同任务23:35:18 Completed，未重放Remove/Install，实际服务器s1.kms.cx，两SKU均已授权259200分钟；最终保存JSON读回OFFICE_READY/三个目标布尔true/许可错误为空，唯一ActivationAttempts服务器s1.kms.cx/Licensed=true/21:35:14UTC。不能将初始无Office的Removed算作卸载，也不搬用其他VM许可。

1.0.1修复安装收尾、MSI空闲服务PID有限识别、超时、失联／真实重启／未知结果恢复、窗口工作区、移除跳过及报告事实；卸载只保留范围确认及UAC，安装激活条款保持。补许可检测失败门禁，72核心替身、32Node、最新版ARM64检查器编译及双RID构建通过，18源/PE/SHA已独立复核通过，当前真实1.0.1 Windows GUI／全操作待验、未签名、未公开更新。候选PR46已draft/attach，HEAD35d51b12，同SHA push38178137643／PR38178148934完整CI均success：72Core/18发行准备/438Node零skip/320浏览器；fresh main及正式两域仍deeb/原生产。授权仅公开prerelease六测试资产供新VM运输，main/官网暂不切换，Windows验收仍pending。详[开发与虚拟机记录](Office助手1.0.1开发与虚拟机测试20261011.md)。

2026-10-12 00:16八项启动检查：Word/Excel/PPT保存三合成文档；Access主页、OneNote实际编辑器通过，Outlook classic邮箱设置／Skype企业登录／OneDrive未连接面板均实际显示。未使用个人账号，不当邮件／通讯／同步验收。Skype关闭窗口仍lync后台，托盘Esci已正常退出，fresh Refresh四操作按钮实际解除。两次自动审批拒绝不明确坐标（Skype设置菜单、OneDrive面板外点击）均未执行，已用明确退出／Esc安全替代。详 `.local/office-remote-test-1.0/eight-app-startup-evidence.json`。

2026-10-12 00:25：仅公开1.0.1 prerelease/latest=false，tag35d51，六资产公网HTTP200/大小/SHA6/6与原字节匹配；现有Latest仍0.2.1，main/官网仍deeb/1.0。tag38180056603成功、完整38180056650运行中。客机用Edge准确下载1.0.1，今日文件ChinaTech-Office-Assistant-x64 (1).exe被浏览器“可能损害设备”拦截；按电脑操作规则已markHandoff并一次async请用户亲自处理警告、确认新版首次运行及新卸载／安装／激活／重装和适用条款，尚无答复。根未点击保留／绕过、未执行新版、未在客机核新EXE SHA。详 `.local/office-remote-test-1.0/new-candidate-handoff.json` 与发布侧 `public-release/notes/published-release.json`。

## 2026-10-11 Office 1.0 公开测试版上线

用户明确“上线”，已公开1.0源码与双架构EXE，官网切换新版下载。main正常FF同两完整CI已验deebc7b、PR45 MERGED；Release office-assistant-v1.0.0为prerelease/latest=false，六文件公开完整下载SHA均匹配。生产dpl_4QXVDBvRKWTvgdip3Uhsc8eHgdg5为同SHA/Git/main/READY，两正式域名alias通过，10只读HTTP检查过。两个发布前CI各438 Node零skip/320浏览器/34模拟Core/双RID及Windows检查器编译/PS5.1解析/三语3663/类型/lint/build成功，main第三次完整成功；tag初轮319/320，旧零售WebKit交付用例失败，原用例独立repeat3全过后仅失败job重试一次且完整成功320（22.3min）。四相关CI最终success，初轮trace/log/state保留；14相关旧业务/test blob与生产基线相同，滚动点击时序方向未定性为根因。

发布范围31路径、806原blob保持，其他未发布Android改动未夹带；旧后台/API/catalog/SQL及准入0.2.1保持，无业务写入。软件未签名、releaseReady=false、实际Windows验收pending，本轮没有运行新版GUI/Office操作/系统重启。正式浏览器首次21场景及4次下载过后WebKit账号状态请求报错，保留失败；干净375三语3/3及真实锚点通过，24唯一场景已覆盖、4实际下载全匹配，首次错误根因未确定；最终CI结果见[上线记录](Office助手1.0上线记录20261011.md)与.local/office-1.0-release/。

## 2026-10-11 Office 助手 1.0 全面重构候选

最新用户选择全面替换旧桌面实现。已完成独立 WPF/本机提权 worker、固定 ProPlus2024Volume+SkypeforBusiness2024Volume/64位/八项应用、独立安装语言、微软 ODT/签名 OneDrive/固定媒体及哈希、本机受保护日志与锁、取消/失败/重启恢复和实际产品/组件/许可核验；三语174词条。网站服务器选择在确认与执行之间冻结，默认值由网站公开接口读取，备用k.302.pub。替换全部旧Office含Visio/Project，文档及OneDrive账户不列入移除范围。注册表重启标志仅建议，实际安装器重启检查点须Windows重启后恢复，不能新任务绕过。

双RID严格构建及PE/EXE/输入一致性通过；34核心模拟、30 Office Node、18旧发布工具回归、SYSTEM身份的Windows原生15检查通过。独立确认/执行与恢复接线只读复核完成。当前真实VM LYNC仍缺，检测没有伪报八项完成；不属于本轮安装或用户实体机证明。0新版GUI/UAC/Office操作/系统重启/生产写入，3261临时传输已停止。交付包未签名、releaseReady=false，完整Windows验收待首次运行和条款的当次确认；官网仍0.2.1。旧30源码本地归档，不参与新程序；既有生产后台保持。详[交付报告](Office助手1.0重构交付报告20261011.md)和[本次验证](../.local/office-rebuild-1.0/verification.json)。

## 2026-10-11 Office报告与验收条件复核

更新[Office功能与操作优化报告](Office桌面助手下一步优化报告-20261011.md)，以当前0.2.2本地候选为范围，区别已有能力、实际待验和建议功能。48源输入与已验冻结相同，没有软件源码变化或新测试/构建。新鲜普通用户诊断仍六程序存在、Skype LYNC缺；只读许可states=[1]、已许可且keyPresent，0调用激活/权益证明。独立限定复核无新mustfix；同一Skype修复范围、客体输入和合法未许可测试条件连续待答，核心准备/实现已完成，当前完整实际验收无可安全推进的下一步。持续迭代目标未完成，阻塞条件满足；本轮无Office操作、生产写入、发布或恢复。[当前复核证据](../.local/office-iterations-20261011/round29/verification.json)。

## 2026-10-11 Office独立附加应用文件基线 Round23

修正已登记Skype/Visio/Project缺文件却被过滤出保留清单的问题：安装/卸载/重装的GUI预检与runner独立基线门禁、匹配位数双目录/根到叶路径、原全部present路径保护及操作前重查；activate原范围保持，三语同步。38输入冻结与根一致，候选runner7a47e216…647117、旧7f040/已发布65061保持；双正式各909 macOS CLR/PE、30Node/静态三语、实际Windows88过。当前VM缺Lync的最新候选诊断/新旧CLR对照/冻结主流程两场景inspect阻止、禁止Setup替身0，非Office或UAC执行证明；六EXE/三测试文档SHA及实际SKU/语言/文件观察保持。独立复核通过，测试入口重复类型失败保留后修正。08:54:31UTC健康无Office任务/marker、防护开/传输停，仅旧GUI；CUA输入未改变窗口，没有UIA输入或新会话网关。Skype仍未修复，完整语言与实际恢复待验，未签名发布/生产变更，goal active。详[报告](Office桌面助手优化报告-20261011.md#独立附加应用文件基线round23)。

## 2026-10-11 Office独立安装语言 Round21/22

本地候选新增独立安装语言，确认清单/任务/历史同一捕获值，界面语言切换不改变选择；三语同步。历史是确认请求，不表示实际安装，旧字段未知、非法导出值安全投影。36输入冻结与根一致，双正式各803 macOS CLR/PE（RID重叠）、30Node/3829三语静态过；Windows实际九组XML语言计划及最新候选只读诊断过，未执行GUI/UAC或ODT。仍单选ProPlus语言，完整既有语言/附加产品/组件计划待做；Skype缺失未修复。runner7f040不变、R15证据复用，未签名发布。R21安全日志进一步定位条件包/配置转换但根因仍未知；长传输失败保留，文件SHA调用成功。08:30:59UTC健康无Office任务/marker、防护开，传输停、旧GUI保留；本轮Office操作0，生产未变，goal active。见[报告](Office桌面助手优化报告-20261011.md#独立安装语言与请求闭环round2122)、[验收](../.local/office-iterations-20261011/round22/verification.json)。

## 2026-10-11 共同语言实际实验 Round20

有独立计划复核及微软ExcludeApp语言规则依据，将两个现有SKU都明确en-us/zh-cn；实际给ProPlus增加中文，版本/位数/首语言/产品范围/不激活设置保持。新快照ca6dc317…bcc74，原快照保留。两ODT exit0/212.9s，但新活动排除仍含Lync、文件缺失，整体failed；205前置/媒体/保留断言不能代替成功。语言补齐不足以解释唯一根因，停止重复XML。

测试器补独立finally保留核验，主断言失败仍核六签名EXE/SHA、三冻文档、OneDrive及R16/17原结果/32媒体，全部过；真实普通用户三Office只读内容/SHA与最新冻结候选未提权双语言刷新过。服务安全投影定位Descriptor::GetApps排除，旧disabled-by是TeamsAddon，不可误归Skype/ARM。34源码/7f040保持，未发布。08:06:53UTC健康无Office任务/marker、防护开启、3259停/3258无，仅旧GUI4880。详[报告](Office桌面助手优化报告-20261011.md#共同语言受控实验round20)、[验收](../.local/office-iterations-20261011/round20/verification.json)。

## 2026-10-11 Office真实产品诊断

本地Round19新增只读产品/文件诊断，三语区分登记与实际文件、空列表与读取失败；根/活动排除差异显示，数据变化作废，无权限/runner扩大。34输入与根一致，双正式各355（含96新反例，macOS CLR+PE）、30Node/三语静态过。真实ARM64 VM最新候选SYSTEM12核对与同账户未提权检测过，六文件存在、Skype Lync缺失准确；不当GUI、启动、签名或权益验收。R18只读日志/媒体根因尚未定位，无第三次安装。原失败保留，收尾无Office任务/marker，防护开，私有传输停；只保留旧GUI4880，未发布。见[最新报告](Office桌面助手优化报告-20261011.md#本轮真实产品诊断验证)。

## 2026-10-11 Office真实ODT保留复查

Round16/17实际微软同版本ODT：Skype-only及完整语言双Product两方案/download和/configure均exit0，但实际LYNC仍缺失，原门禁判失败。六原EXE、三冻文档、OneDrive保持，真实Word/Excel/PowerPoint只读内容读回过；这不是新助手操作或Skype可用证明。ActiveConfiguration真实切换，观察改为动态GUID；根排除与活动SKU排除不同。测试器独立复核修文档锚定/证据所有权/配置复核/持久化错误，旧失败及媒体不覆盖。助手R15/30输入保持；停重复XML，先研究实际应用选择/固定媒体，不定性ARM不支持。未发布，goal active，见最新报告。

## 2026-10-11 Office取消结果持续迭代

本地Round15明确可选布尔卸载检查点、历史/当前检测分开、新任务隐藏旧提示及MSI兼容提示，报告新增历史结果摘要。候选022 runner7f040…0cb1，已发布/v1仍65061，b532旧归档不覆盖。30输入冻结与根一致，双正式各259（macOS CLR+PE）、30Node/三语/类型/lint、实际提示/导出26过；Windows71及实际PS流程8组+C#同组读回过，Office边界替身，真实取消后卸载状态未验。首次排序夹具失败与健康固定文件名问题记录保留并修正，不改环境保护。无本轮Office操作/发布；后续实际保留应用基线、ODT故障及系统恢复仍待完成，见最新报告。

## 2026-10-11 Office系统恢复持续迭代

本地Round13/27输入：系统恢复只读三态衔接GUI、本地归档确认前后复查、报告状态/时间、执行器标记CreateNew取得所有权后才清理。防止系统保护被漏查和准备期间新记录被覆盖/误删；不加自动系统删除或重装。双正式各231（macOS CLR及PE）、30Node/三语/类型/翻译lint、导出20、真实Windows文件权限/junction及提取归档方法22exit0通过；确认是合成，真实界面仍待验。两次探针夹具失败保留并定向修正，不提权、不改系统安全设置。最终DEV自身普通令牌只读固定系统路径返回absent，Office操作0；生产0.2.1未变。详[最新报告](Office桌面助手优化报告-20261011.md#最新系统恢复迭代)。

## 2026-10-11 Office诊断与报告持续迭代

本地0.2.2、生产仍0.2.1。最终Round9/26输入与根一致，runner b532不变；同源双正式RID各218CLR/元数据/开发类排除、30Node通过。新增首次失败/服务失败/恢复状态统一导出条件、时间与错误记录；历史/当前事件仅导出已知stage/code/time，8合成秘密投影反例通过且不改原历史。只读许可查询真实暴露模块加载顺序失败，按固定Management→Utility→CimCmdlets修正；最终候选自身在专用VM当前用户返回licensed/keyPresent=true，无激活/安装/卸载，不证明权益。

实际首次失败GUI导出按钮启用，但CUA未触发保存；原生UIA测试方式待用户回复，新许可GUI/三语未验。故障测试器PS5.1解析及20原子替换通过，三文档数组处理修正；真实预检发现既定路径无LYNC，保持门禁停下，没有真实ODT故障注入。历史“Skype保留”只可认作SKU保留，缺失时点未知；后续需真实文件/启动基线。外层wrapper不传播失败exit的问题已修正。没有发布/数据库/保护策略变更，见[最新Office报告](Office桌面助手优化报告-20261011.md#最新诊断与报告迭代)。

## 2026-10-11 Office 0.2.1 正式发布

未提权管理员误判已修复并上线，执行权限/UAC/同账户绑定仍保持。main67b81c3、原生构建9270de7，双EXE完整官方与官网下载SHA通过；生产启动允许、verified/minimum均021，真实管理员暂停恢复/保存刷新通过，旧有效会话保留原到期。436单元/320浏览器完整CI、23实际SQL、42真实HTTPS及正式VM双RID启动/三语/取消/报告/单实例和冻结020更新页通过；Office操作0，实体x64/标准账号/真实Office及许可未验，EXE无签名。新.vercelignore排除本地测试和缓存，实际811源文件核对通过，错误候选已移除。证据PROJECT_MEMORY与交付/Office桌面助手-0.2.1-20261010/正式发布验证.json。

## 2026-10-10 Mi Mover 原版热点与公开读写候选（本地）

保留原UI/四分类/安全/协议/恢复，45712 SHA `de8b0c24d755477fd5362f396e524da1904c7747226d689bf1e42b13fe320a71`。非MIUI/API26+真实公开热点/AP地址/手动Wi-Fi网关/SSID端口种子适配；原Os.splice被系统拒绝已确认，成对选择原公开read/write支路。45711小图双AVD原完成/DCIM SHA/图库通过；45712实际旧进程停止后同AP保留并原103重监听，冷首页恢复仍未通过、原120s状态9已观察。29原方法/2930其他payload保持独立审查；最终同SHA正常100677700B图完整原发送/DCIM SHA/双完成/图库9项、原UI12/真实热点9/WiFi失联15/受控缺回调5、Apple真实绘制/内存解码/AP地址端口均通过。STA开启另次健康，竞态未重现，缺地址reservation超时仅静态。23品牌系统研究环境实体均未验，不替换公共45708、不宣称全部品牌可用。详[原版记录](mimover-original-restriction.md)及[品牌矩阵](mimover-brand-system-matrix.md)。

## 2026-10-09 Mi Mover 原版入口解限（已上架修正）

用户纠正只开放原版新机入口，原lab2公共入口/文件已撤回。新包仅原h2局部指令与安装清单两属性修改，无新增DEX/自有页面/分类/协议/恢复；原系统权限与热点/还原限制保留。原Android16入口11项通过，完整原协议迁移和品牌真机未验。

正式main正常FF至0ef3db8958fdf205fef17bb04b6237e55a7bedc0／PR41 MERGED，精确完整CI37951217886 success；production dpl_5ipMmXa5xezZdNXCVHTT7nBJxSzy READY且两域同SHA。正式30双浏览器三语四宽/全文APK/Range/无JS键盘与28两域HTTP通过，旧lab2全URL404、3其他工具代表下载原hash保持。29限定路径/774无关blob/25其他资产保留，不写业务DB；静态与原入口冻结公开证明保持原内容，正式验收独立记录.local/mimover-original-only/published-verification.json。入口https://www.chinatech.in/toolbox/transfer#mimover-original；详[原版最小修正规格](mimover-original-restriction.md)。


## 2026-10-09 Mi Mover lab2跨品牌传输（历史已撤回，超出用户范围）

用户已要求继续实现并上架工具箱。保留原实际页面，以公开网络/SAF/TLS/双确认/持久回执驱动真实选择、传输与恢复，不使用厂商私有备份权限或品牌身份伪装。支持同lab2两台Android8+选择新/旧，媒体、VCF、普通ICS及base+split安装确认；私库/登录/聊天/短信/通话/完整重复日历不支持。双Android16 ARM64合成网络/provider/系统安装与选择状态已实测，精确范围/失败与真机限制见[兼容研究](mimover-universal-compatibility.md)。网站ready下载候选/三语/哈希/原页面、说明与恢复结果一起验收，旧包与其他候选保留；发布和现场手机结果分别记录。


正式入口：https://www.chinatech.in/toolbox/transfer#mimover-universal 。main正常快进1009049ea644855cf494cfc75523afa23c40bb34／PR40 MERGED，93限定路径、697无关blob及25旧工具资产保持。精确两次完整CI37928959933与37928966550 success：420业务零skip、318双浏览器、3627三语、TS/lint0错1旧warn/正式build。production dpl_H5mQziPwSg8ELUWmVy2TFTp1eTBL READY，两域alias及HTML部署ID一致；正式28三语四宽双浏览器、完整下载/SHA/Range/无JS原生键盘与14两域HTTP通过，代表中桌面/意手机图已看，原Smart Switch lab4与ChinaTech0.3实际下载原字节保留。自用5590/5592已精确停止，3227也已按工作目录精确停止并核实端口无监听；没有正式业务写入。此前缓存旧预览5失败、最初无JS点击2失败与旧PR零售WebKit1失败均保留，未放宽断言。网站和模拟器通过不证明品牌真机，LOHS本轮SYSTEM_2限制继续有效。

## 2026-10-09 ChinaTech助手0.4接收提速与恢复（本地，未发布）

按用户最新选择取消正常文件保存后的整文件重读，保留流式完整性、写入关闭和持久回执；新机一次选择后接续媒体/本地联系人/普通ICS/APP系统确认队列，已有或编辑数据不覆盖。部分、失败和仅存档分别报告，私有应用/登录/聊天/完整重复日历仍不支持。原生验证、平台边界与交付见[0.4规格](android-assistant-v4-restoration.md)和PROJECT_MEMORY；本轮无网站部署/客户手机/后台写入。

## 2026-10-09 Mi Mover 原新机入口开放（本地实验，完整通用未实现）

用户要求 OPPO／Motorola／Samsung 等均可作新机。4.5.7.5 原 APK 的 MainActivity.h2局部MIUI分支已改为原双卡入口，全局系统身份／权限／原引擎保持；原资源和native／其他DEX原字节，自主Application补受影响两页中意显示与无障碍。原包名与并存独立签名lab1均构建，只有并存精确APK在非MIUI Android16 ARM64实际安装，且保留官方样本同机。13三语入口／新机导航／返回／冷重开检查通过，v1/v2/v3／ZIP对齐／原payload与9165类比较通过。没有品牌真机、ARM32／旧API或完整迁移证明。

原接收引擎已实际复现系统热点配置SecurityException和Wi-Fi切换拒绝，深层接收权限／厂商还原／并存硬编码仍未适配，所以只交付入口实验版，不上线或标为全品牌通用完整版。范围、当前证据和下一步见[Mi Mover兼容研究](mimover-universal-compatibility.md)与交付/MiMover新机入口开放实验版-20261009；工作证据.local/mimover-universal/verification.json。原公开APK／网站／业务数据库未修改。

## 2026-10-08 Smart Switch lab3已发布（真机待验）

三星APK内自有通用通道，标准/并存两版本保持旧3APK与README/SHA字节，原资源与厂商APK研究不冒称品牌实机。Android16严格TLS/两端文件/最终回执/相机帧/启动实测与86JVM分别记；LOHS SYSTEM_2失败保留，HONOR实机未验。规则/能力详[兼容报告](smart-switch-compatibility.md)与.local/smartswitch-universal/frozen-artifacts.json；下载三语/版本/SHA/文件/README与操作边界一起发布，不接业务数据库。

正式main695f6c612b09aaa496f982d66fd71534e6593659／PR35 MERGED；同SHA两完整CI37821567640与37821574208成功：417unit零skip、290 Linux双浏览器、3590三语、TS／lint0错1旧warn／正式build。production dpl_Ha2r2oeatNwTnbWqLwWAq9Br3AGk READY／main，两域alias及HTML部署ID匹配；正式14HTTP＋30双浏览器三语四宽／双APK真实完整SHA＋Range、旧5文件原字节通过，代表截图已看。11限定路径（原9发布路径＋2夹具）／其他563blob保留；认证生产源码未改。早期截图尺寸、滚动重试、冻结／真实时钟测试失败保留并分别修复，未放宽断言。入口 https://www.chinatech.in/toolbox/transfer#smart-switch-experiment 。源／原生／预览／正式证据 .local/smartswitch-universal/published-verification.json；自己3211／3212及2AVD均停。HONOR真机、光学扫码和全部品牌恢复仍未验。

## 2026-10-08 荣耀二维码：lab2已上线，真机配对／恢复待验

HONOR Magic8 Pro BKQ-N49／MagicOS11现场QR等待，源码确认真实P2P MAC依赖与无截止、另三星私有设置action无反馈。lab2有限前台回退原MANUAL流程＋标准设置／三语提示，同View／成功／生命周期旧timer保护，保持MAC／权限／协议及三星原Intent行为。实际候选SHAc5e60fd／PR34，7路径与其他563blob保留；APK41941787B／SHA69156181…df1ac8，同lab1签名／build+1。76策略／24接口、独立审查／签名／DEX、28本地网页／无JS下载、23保护预览验证已过，完整同SHA CI37777684864通过417unit／288Linux浏览器21.3m／strict三语类型lintbuild；正式main c5e60fd／PR34合并／production dpl_2T6R9FZFUfjdXspSVBZ9tWrFT3gb READY与两域匹配，正式28浏览器＋8HTTP下载SHA／Range／旧包／三语说明通过。重复PR CI旧站恢复失败，原代码保留，同case成功CI与Mac3/3通过，Linux原因未明，失败证据保留。自己3210已停。不能称QR已能跨品牌扫码或原生恢复已验。详见[兼容报告](smart-switch-compatibility.md)与安卓规格第15节。


## 2026-10-08 数据传输下载入口正式上线

按网站发布要求及用户确认的三星修改版分发许可，main a65df1c／PR33 MERGED，17路径快进保留552其他blob；两同SHA CI全部success（417单元／288 Linux双浏览器／3558词条／TS／lint／正式build）。Vercel dpl_7nii34dzFkP15J9wRXayPiJNYn5V READY，两域及HTML部署ID匹配；官网28三语四宽度／锚点／实际下载和7HTTP／全文SHA／Range通过。仅发布软件及公开页面，未运行手机软件或迁移客户资料。入口[工具箱数据传输](https://www.chinatech.in/toolbox/transfer#smart-switch-experiment)，完整证据.local/smartswitch-web-release/published-verification.json；原生状态仍见第13节。

## 2026-10-08 Smart Switch 接收入口 lab1（本地交付，未运行）

用户“开始反编译 制作”授权后，已制作3.7.73.4局部接收入口实验APK。仅h0一条UI选择指令原布局替换；真实品牌／launch_mode20／权限签名配套服务保留，listener4/5与Sender/Receiver、来源选择已静态核对。DEX同宽／长度／其他字节、最终6894类反汇编、1738payload、v1/v2/v3独立实验签名／16KiB对齐／Manifest原字节通过；两轮独立补丁复核通过。

交付`交付/SmartSwitch接收入口实验版-20261008/`，41708257B／SHA7daa79ef…697de1，三语说明／验证／SHA／自主补丁脚本。它不是官方包或完整跨品牌迁移版；同包名异签不能覆盖官方，尚无安装／运行／客户资料迁移／部署，ChinaTech0.2包未变。细节[第13节](android-phone-assistant.md)，证据`.local/smart-switch-experiment/verification.json`；下一步待两机信息后合成资料分层验证。

## 2026-10-08 Smart Switch 下载与静态可行性研究

用户要求尽量仿三星，研究拆包取消品牌限制。已下载官方商店列示3.7.73.4对应的公开镜像并核对41683681B／SHA、v1/v2/v3签名；不是第一方二进制证明。JADX官方工具哈希核对；批量反编译52错误，关键f1／MainActivity定向simple成功。独立只读复核品牌参与主界面／默认角色及助手包条件，系统权限／签名／可选库的证据范围；取消应用分支不继承系统授权，完整非三星接收未实测。

详细事实、证据局限和P0–P3跨品牌自行实现计划见[安卓助手第12节](android-phone-assistant.md)；研究证据`.local/smart-switch-research/analysis/findings.json`与verification.json。当前只完成研究／规划，没有修改、重签、安装或运行三星APK，没有改0.2交付、迁移客户资料或发布。普通资料恢复与APP安装是后续实施，不能当成本次已有能力。

## 2026-10-08 安卓0.2扫描与持续传输（本地完成，未发布）

按最新用户决定，新机创建热点／接收，旧机先扫描授权资料、分类或分页选择再加入发送；去10000总数和已批准2h截止。SQLite磁盘索引／回执、原字节、不覆盖、目标重读hash／最终count+digest；已完成对象可重验跳过，未完从头，无字节续传。APP仅所选base/split自定义ZIP，contacts基本VCF，calendar非重复ICS＋原字段JSONL，安装／复杂还原与私库未实现，scope不足明确保留。

独立审查的pending永久阻塞、tree中断假完整已修并复核；持久residual保留未知不假删除，新写安全继续；scope原子begin/finish及手机重扫重置。SDK实际构建、168JVM／30桌面SQLite（10017项分页选择迁移回滚）／134资源，417单测416通过1旧环境跳过，3705三语，lint0错1旧warning、隔离正式严格构建、最终26双浏览器三语四宽度和APK字节下载通过；实体Android未验，没有发布／客户操作。交付50源码文件、389823B APK，汇总`.local/android-assistant-v2/verification.json`；详规[安卓助手第11节](android-phone-assistant.md)。旧0.1仅历史。

## 2026-10-08 安卓手机助手本地热点 alpha（本地完成，未发布）

接受用户最新要求：APP在两机局域网传输，源机创建LocalOnlyHotspot，目标助手请求加入；API29起系统确认＋指定Network，旧版手动Wi-Fi备用。公开网站提供下载和兼容／权限规划，不接收手机资料。三星Wi-Fi Direct为官方参考，第三方不能保证静默首次连接；原生HarmonyOS NEXT不支持当前APK。

已编译0.1.0-alpha真实APK并提供源码与三语说明，SAF原文件＋基本联系人VCF、TLS pin／两端确认／目标新建不覆盖／重读hash。独立审查缺口已修，父核差异补旧版配对位置权限及普通网络权限。115纯JVM断言、95原生词条；网站415单测通过／1旧环境跳过，26双浏览器三语四宽度与字节下载通过，三语检查／lint0错1旧warning／隔离正式模式严格构建通过。证据`.local/android-assistant/verification.json`，详规[安卓手机助手](android-phone-assistant.md)。

尚无Android运行／实体手机验证，无生产或客户操作；本版10000对象／批、会话2h，无字节断点或退出恢复。全媒体／完整结构化资料／APP／SMS等按B–F分阶段；实机热点、生命周期、SAF、系统导入与跨品牌必须验后发布。安装包只用本地候选签名，不作生产更新身份。

## 2026-10-08 UI 状态与操作闭环（本地完成，未上线）

研究三篇笔记并修复公共按钮／候选／空态、后台等待与手机菜单、错误／离线／404恢复；照片、商品确认、设备保管、售后建单和采购弹层补齐提交互斥及失败重试；到货成功清本次事实、只读客户入口门控、缺值／照片错误三语。全部沿原provider／API／权限／版本及原请求恢复，不改变财务、库存、签署／销售快照或数据源。

隔离Node24：409业务通过／1原PowerShell跳过；264唯一浏览器用例通过（完整首轮＋必要定向复验合并）、48状态专项通过；3600词条、TS、lint0错误／1原warning、preview及formal配置生产build通过。正式配置仅无效占位凭据，本地公开404实际两浏览器三语四宽／HTTP404／返回首页通过；没有生产认证DB闭环或部署。六个本地性能样本与限制见[审查33](33-ui-states-and-closure.md)。证据.local/ui-state-audit/verification.json、source-manifest.json及日志／截图；先前失败保留。源码根无Git，同期设备目录／Office改动保留。真机相机／签名／物理打印／真实业务写入未验。


## 2026-10-07 共享品牌型号目录候选

2026-10-13读取与交互修订：按用户确认改为连续品牌→系列→型号，当前类别精简索引预取、会话/成员/后台代际与目录版本失效；GET合并原授权事务，品牌全类别、候选ID、超限与精确空系列读取同步。实施、独立复核及当前运行证据见PROJECT_MEMORY；只在完成发布核验后记录上线。

用户批准全站公用、后台维护＋Excel导入导出、全部现有类别、电脑按系列／代际／机型码、欧洲优先与历史保留，仅指定目录管理员。普通成员可查／手填。API／RLS／Excel及共享选择器已实施，本地合成端到端已验；原业务快照保持。正式独立私有表迁移已应用，3476条首批资料已一次性导入；指定维护账号按用户“我当前账号”绑定，经正式后台确认与唯一有效店主及既有Office管理员一致。站点发布进度与运行时证据见PROJECT_MEMORY；目录不是销量榜或全球穷尽清单。详细证据和边界见[共享目录32](32-shared-device-catalog.md)。


## 2026-10-07 Office 桌面助手第一版（本地候选）

按“开始实现”完成Windows11 x64/ARM64自包含EXE、在线使用密钥与后台管理、AES-GCM任务包、四动作分阶段执行、三语报错建议和脱敏报告。专用VM真实ODT安装6应用通过，正确INSTALLED_UNLICENSED；使用密钥与Office许可证分开，未设置第三方KMS。真实本地Auth/API/RLS8组、双浏览器三语四宽28项、5加密/21跨语言/20PS反例及Windows原生执行器保护通过。正式二进制固定官方服务且排除DEV类，未数字签名；交付在交付/Office桌面助手-20261007，网站新授权后台/迁移未上线。同期工作使当前全仓词条门禁未过（最新账号状态模块2项）；保留其他执行者改动，不宣称全仓CI或生产闭环。详情见[桌面助手规格](office-desktop-assistant.md)。

## 2026-10-07 Parallels Office四流程修复（候选，未发布）

重复“需要重启”误报已定位并修复：保留真实Windows更新／Office替换的重启检查，无关文件清理队列不拦截、不删除。指定隔离ARM64 Windows副本有38条队列时，签名CMD与PowerShell入口均exit0，原队列不变；45原生无害断言、8实际下载／哈希／撤销拒绝分支通过。旧VSTO Runtime误识别和原生退出码句柄问题也已修复；真实首次卸载3010保持success:false，没有把第二次幂等exit0冒充第一次成功。

Word／Excel／PowerPoint通过真实COM创建、保存、重读；两终端实际激活及独立ProPlus／Skype许可状态1已验证，LYNC仍缺，不是完整成功。默认八组件保留，网页新增显式不含Skype变体，ARM含Skype在下载／卸载前停止。七组件实装与新激活复测被自动审批拒绝，副本另有桌面助手审计恢复，无Office现状及保存快照已核对；待用户确认独占、副本七组件及具体KMS信息传输。

启动器TEMP校验／执行竞态改为同一内存byte[]校验、解析和执行；19Windows无害回归、独立只读复核、Office9实际路由、395Node／1既有skip、三语／类型／lint和正式构建通过。GUI、正向完整双终端矩阵、重启后许可、最新main融合和旧视频同步尚未闭环。按用户要求未提交／推送／部署。详细证据见[Office控制与实测](31-office-command-control.md)，执行状态见PROJECT_MEMORY。

## 2026-10-07 Office 命令整体开关（已上线）

公开Office改为签名联网启动器，指定管理员在账号设置管理全站开关；关闭后拒绝获取，重开必须生成新命令。保留原四脚本字节和现有视频／登录设备。服务器实时验证会话/管理员/同源/身份范围/revision/幂等，私有表强制RLS，运行角色不能改管理员绑定。已复制旧静态命令和已下载/执行脚本不能召回。

main f8ffa230cbd6fdde7545cd697e8b9803eb2b14ad、PR27 merged、Vercel dpl_Fyq1u8buZ4ZtLce2RUFUAQUpWsLo READY/双域名；同SHA完整CI37642982270成功（384unit/216双浏览器/3371键/类型/lint/正式build）。独立权限/融合复核通过。本地真实Auth/API/SQL/会话反例、48三语布局、54相关UI、24PS语法与无害脚本检查通过；线上真实管理员开→关→开及122HTTP已验证旧403/重开旧410/新200及脚本SHA、跨源/篡改、静态404/no-store。当前开启version4/revision3。未执行Office/Windows/KMS，无业务记录或外部消息写入。详细行为见docs31，当前证据与限制见PROJECT_MEMORY及.local/office-control。

## 2026-10-07 Windows工具箱检测候选（完整升级未完成、未发布）

用户选下载启动器、包含不受官方支持的硬件、覆盖7／8／8.1／10／11含Home、原KMS本地模拟和核对后确认一次。新增公开 `/toolbox/windows`、三语检测ZIP／源码／哈希与分类入口；只读检测无系统写入／远程执行，执行门禁固定关闭。

AveYo最高23H2且auto不等待安装结果；KMS `/m /w`仍涉及授权hook、安全排除及可能影响已有Office清理，不能直接串成保留数据万能升级器。完整媒体、Pro转换／桥接、重启恢复驱动和Windows验收未完成，Mac parser与网页测试不是完整实施证据。详见[Windows检测与升级边界](31-windows-toolbox-upgrade.md)。无发布／生产业务写入，保留其他任务修改。

## 2026-10-07 Office微信推广与三语使用视频（已上线）

用户确认1中文竖屏推广＋4横屏教程，交付文件并同步网站三语。四操作各提供中／意／英，共12网站视频及36媒体资产；另有1080×1920中文推广片（约33秒）、5中文微信成品／封面／二维码／文案。共享播放器可选目录／16:9，同ID关联命令hash、刷新／前后返回与原Copy状态；原首页4:3、15媒体目录／业务／Office命令不变，无Office执行或微信发送。

13成片全解码、H.264／AAC／固定24fps／faststart／非静音声轨、字幕与讲稿、78鼠标步骤及原图／成片／JPEG二维码一致通过；终端为明确示意，无虚构成功。366业务与媒体／3298键三语／strict TS／lint0错误1旧warning／正式build、最终10双浏览器Office与24原命令／首页回归通过；同SHA完整CI37625170845已success：366业务、212 Linux双浏览器（14.7m）及三语／TS／lint／build通过。main06ba753、Vercel dpl_2vMnGSLWJGqsWnCKPwbR37T4RyQG READY／production／双域名一致；最新线上16双浏览器、36媒体及12文本字节、Range206／匿名401通过。main重复CI仍运行，按相同SHA成功门禁复用。基于正式main4d3a8ec2隔离候选，保护登录设备未发布任务。源码scripts/office-tutorials，证据candidate/.local/office-videos，交付根交付目录。

## 已完成并上线：Office 命令工具（2026-10-07）

已读取用户指定对话“解释安装脚本并禁用网站弹窗”，只复用获授权的命令／可读脚本。公开 `/toolbox/office` 提供安装、激活、卸载、完整重装及 CMD／PowerShell 两种格式，完整复制、纯文本下载、可读源码及三语提示。沿用 PublicHeader／Brand／LanguageSwitcher／button／segmented-control／token；仅工具箱私有布局，无新增后台／依赖。复制异常和迟到结果不假报成功。

三种独立操作改为唯一 TEMP 文件、固定上游 SHA256；安装取消网页弹窗、进程关闭限定 Office 路径；卸载失败不深清并恢复 Explorer；激活逐项核对 cscript 退出码与 ProPlus2024VL／LICENSED／GCVGB，7种合成授权文本反例通过；最终独立专项复核无新确认缺陷。完整重装保留原脚本 SHA256 f476281a…及配置预检。配置主／备接口本次只读返回403，Windows 安装／卸载／激活均未执行；公开 GVLK 不是个人密钥。

基于 main6725612 的隔离候选 `.local/office-toolbox/candidate`，24限定路径、399其他Git blob不变，保留根目录登录设备未发布任务。最终SHA `4d3a8ec2ed02d4346ddf8b3cd74bd703b4e57e9d`。本地364业务、8启动器＋4源码真实 PowerShell parser、3脚本变换语法、6 Chromium／WebKit复制／下载／字节／失败／迟到结果及48三语四宽度布局通过；电脑／手机截图已查看，3295键三语、strict TS、lint0错1旧warning、正式模式build通过。浏览器 Clipboard 使用替身，仅证明复制调用及状态；零 Office 执行／后台生产业务写入。首轮云CI37595032705为201/202（Office6/6），原商品WebKit检测checkbox点击失败；trace表明保存已完成但取点后28.5ms滚26px，无草稿重置证据，原生事件是否错失未确认。仅测试补保存UI／字段启用／instant居中与两帧稳定，保留原生check及状态／售价／历史／刷新断言，Mac双浏览器6次通过。原用例Mac5次通过；本地Linux代理原登录初始化未完成，2次hook超时后已停、临时容器已移除，不计产品结果。最终同SHA CI37598240463 completed/success：202 Linux双浏览器（13.8m）、3295键、strict TS、lint0错1旧warning、业务及正式build通过。正式main 4d3a8ec2ed02d4346ddf8b3cd74bd703b4e57e9d；Vercel dpl_7UUZmYjJdGSxuww4dyEQH1eeaJnA READY/production/main/双域名及HTML部署ID一致。线上6复制／下载／失败状态、48三语四宽度、4首页工具箱Office往返及17匿名HTTP（12文本raw SHA256、后台401、apex308）均通过，电脑／手机截图已查看。补验导航脚本先等实际首页和GET完成，保留原断言，原脚本两个导航冲突记录保留，网站源码未变。匿名Chromium单样本DCL342.4ms、加载464.9ms、25资源／398591B、切换两帧24.7ms，无弱网，非性能保证。main重复CI37600477199最后读取in_progress，复用同SHA成功门禁，不冒称重复完成。最终配置主／备GET仍403，0 Windows执行／生产业务写入。证据 .local/office-toolbox/published-verification.json、production-proof和日志。本轮3146预览、Linux49561/49562浏览器及49563代理均已停，临时容器已移除；其他服务保留，正式Office页已请求在本任务打开（queued）。本轮完成。详见 docs04／06；证据 `.local/office-toolbox/`。


## 2026-10-07 公开工具箱（已上线）

首页顶部及页脚增加 `/toolbox` 入口，手机直接可见，保留左上登录／注册。公开页用浅灰底、白色卡片和紫色主操作，预留 Windows／Office 安装、手机刷机、数据传输四类，具体工具和下载链接明确待添加。共用 PublicHeader、Brand、语言控件与原语义 token；中／意／英及标题同步，刷新保留语言。无需登录，不进入后台布局，未改proxy／认证／API／数据库。

正式main **60fdbc59e1c73d4bfde640aa3077acc4f6b123d0**，仅7个公开源码文件，其他392个基线文件保留；根6源文件和25个工具箱词条匹配，其他登录／商品任务保留。Vercel **dpl_FhxznGqBsHwRZYaRCHcGRo7boHMP** READY／production／main／两正式域名，首页及工具箱HTML部署标识一致。www首页／工具箱200，apex工具箱308到www，匿名backend/state401。

同SHA发布前完整CI **37541934653** completed／success：353业务、184 Linux Chromium／WebKit（13.6m）、3184键check:i18n、strict TS、lint0错1原warning、正式build全部通过。main自动重复CI37543641808仍在运行，复用已通过同SHA门禁，不冒称重复完成。初版3367dba云CI37541042214因最终CSS修正取消；最终候选重新通过完整门禁。首次候选推送被自动审批拒绝后核对当前GitHub账号、公开仓库归属及用户本轮AGENTS明确既有发布授权，同一推送审批通过；未绕过。

本地预览、最终Supabase-mode构建及正式站分别检查；正式站48项双浏览器布局（3语×4宽度×2浏览器×首页／工具箱）、匿名直达、44px控件、首页往返／锚点／语言刷新及登录注册导航均通过，0横溢／最终JS错误／后台API请求／初始MP4，截图已查看。WebKit手机及中宽屏径向渐变杂点已全宽改为线性渐变；连续缩放截图补两个绘制帧，鲜开页面图标正常。首轮正式WebKit快速离开登录页时记录忘记密码预取网络错误；保留原记录，脚本仅等待GET完成再返回，原全部断言通过，运行时代码未改。

正式站匿名Mac Chromium单样本DOMContentLoaded336.1ms、语言切换7.7ms、分类定位42.4ms，首个内容可见时10资源／JS263504B；本地最终构建27.5／11.6／34.9ms，14资源／JS259172B。操作时间含自动化开销，资源数为测量时快照，单样本不代表性能保证。0生产业务写入，实体手机／弱网未验。本次3136已停止，其他服务保留。证据 `.local/toolbox/published-verification.json`、source-manifest、ci-final.json／log、production-http／browser／measure、production-proof及final-proof；首次诊断production-browser-first.log保留。

## 2026-10-07 保持登录与设备管理（已上线）

默认不勾选，前台实际使用滚动30天；个人管理浏览器会话，老板只撤销本店访问。OAuth用途/nonce隔离、绑定DB政策继承、跨会话清草稿/确认、两身份header、退出Cookie兜底、审计竞争/未知结果幂等及老板自撤销actor最后提交均已修复。复用控件/三语/权限及业务事实保持。

正式main167b7668447950f3038ddddfd9df900a2116893b，46路径/442其他blob保留；Vercel dpl_7DwAxNvmSZrquPu3FcJZ3xsf3iNL READY/production/main/双域及HTML一致。CI37636374252与main重复37639686937均success：378业务、212 Linux双浏览器、3337键/TS/lint0错1旧warning/build过。生产兼容迁移20261007131534→新应用核验→管理员严格enable已执行，四表FORCE RLS、runtime无enable、匿名零新表/内部函数授权、缺记录0、1账号1店保持，共享Auth配置/业务未改。

17本地API双浏览器＋独立自撤销反例、正式36匿名浏览器＋11HTTP通过，三语四宽/0JS/截图已验；严格后现有Chrome个人设备20/当前1/单一表单和老板本店设备入口正常，未撤销真实设备。合成账号/门店0，3148已停，其他服务保留。真实外部OAuth/短信、实体设备与物理重开未验；详细规格/回退边界docs29，证据.local/login-devices-release/published-verification.json与相关日志。本轮完成。

## 2026-10-06 商品详情高密度排版（已上线）

基础信息多列、摘要与金额紧凑、核验横排、保修就地预览，原资料／历史单按钮展开。手机原分组、字段草稿、44px目标和16px输入保留；原照片不降质，长资料自然增高，API／权限／字段与快照不变。复用与模块内compact变体详见docs06。

正式main a36e7d7628f784a4666e19600c2049aa50d04421，13冻结blob一致、382其他blob保留；Vercel dpl_8GqT4NScRgHetzL3d42Z5o8t3Ky7 READY／production／main／两正式域名及HTML一致。同SHA发布前CI37451900716 completed／success：353业务、184 Linux双浏览器（13.4m）、3159键check:i18n、TS、lint0错1旧warning、正式build。main重复CI37453676193仍运行，复用同SHA成功结果，不报告它已完成。

首次CI181/184，手机Avanzamento规则补到全部宽度；单次原WebKit折叠点击失败4次Linux未复现，原代码／断言保留，最终完整CI全过。修复后Mac2长词、Linux限1CPU6密度、原折叠1和事件诊断3、最终正式build通过；20本地流程、2金融词、2全15集播放原结果仍适用。三语教程第5／6步同步，47PCM和音轨不变，45媒体36,938,054B完整媒体／播放通过；生产三MP4哈希及Range206一致。

生产同一真实商品1440×900高度1518→846px（减少44.3%）、摘要299→152px，日常信息首屏可见；1024为1109px，390／375为815px，长资料不保证一屏。四宽度无横溢，手机操作组实际展开／收起、按钮54px，0JS错误，匿名state401。0生产业务写入。模拟截图与保存均合成资料；实体手机／相机／物理打印／弱网未验。本轮3121、Docker／代理已停、Chrome viewport已恢复，临时tab关闭。证据.local/retail-density/published-verification.json及ci-final／production-http／ui／source-manifest／visual-failure，截图ui-proof/retail-density。

## 2026-10-06 全站三语与排版闭环（已上线）

基于最新已上线 main `2cc6c2a` 合入本轮翻译修复，保留统一商品列表、同页核对、原资料只读、权限／事务／幂等和所有保存行为。修复手机工作台标题竖排、四个正式状态说明、故障及配件摘要、成色、缺值占位、动态错误／恢复消息、账号国家选项、图片alt、加载／无权限及操作历史代码；金融长词按容器适配，字号不变。已知结构与客户原文分开，签署及销售快照不改写。

字典3159键；新增静态门禁与系统句式回归，冲突／缺译为0。353业务及翻译、严格TS、lint0错误（1既有导航warning）、完整174项Mac Chromium/WebKit通过；23正式路径×3语×4宽度共552布局通过，额外金额断词2项覆盖5宽度；商品颜色等三语显示词可直接搜索，原值不变，双浏览器2项通过。接机配件规格按结构逐项翻译，432有限组合与双浏览器保存／刷新回归覆盖。正式流程使用localhost独立门店与虚构账号，保存／刷新／冲突重试、客户／配件／历史回链、三语打印、只读与待授权已实际操作；最终汇总仍以本轮证据为准。未发生生产业务写入、真实消息或新增语音API调用。

教程87目标场景重测并用当前三语画面重渲15集，配音／讲稿复用，保留六章／字幕与鼠标运动。最终媒体45资产完整解码／哈希／字幕及90鼠标步骤通过，218原配音不变；最终18项双浏览器播放／清理／字幕通过，正式后台模式build通过。main 039c0bf已上线，Vercel dpl_BB8oM7PmxP1a3Lr35g5srGU8joZb READY／production／两正式域名及HTML一致。完整CI37401548200同SHA：353业务、178 Linux双浏览器（13.2m）、翻译门禁／TS／lint及正式build全部通过。最新生产公开8项双浏览器三语四宽度及15段播放／字幕／清理通过，45资产哈希一致，匿名state401。main自动重复CI仍运行，复用相同SHA的成功门禁，不冒称它已完成。具体回执见published-verification.json及项目连续记忆。后续强制三语与闭环规则已提交AGENTS并同步06／16，详见[维护规则28](28-i18n-maintenance.md)。证据 `.local/i18n-audit/`、`scripts/tutorials/.work/evidence/`；实体手机、物理相机／打印与弱网未验，不将模拟或本地正式分支当作生产账号保存证明。

## 2026-10-06 在售商品与可视化档案合并（已上线）

按用户纠正删除独立“单机管理”入口；原商品、新商品、旧详情链接共用图形详情，列表／工作台同源去重，旧客户定位原资料。本页明确核对旧未售实物及检测后进入原销售、实际收款交付、客户与三语打印，保存不自动可售。导入原文和旧买家／成交／定金保持，未知规格／付款不倒填；严格拒绝分类数组和客户端金额／来源伪造，成本由服务器取源且按权限投影。

正式main **2cc6c2a8f3ae1a514594162734c91d0991353a34**，28源码／测试Git blob一致，360其他blob保留。Vercel **dpl_3SRUauWSPZgG8RELSXhqTW46grC1** READY／production／main／双正式域名及SHA一致。两域login200，HTML部署ID一致，匿名state401；正式Chrome只读确认入口消失、81在售／48其他、商品直接打开图形详情、手机核对操作同页单组展开，四宽度无横溢。生产业务写入0。

同SHA发布前完整CI **37394528634** completed／success：335业务、168 Linux Chromium／WebKit（12.5m）、严格TS、lint零错误1既有warning、正式build。main自动重复CI37395917038尚in_progress，按同源码／配置／环境复用已成功结果，不报告重复运行成功。12组真实隔离API／正式浏览器覆盖权限、跨店、伪造、冲突、并发、幂等、回滚、撤权、实际核对保存及明确可售；原JSON未变，必要独立专项审查完成。新增容量浏览器断言首次误用region，定位器纠正后完整售卖／旧客户回链及最终全CI通过；未放宽数据或流程断言。

证据.local/retail-unified/published-verification.json、source-manifest、ci-final、production-http-verification、api-verification及.local/ui-proof/retail-unified截图；本地正式3117和预览3121已停，临时Chromeviewport已恢复，其他线程修改保留。实体手机／弱网、真实生产交易及物理打印机未验收。

## 2026-10-06 鼠标动画教程与网站三语（已上线并完成验收）

用户要求教程用鼠标移动、目标轮廓、点击脉冲和局部放大清楚指向操作，并随中文、意大利语、英语选择切换。整站共享语言、偏好记忆与草稿保留已实现，复用现有控件、token与原生video。15段实际界面动画使用虚构资料和自然女声，保留六章定位、画面字幕／VTT、懒加载、失败重试和旧媒体释放。

基于商品正式main649f0fa，不覆盖手机折叠、销售／交付／原saleId回链及冻结打印。canonical选项、客户原文、金额／数量、权限／API／schema及签名／政策／销售快照保持原事实，签署阅读和打印语言独立选择。未知自由文本与对象原型同名文字保持原样，错误译文保留数值约束；独立AST复核未见译文进入业务保存、搜索或快照。本轮无生产业务写入、真实消息或付费API。

最终main `85fce8b423b928c539402862dea2f897bbb2ed06`，冻结165文件／Git blob一致，根162源码／资产匹配，其他本地修改保留。Vercel `dpl_2nirDHk43E1UX51RokTdwn3DvycT` READY／production／两域名／main SHA一致。同SHA门禁CI `37384789427` completed／success：327业务／翻译、162 Linux Chromium／WebKit（11.6m）、strict TS、lint0错误1既有warning、正式后台build。此前Mac完整162（ac266f1）与c2最终16项、四宽度／40后台状态／草稿与视频验收保留。main自动重复CI37386423678当前in_progress／未出结论，与已完成候选同SHA、配置和测试环境，按规范复用成功结果，未冒称该重复运行成功。

Safari语言选择器复用公共.module-select达到44px；售出表单自动定位已设instant。首次c2发布完整候选CI通过，main重复37381489687为159／162，独立trace区分三项：来源继续确认期间滚动28px、身份加载时照片isVisible false直接跳过展开、现金点击期间滚动46px未选中而被正确校验拒绝。只将RetailFieldEditor与TransactionForm自动定位设instant，照片测试等待gallery可见；原click、校验和业务断言保持。原3流程各重复5次／15项、双浏览器6项及现金事件1项全部通过；19组mouse down-up滚动与目标位移0，随后完整CI162通过。旧失败、代理等待、Linux OOM及媒体瞬态诊断保留，未把首次失败当成功。

最新生产6项双浏览器通过（35.8s）：三语公开页四宽度、账号草稿／显隐／验证、15段实际播放／字幕／语言切换清理旧媒体。两域login200且部署HTML一致，匿名state401；45资产共36,238,246字节全部SHA匹配，Range206正常。此前同首页源码c2匿名Mac单样本DOMContentLoaded771ms、切换7–12ms、初始MP4请求0；仅样本，非性能保证。375 WebKit和1440 Chromium可见海报／鼠标目标截图已查看。实体手机、弱网和真实云保存未测，0生产业务写入。

证据 `.local/tutorials/release/.local/tutorials-v2/`（published-verification、main-fix-source-manifest、ci-main-fix-final-result／log、production-final-deployment／http／browser.log、production-browser-result、root-sync-main-fix、main-ci-review、main-gesture-evidence及proof），创作证据scripts/tutorials/.work/evidence/。3123预览已停，临时Linux容器自动移除，诊断测试移出测试目录保存；其他服务、源码与规范修改保留。本轮完成。

## 2026-10-05 商品手机折叠、买家与销售打印闭环（已上线，独立完整验收通过）

采用分组折叠：84px实物缩略图、摘要及已知问题直接可见，检测／销售优先，其余资料、成本、保修与打印、结算售后、历史按需展开；换组不丢未提交输入。电脑完整双栏保留。已有客户可明确带入当前称呼／邮箱及最新已知销售地址，手填值与候选值分别清理；销售冻结本次买家资料，客户编辑不回写历史。销售卡串联登记→逐笔实际收款→实际交付→集中打印，客户记录精准回到原saleId、展开并聚焦，复售后仍能印原买家／原商品／原保修。

复用既有字段编辑、输入／候选、RetailGallery、销售命令、RetailSaleCard、RetailReceipt与token；无新UI框架、schema、请求协议或授权能力。三语打印补充本笔买家备注，成本／利润及长期客户备注不打印；触摸关闭焦点指定回到实际打印按钮。售后历史白名单与RepairActivity穷尽对齐，兼容联系／需求／跟进，仍核对唯一来源、完成状态、事件序列和实际日期；独立审查通过，本地及正式命令共用同一校验。

Node24.19：322业务测试、22项相关Chromium／WebKit浏览器回归通过；最终另复验8档案与2完整销售／打印样式用例。四宽度1440／1024／390／375实际截图已查看，覆盖字段保存刷新、折叠草稿／键盘／44px、六照片放大、缺项可售拒绝、客户带入／更换／取消、两次实际收款、未结清交付拒绝、交付后保修起算、客户更新不改快照、复售原销售回链、三语／双联打印与关闭焦点。print媒体核对仅单据可见，后台页面和工具栏不打印。strict TS、lint0错误1既有warning、默认Turbopack生产build通过。

375×812预热本地单次档案内容872px，进入119ms／打开检测43ms；上一版375截图约2867px，不视为真实线上性能或所有资料长度的保证。初轮照片工具折叠定位和放大CSS已修复；新销售测试必填星号定位及重复IMEI的合成夹具已纠正，保留身份与业务断言。实体手机／物理打印机／弱网／真实后台写入未测；所有读写与截图为本地合成资料，0生产业务写入。证据.local/retail-mobile-closure/、.local/ui-proof/retail-sales-flow/及retail-visual-detail/，上述为上线前验证，随后发布见下段；3121已停。规则docs05／11、复用06和联动16同步。


最终main `649f0fafd0dfb0ba68a8ec394a2715aa98efc510`，基于维修版 `0fa8c86`。累计20代码／测试与冻结Git blob一致，其他308跟踪文件保留。Vercel `dpl_44nVqqT3tFPQb9RRZRM4k7ezCoDQ` READY／production／双域名及SHA一致；两域名login200、HTML部署ID一致，匿名backend/state401。

官方Playwright1.63.0 Linux arm64／Node24.20.0／1CPU独立完整检查通过：322业务、152 Chromium／WebKit（11.9m）、strict TS、lint0错误1既有warning、默认Turbopack正式后台build；另24项定向复核通过（2.3m）。本轮源代码与Linux被测20文件一致。

云端首轮CI `37361865766` 148／152，4项WebKit测试缺少加载等待／折叠操作；修正3测试文件，保留原业务断言，运行时未改。最终CI `37364428122` attempt1没有分配到hosted runner、0步骤，被取消；公开注释已保存。一次重试attempt2已完成并为success；2026-10-05本轮读取确认，不以旧in_progress记录替代当前证据。

正式Chrome只读验证单机全部记录0台、新建入口375宽正常无横溢；现有导入商品仍为原历史页面。详情、实际销售／收款／交付与打印业务以合成测试验收，0生产业务写入；实体手机、弱网和物理打印机未测。本地375单次预热内容872px／进入119ms／检测打开43ms，不作为线上性能保证。

证据 `.local/retail-mobile-closure/published-verification.json`、published-source-manifest.json、linux-full.log、linux-targeted.log、ci-first-failure.log、ci-runner-error.json、production-ui-verification.json／production-http-verification.json及相关合成截图。3121预览已停，Linux容器自动移除；候选依赖与构建缓存已清理。

## 2026-10-05 商品单机档案可视化（本地完成，未上线）

按用户提供的单机档案参考图改为大图／型号／售价／分类标签和圆环概览，下方为基础信息、随件与已知问题、适用规格、销售与成本及检测与销售。电脑保持双栏，手机单栏并将检测／销售动作优先放在摘要后。来源和日期归基础信息，照片仍为本台真实记录；无照片显示图标占位，不使用产品图冒充实物。商家保修、销售结算与售后、历史继续保留。

复用 `RetailGallery`、`RetailFieldButton`／`RetailFieldEditor`、`PageTitle`、`ColorSwatch`、`UnitIcon`、既有销售／检测／保修能力及公共 token／按钮／输入；只调整整机模块布局与样式，没有新增 UI 框架、数据请求、后台协议或写入权限。成本／毛利继续受 `financial.read` 控制；未知整备成本时毛利待确认，负毛利用警示色，检测圆环和“已保存”只读已保存核验。检测草稿不会自动增加进度，记录检测与设为可售仍分开。字段更正沿原核对／版本／保存和刷新恢复；已售／预留编辑保护不变。

Node24.19：89项定向整机规则、14项相关 Chromium／WebKit 浏览器回归通过；其中最终6项档案回归全部通过，8项原列表回归复用同一未改列表源码的成功结果。1440／1024／390／375实际截图已查看，覆盖金额单行、44px目标、六张照片切换／放大、字段保存／刷新及键盘焦点返回、检测保存／缺项可售拒绝和已售锁定。严格TS、lint0错误1既有warning、默认Turbopack生产build通过。本地预热开发预览单次进入104ms／打开售价编辑45ms，仅实验室样本；实体手机、弱网和正式后台／线上UI未测。生产构建登录页正常且按原规则禁用演示账号，因此内部页面的浏览器验收来自开发预览。所有测试使用合成资料，无生产写入。证据 `.local/retail-visual-detail/`，截图 `.local/ui-proof/retail-visual-detail/`。源码在本地，未提交或部署。

## 2026-10-05 四个日常分组（已上线）

按用户授权执行返修、处理中、等配件、等取机；选择供应商／加车不移组，实际下单才等配件，分次到货按必需采购核对，到齐回原处理组。等取机未通知／已通知子筛选与真实联系、新周期独立；结束／作废／实际交还进历史，欠款待收尾仍工作台可见。返修专用新单明确来源／原因、复用原实物关联，双向追溯且原采购／签名／销售保留。列表、详情、客户、工作台共享规则，旧配置只读规范／四组固定名可排序。新增项目／新采购在等取机和历史须明确恢复；实际到货及报价更正保留。完整规格见[计划22](22-repair-supplier-batch-notification-plan.md)。

319业务、20组真实隔离后台API（权限／门店／双版本／幂等并发／失败回滚／来源防篡改）、68相关Chromium／WebKit和四宽度、strict TS、lint0错误1既有warning、正式后台build通过。独立关键规则审查完成；手机成功提示拦截触控已修复并回归。仅合成写入，实体iPhone／弱网未测；正式发布与完整CI另记PROJECT_MEMORY。仅同步38个获授权代码／测试路径，本地商品未上线任务保留。

正式main **0fa8c86fe3b30df0d41e7e95c549ca39cacd1090**、38 Git blob与冻结源码一致，其他288路径保留；Vercel **dpl_J9S19zouZYJocjRYVcHntoU5YtN1** READY／production／两域名。CI **37326963799** attempt2 completed／success：319业务、138 Linux Chromium／WebKit（9.4m）、lint、strict TS和正式build通过。首轮137／138，原有旧站fallback快跳转发生一次net::ERR_ABORTED；原测试及运行时代码未改，官方Playwright1.63 Linux arm64／1CPU重复6项通过，再同SHA完整复跑通过。正式Chrome只读核对四组设置、3工单归属／通知计数、筛选／历史和阶段下单入口，以及四宽度44px／无整页横溢。login200部署匹配／匿名state401；无生产业务写入，实体iPhone／弱网未测。证据.local/repair-four-groups/；另一本地客户销售改动保留，未随本轮发布。

<a id="2026-10-05-当前决定维修阶段与分组逐一对应"></a>

## 2026-10-05 历史实现：维修阶段与分组逐一对应（四组已覆盖）

九个可选维修阶段分别进入同名分组，保存成功后展开／恢复焦点并调整会隐藏该单的筛选；统一旧分组名称，保留顺序调整和独立配件分组。实际采购／通知／欠款与交还不覆盖阶段，旧跟进只投影已确定事实。详细映射和旧配置兼容见[维修与客户闭环](10-work-order-customer-loop.md#2026-10-05-当前决定维修阶段与分组逐一对应)，本轮验收及发布见PROJECT_MEMORY最新节；下方旧映射仅历史。

## 2026-10-04 工单简化、报价跟进与返回恢复

列表只留设备／客户／配件按钮／阶段／联系／负责人更新六列；分组管理移到设置→订单管理，列表筛选按需展开。参考原Figma紧凑组件，电脑配件按项目同行显示供应商与报价／获权进价，手机顺排，保存事实后才显示已加购物车。详情两栏独立流，项目数量不再撑开左栏故障与采购间距；签名继续在左栏配件下方，避免右侧照片／随件把签名撑远。

用户明确接单跟进主要用于报价沟通及待回复，已纳入三个结果与说明／操作历史，共用既有服务端权限／门店／版本／幂等事务。报价联系不等客户同意、不改阶段、不合并到货和取机通知。详情返回保存分组、筛选、排序及纵横滚动，搜索仅同页签内存，权限／身份变化隔离。执行及最新验收见[docs09](09-repair-table-layout-plan.md)和PROJECT_MEMORY。


## 2026-10-04 工单列表 Figma 适配与手机统一

用户要求改善整行、选项块和整体视觉，重新借鉴原Figma。已核验任务页面截图和分组／数据格／短状态／搜索的完整设计上下文，当前方案见[docs09](09-repair-table-layout-plan.md)。实现白色分组表格、细线、轻量阶段标签、一次配件入口，手机收纳成同风格卡片及单行工具按钮；保留全部适用采购／通知／跟进事实和原权限，Stage／Contact默认详情继续原布局。修复手机待核对提示隐藏，并给统一配件入口补上关闭后焦点ID及滚动边距，长按钮返回完整可见。284业务、26原双浏览器＋4新增长文字／四宽度／保存刷新／键盘焦点用例、strict TS、lint0错误1既有warning、正式后台build通过，独立静态复核无新明确问题。截图为本地合成数据；发布与完整CI结果见PROJECT_MEMORY最新节。

## 2026-10-03 维修列表入口按钮与组内简化

供应商／配件列由无边框文字改为明确secondary按钮，常态边框／图标／箭头、两行事实和44px触控高度；直接打开当前项目窗口，手机沿用已有配件按钮。移除到货／修好下面的联系状态下拉和对应隐藏行过滤，完整展示当前主筛选下工单；每单已通知／未接通、久等／欠款等实际状态与记录不删除。采用已有组件／语义token，无后端／权限／采购／通知事实写入变化。

验收：284业务测试、26项Chromium／WebKit维修分组与采购／通知交互、1440／1024／390／375宽度实际点击及无整页横溢；strict TS、lint0错误／1既有warning、正式后台生产构建通过。截图使用本地虚构工单，未保存演示修改；不把浏览器模拟当实体iPhone验收。当前公开代码相对main2cce8c7的差异只有列表入口与上述组内筛选；发布和线上验证状态见PROJECT_MEMORY最新节及.local/repair-button-*。

## 2026-10-03 接单项目直填供应商与金额（当前决定）

按用户最新澄清，打开配件窗口直接铺开接单已有项目与原装／组装等要求，每项选填供应商和报价，获权进价按需显示，一次保存所有实际修改项。不再重复选项目或逐条加入；供应商留空只报价、不造采购或到齐事实；选供应商保存才加车。卡片图标＋当前状态，电脑横排／手机供应商整行和金额双列，详情重复入口合成一个。旧采购操作和异常关联核对按需展开，已下单事实不改。完整流程与价格含义见[计划22当前方案](22-repair-supplier-batch-notification-plan.md)。

专项审查发现两处不合理点并已修复：服务端须与UI同样拒绝旧多采购覆盖及同项目重复新建；并发下单后核对最新资料，应明确锁定供应商／进价并保留报价可继续保存，不能让隐藏脏字段阻断报价。定向反例已补。283＋新增旧多采购1共284业务通过；完整58双浏览器＋新增并发恢复2通过，四宽度、16真实本地API、正式页面→API→DB→刷新3条链路、strict TS／lint0错误1既有warning／正式build通过。页面写入均为本地合成数据，无云数据迁移、真实外部下单或客户消息；实体iPhone键盘未实测。证据.local/repair-inline-*与repair-item-editor-api-final.log。

## 2026-10-03 供应商与报价流程简化（上一轮记录，以当前决定为准）

按用户截图反馈，正常选件只保留维修项、供应商、选填客户报价和有权限时的进价。屏幕、电池、尾插及自定义其他项目按项保存；新增条目数量默认1，旧数量、实际规格、备选用途、订单与到货历史保留。供应商字段可明确选择“无需采购”，只保存项目和报价，不生成采购记录；已有必需采购不能借此删除。保存供应商即确认该项目配件并加入采购车，编辑未下单配件后仍在车，不再额外点击登记完整、无需采购原因或关联按钮。采购车批量下单、分次到货、联系和人工改维修阶段沿既定事实执行。

新建工单按所选维修项目填写报价，不录入进价。报价是该维修项对客户的总报价，同一项目的多条采购共享一个报价；报价不是进价、收款或客户授权。空白未知与明确0分开；最多两位小数、非负且单项最高€1,000,000。未报价项目使合计保持待补全。报价变更追加前后金额、时间和操作者；旧客户端遗漏字段保留，历史由后台生成。详情和意／英／中接机单读取同一报价，打印保留原接单规格；当前接机签名对象不包含报价，不把旧签名解释为新报价授权。

进价输入要求financial.read与financial.edit，成本只读展示要求financial.read；服务端投影和写入均核验权限，无权提交null保留旧进价，伪造金额拒绝。未下单保存同时检查工单、项目、采购版本并原子更新采购车／要求／报价；冲突保留输入，由用户核对最新资料后重试。已下单的供应商、数量及进价不能通过此简化表单改写，仍可单独修改客户报价。

原接单要求变化或旧记录未完成登记时，异常区才显示“配件要求待核对”：列出该项目全部必需及备选条目，用户明确确认符合当前要求后，单次事务更新引用及项目确认，保留实际采购和到货事实；缺一条、过期版本、越权整次拒绝。来源已从接单移除但用户明确保留的采购项目转为独立项目，不会刷新后反复失效。不存在的旧未关联记录不自动猜关联。

验收：270业务测试、34 Chromium／WebKit交互及新增4项定向（包括已下单改报价、显式旧关联核对与三语打印）、1440／1024／390／375布局及16px手机输入；原18＋新15＋新4组真实本地API、2条正式构建页面→API→数据库→刷新链路；strict TS、lint0错误／1既有warning、正式后台生产构建通过。真实后台和浏览器写入仅使用独立本地合成门店／账号；没有下真实供应商订单、发送外部消息或删除生产数据。证据.local/repair-simple-*及.local/ui-proof/repair-simple*；实体iPhone键盘未实测。 补充回归：新增workflow依赖已接入接机／签名／员工测试加载器，最终270项重新通过，原断言保留。完整CI发现WebKit关闭联系窗口后的焦点恢复滚动影响连续阶段点击，恢复焦点改为preventScroll；原“通知→久等→欠款交还→作废”用例在Chromium／WebKit各重复5次、共10次通过。

最后更新：2026-10-03 · 本地已恢复当前线上main，未上线性能分支已放弃

## 2026-10-03 放弃本地未上线分支、恢复正式main

用户最新要求“删除本地所有这些分支的改动，保留main，以上线的为准”。GitHub main及chinatech.in/www实际生产部署均为 `bedc26e022e4d37f97210798736430aa5dc73e6a`（dpl_9JKoBs9sgdrz2zxPQqvUQAQDqio9，READY/production）。本地源码按此提交恢复，未上线性能代码/候选副本/旧构建缓存清理；保留项目业务文档、私有配置与数据，远程分支及PR不变。原性能实施规范取消作为当前已有能力的描述，详细历史留在docs20。恢复后的源码与验证以PROJECT_MEMORY最新节及`.local/restore-main-20261003/`为准；下方原性能完成记录仅追溯。

## 历史：2026-10-03 性能测试分支（本地已放弃）

用户要求优化至本轮计划完成并推测试分支。P1/P2/P3工程范围完成：鉴权轻量核对、页面摘要/全部计数/稳定分页/跨页候选、详情/原图/历史按需读取、请求隔离SSR、正式/预览拆分及最小命令依赖/回执/关联补查。保留最新main的账号与维修项目批次，权限、事务、幂等、历史和图片质量不降级。后续规范写入AGENTS、docs06/16及公开PERFORMANCE.md。详细实现、测试条件与目标状态见[计划20第二批](20-performance-optimization-plan.md#第二批页面读取与最小命令2026-10-03)。

以main bedc26e为基线，30样本5,000工单响应5,362,541→117,321B（-97.81%），请求P95 969.0→79.5ms；普通保存P95 1837.5→76.4ms。各30浏览器样本，正常/弱网打开并展开P95 9951.1→564.3ms / 41212.0→856.2ms；弱网候选首次浏览器缓存冷2,303.1ms。实验室LCP/EventTiming不能替代真实用户P75/INP，首次摘要缓存未命中2.9秒与脚本量+4.6%保留限制，不宣称所有目标达标。

283业务PASS/1私有导入skip、严格TS、lint0错误/1既有warning、正式build；44真实本地API、26恢复、54公共双浏览器、18页面/并发/权限/原图场景及12组正式页面功能/性能通过。独立专项审查发现项均已修复。分支`codex/performance-optimization-20261003`最终04eb5a5ea9deb43750c6c067992e08945e29ded1、[PR26](https://github.com/kyox215/Chinatech-codex/pull/26)，289公开文件字节一致，push37082771997/PR37082775265 CI均success。main bedc26e和生产未改；测试副本原3117与其他业务fixture保留，本轮3151/3152/3153已关闭，专属合成门店及Auth/accounts已清理。证据`.local/performance-p2/verification-summary.json`。真实线上P75/CLS、函数冷启动及实体设备仍需部署后测量。

## 2026-10-02 性能结构检查与优化计划

用户已确认开始执行，并要求后续新增及修改功能遵守优化规范。根AGENTS及联动规则16已写入受影响路径的加载、交互、限定查询／渲染、稳定缓存、反馈和质量要求；默认业务回归加入列表模型检查。分阶段计划及当前结果见[响应与加载计划20](20-performance-optimization-plan.md#已授权执行与首批结果2026-10-02)。

首批P1已在本地实施：经实时鉴权的stateToken轻量核对、相同状态不重复发布、维修配件索引／单次分组／折叠行懒挂载、恢复读取合并与离线竞态防护、加载／错误重试。每规模30个暖请求，本地合成100／1,000／5,000工单的未变化JSON均210B，较原全量减少99.662%／99.965%／99.993%；5,000请求P95为1125.3→66.5ms。CPU模型5,000工单构建P50为3767.39→7.29ms，排除React／DOM／网络，不能当整页或真实INP成绩。

236业务回归通过／1未开启集成跳过、严格TS、lint0错误／1既有warning；42项Chromium/WebKit公共交互与分组回归、6项错误恢复、10项状态API规模／权限检查、双浏览器恢复各13项通过，四宽度无整体横溢。WebKit本地HTTP测试cookie适配及断网RSC预取异常保留说明，详见docs20。正式Supabase模式隔离构建通过，本批未迁移／发布，不借其他任务的上线证明。证据`.local/performance-p1/`。下一批先完成P2维修摘要／全量计数／分页／详情与关联闭环；P0冷启动、弱网、并发和真实Web Vitals仍待补测。

初始审计证据仍保留`.local/performance-audit-20261002/`：9次线上匿名HTTP、既有构建JS和结构分析；它们不能代替本批本地验证或正式登录业务测速。

## 当前联动修改约束

2026-10-02 按用户要求，将已确认的整机输入／销售／售后／员工权限与维修选项／默认保修／三语打印／签名纳入[联动修改与闭环规则](16-change-consistency-contract.md)，并在根 AGENTS 设为修改前必须读取的入口。矩阵连接数据来源、写入边界、使用页面、历史快照和适用反例；要求实现、相关规格、真实验证及简短执行记忆一同维护。同步修正当前规格中过期的默认期限、单语打印和向下展开描述，保留历史日期与验收事实。

本轮仅调整项目文档与规则，不改变应用行为、客户／销售数据或授权范围，不宣称新增自动化门禁、后端同步或重跑168项应用测试。文档引用与实际入口的核对结果见项目记忆。

## 2026-10-01 九条整机规格批注执行完成

详细计划、两轮逻辑核对、实施映射、来源和第三轮验收见[docs/12](12-retail-specifications-execution-plan.md)。已实施分类先选、详情信息归类／唯一电池编辑、直接保修下拉自定义、日期流水号只读、手机存储及RAM预设、CPU／GPU搜索、游戏机品牌型号联动、分组多列色板。363CPU／231GPU／62游戏机／18RAM容量与27官方来源作为可扩展本地候选，允许手填，不宣称全球穷尽。

最终lint、typecheck、build通过，145项测试全部通过（整机66、目录10）。浏览器两台专用虚构单机：CT-20261001-0001翻新手机v4（96GB／90%／18个月），CT-20261001-0002新机电脑v1（16GB／8250U／RTX3060Laptop／512GB SSD），均未售出；原demo-unit-2保持v3和旧编号。复制直接刷新、切换类别清理、手机容量和CPU编辑、保修取消／保存刷新、色板键盘／自定义／嵌套Esc及接机复用实测。React相同key造成RAM残留已修复后重试，不隐去开发中的失败。

1440／1024／390／375px详情与表单无整页横溢，手机输入16px、控件44px。销售身份无成本区、只读编辑禁用及直达新建拒绝；跨标签身份切换关闭原成本弹窗，沿用AppShell现有成员版本重挂边界。独立专项复核没有剩余阻断项，保留M1跨标签非事务限制。最终新窗口warn／error为空，临时尺寸与老板身份恢复，未改原销售历史。

证据：[桌面分组](../.local/ui-proof/retail-specs-20261001/overview.png)、[375详情](../.local/ui-proof/retail-specs-20261001/detail-375.png)、[宫格色板](../.local/ui-proof/retail-specs-20261001/form-375.png)、[容量编辑](../.local/ui-proof/retail-specs-20261001/storage-editor-375.png)、[CPU编辑](../.local/ui-proof/retail-specs-20261001/cpu-editor-375.png)、[接机色板](../.local/ui-proof/retail-specs-20261001/intake-color-375.png)、[验证记录](../.local/ui-proof/retail-specs-20261001/verification.json)。前轮完整交易／售后UI证据复用，本轮运行其规则回归；未执行真实DB、账号隔离、付款退款、生产、硬件或物理打印。

## 已由用户明确

从零新建；不使用 SnowUI；易扩展的响应式网站；配件不做库存；自有待售商品一机一档；扫码、颜色、RAM、硬盘/存储容量；首页是介绍页；登录注册在左上角。

## 建议默认，尚非用户确认

首页先介绍系统而非实体门店；公开注册须验证与人工授权，员工以邀请加入；内部页面统一 `/app`；根目录不因已登录而强制跳走。客户注册、多门店自主开通和订阅付费不自动启用。

## 本包实际包含

| 项目 | 状态 |
|---|---|
| 完整规划 PDF / Word / Markdown | 已有历史基线，原件保留 |
| 原 Codex 任务、架构、模板、参考图片 | 原包已展开并保留，旧规则受本包覆盖 |
| 一机一档独立原型及源代码 | 已有，复制未修改 |
| 库存电脑/手机截图 | 已有，7张，复制未修改 |
| 两版思维导图 | 已有，复制未修改；不作为严格权限/业务规格 |
| 首页与登录注册的细化逻辑 | 本轮已补充文字规格 |
| 更新后的功能页面树、阅读顺序与 Codex 入口 | 本轮已生成 |
| 包内浏览导航 | 本轮已生成，只是资料目录，不是公开首页实现 |
| 正式首页视觉样板 | 已实现 `/`，含公开介绍、功能概览和登录/注册入口 |
| 登录注册视觉样板 | 已实现开发环境预览会话；不等于真实账号认证 |
| 内部工作台视觉样板 | 已实现 `/app/dashboard`，含桌面/平板/手机响应式导航与 fixture 数据 |
| 维修工单视觉样板 | 已实现 `/app/repairs`、`/app/repairs/new`、`/app/repairs/:id`；含列表筛选、四步接机校验、报价版本、工单采购与时间线 |
| 采购到货交互样板 | 主入口已整合到维修列表／详情；添加、编辑、加车、下单标记、分批到货、原批次追加式更正；版本化浏览器本地保存，不形成库存；旧采购地址兼容保留 |
| 整机一机一档交互样板 | 已实现逐台录入、身份查重、型号复制、识码、检测、状态及按手机号登记售出；版本化浏览器本地保存，收款与交付另行确认 |
| 客户与客户设备 | 客户按手机号归档，维修／售出两类历史；称呼选填，可维护联系资料；设备按精确标识看历史，不由型号合并身份 |
| 门店管理 | 头像内门店资料、供应商、手动经营收支、接机单默认打印设置；浏览器本地保存 |
| 真实账号认证、数据库、完整业务后端 | 尚未实现；等待后续授权与 M2 设计 |
| 生产部署、迁移、真实数据接入 | 未执行 |

## 测试口径

规划包整理阶段核验：两个源 ZIP 的 CRC、解压路径安全、打包文件来源与字节一致性、浏览导航本地链接、未包含独立字体文件、最终 ZIP 完整性。

原 `prototypes/retail/verification.json` 是先前的原型检查结果，不是本轮重跑结果。里面已说明 localStorage 和下载有测试替身；真实摄像头、扫码枪、打印机、持久化、扫码兼容库和生产权限仍未验收。

当前应用已实际运行 `npm run lint`、`npm run typecheck`、`npm run build`。浏览器走查覆盖 1440、1024、390、375 宽度，并点击验证演示登录、密码显隐、移动导航、退出和未登录重定向；未发现横向溢出或错误遮罩。

2026-09-30 工单模块追加验证：1440 桌面列表无横向溢出；390 手机完成状态筛选、四步接机表单、必填校验、成功状态和详情页走查，浏览器控制台无 warning/error。手机工作台统计卡改为两列，并减少非必要间距；主要操作仍保留至少 44px 触控高度。

2026-09-30 采购模块：实际通过 `npm run lint`、`npm run typecheck`、`npm run test`（10 项）与 `npm run build`。浏览器走查覆盖 1440、1024、390、375 宽度，列表、详情与新建表单均未出现横向溢出；手机到货操作按钮高度为 44px、输入字号为 16px。实际操作了搜索空结果、工单筛选、两种分组、详情返回恢复条件、新建必填与金额精度、空单价保留为待确认、下单、分批到货、超量拒绝、必填更正原因、原记录保留和关联工单摘要同步。无运行时 error 或错误遮罩；开发期间出现过一次正常 Fast Refresh 全页刷新提示，不计为业务通过证据。

最终类型复验曾被 `.next/types` 下 4 个旧的“2”后缀自动生成文件阻塞；已将它们移到 `.local/generated-types-recovery-lirJ5H/` 并保留 `.snapshot` 副本，再次通过类型检查、10 项测试和生产构建，没有放宽类型断言。

手机 390px 列表截图保存在 [采购手机布局](../.local/ui-proof/procurement-mobile-390.jpg)。截图是当前浏览器页面，非包内原型。

## 采购样板状态与边界

| 状态 | 当前行为 |
|---|---|
| 待下单 | 可记录已完成的下单事实；不会发送订单 |
| 等待到货 | 可追加本批到货；无到货批次时不能更正 |
| 部分到货 | 可继续到货或关联原批次更正 |
| 已到齐 | 不能继续增加到货；可追加数量更正 |
| 空结果、未知编号 | 有恢复入口；刷新后新增演示草稿不再存在 |
| 超量、负数、非整数、无原因、更正使批次为负、重复事件、旧版本 | 阻止追加，原历史不变 |
| 缺货、错件、取消、供应商退货 | 尚未实现，不以数量更正代替 |

采购、关联工单与工作台共用一份虚构到货记录。金额按整数分记录，未知单价为 `null`；采购操作不自动修改客户报价、维修状态、收支或待售单机。正式服务端的门店权限、幂等与事务尚未实现，本地规则测试不代表已具备生产写入保障。

## 整机样板状态与边界

2026-09-30 已接通逐台列表、三步录入、独立档案、同型号新建、手动识码与工作台摘要。列表查询和排序保存在 URL 中，详情返回恢复筛选与位置。SN 按品牌归一化查重，IMEI 1/2 共用查重范围，已售档案仍参与检查；包装码允许共用，只返回候选。RAM、机身存储和逐块磁盘分别记录，未知保持 `null`。复制型号不沿用身份、照片、检测、电池、手柄实测数量、金额、来源或占用记录。

| 状态 | 本轮行为 |
|---|---|
| 新建 | 必须确认门店自有实物；生成独立编号，保持待检测 |
| 待检测 | 可记录检测和标价；记录检测不自动上架，三项已保存检查与有效售价满足后仍须明确设为可售 |
| 可售 | 可带原因暂停；不能直接更正标价或普通编辑 |
| 暂停销售 | 可带原因更正标价或重新检测；重新检测清空本轮检查，身份与原历史保留 |
| 已预留 | 只读虚构预留；仍属在库，到期不自动解除 |
| 已售出 | 只读虚构销售记录；原身份不释放，不能直接恢复可售 |
| 空结果、缺失档案、校验失败、重复事件、过期版本 | 显示恢复入口或错误；不改写原历史 |

实际通过 lint、typecheck、25 项规则测试（采购 10 项、整机 15 项）与生产构建。列表检查覆盖 1440、1024、390、375 宽度；录入和详情在桌面、平板与手机代表宽度走查。实际点击验证了搜索、排序、空结果、URL 返回条件、列表末尾滚动恢复、包装码多候选、已售 SN 查找、未知链接不跳转、重复 SN 拦截、多磁盘建档、金额精度与自有确认、复制清空、检测与明确上架、暂停必填原因、重新检测、历史追加和工作台统计同步。长型号与长 SN 在 375 宽度没有撑宽页面，手机输入 16px、主操作 44px；验证标签未记录 warning/error。

平板导航已按规则在 1199px 及以下折叠，实际验证了 1024px 抽屉开关与跳转。关闭了遮住手机底部工作台入口的开发悬浮按钮，编译和运行错误仍正常显示；修复后实际点击底部导航通过。换步滚动与焦点、不同单机之间的未提交操作隔离也已验证。

类型检查再次遇到 4 个旧的“2”后缀生成文件，副本保存在 `.local/generated-types-recovery-6lo7HX/`，未改弱类型配置；最终构建与类型检查通过。文件重复出现的外部原因未确认，不把缓存恢复视为业务修复。

当前截图：[手机 390](../.local/ui-proof/retail-mobile-390.jpg)、[平板 1024](../.local/ui-proof/retail-tablet-1024.jpg)、[桌面列表 1440](../.local/ui-proof/retail-desktop-1440.jpg)、[桌面详情 1440](../.local/ui-proof/retail-detail-1440.jpg)。均为当前应用页面，不是原型图片。

整机操作只在当前预览内存中保留，刷新清除新增档案并恢复默认 fixture。未实现真实认证、门店/成本权限、数据库事务、持久化、照片上传、相机扫码、预留创建与解除、销售、退款或实物退回命令；本地版本与事件检查不代表正式服务端安全。原 ZIP 原型保持未修改。

## 桌面视觉审查

2026-09-30 用户要求检查桌面视觉与布局。本轮只审查，未改页面代码、未提交业务表单、未变更采购或单机状态。整体导航、面板语言、工作台分区、账号页和录入表单结构合理，但后台可读性、整机详情空间与首页排版尚不适合定稿。以下优先级与调整方向是审查建议，不是已实施结果或新的用户决策。

| 优先级 | 实际发现 | 建议调整与定位 |
|---|---|---|
| 优先 | 后台列表主文字约 12px，规格与身份说明 10px，部分统计说明和详情标签 9px，并使用淡灰色；整机行高 83px，大屏上有空间却仍难快速读清 | 桌面主要内容建议约 14px、辅助信息约 12px，并加深必要标签；同时收紧非必要行距、避免用缩小字号实现密度。定位 `app/globals.css:527`、`:623`、`:630`、`:631` |
| 优先 | 整机预留详情右栏只有一段只读说明，却长期占约三分之一内容宽度；左栏串行堆叠，全页高约 1761px，右侧大块空白 | 按状态调整布局：只读状态改为轻量提示，或把预留摘要、历史等放入右栏；需要操作的状态保留操作区。定位 `app/globals.css:669` 与 `components/retail/retail-detail.tsx:28`、`:45` |
| 其次 | 首页 1440px 大标题最后一行只有“程。”，流程段标题也出现“起。”短尾行；多端段标题将“手机”拆到两行 | 调整字号与文案栏宽、中文断行和行数，保留现有业务含义。定位 `app/globals.css:94`、`:155`、`:168`、`:182` |
| 其次 | 多端示意中桌面预览盖住大部分手机内容，手机只剩窄边和大片空白，无法清晰表达两种设备 | 明确两个设备的层叠顺序，让手机在前景且内容可见；内层 `.product-preview` 的 `z-index: 1` 与两个设备外层缺少明确层级是相关定位证据。定位 `app/globals.css:103`、`:190`、`:191`、`:192` |

1440×900 实际查看：首页、登录、注册、找回密码、工作台，以及维修、采购、整机的列表、新建和代表详情，共 14 类路由；另外查看维修四步、整机三步及电脑规格录入、可售与已预留整机详情。实际展开了识码候选、采购历史更正和工单搜索空结果，未执行最终建档或状态变更。

定向抽查：1280×800 查看注册、工单列表、整机预留详情；1920×1080 查看工作台、整机列表与预留详情。所查页面未出现页面级横向溢出或业务控件重叠；首页设备插图遮挡已单独记录。较矮窗口中注册页正常纵向滚动。验证标签未记录 warning/error。未穷举所有 fixture、loading/error/no-access 状态或完整业务交互；未重新运行 lint、类型检查、规则测试或构建，不以旧结果代替本轮视觉证据。

本轮截图保存在 `.local/ui-proof/desktop-review-20260930-NgZhhG/`，代表证据：[首页标题](../.local/ui-proof/desktop-review-20260930-NgZhhG/home-hero-1440.jpg)、[多端插图](../.local/ui-proof/desktop-review-20260930-NgZhhG/home-responsive-1440.jpg)、[整机桌面列表](../.local/ui-proof/desktop-review-20260930-NgZhhG/retail-1440.jpg)、[预留详情完整页](../.local/ui-proof/desktop-review-20260930-NgZhhG/retail-reserved-detail-1440.jpg)、[大屏列表](../.local/ui-proof/desktop-review-20260930-NgZhhG/retail-1920.jpg)。临时审查标签已关闭、浏览器尺寸覆盖已重置，用户原标签与业务状态未改动。

## 视觉修复与选择器统一

2026-09-30 用户授权修复上轮审查问题，并要求选择器沿用现有风格。本轮已完成以下改动，原审查表保留为问题来源，不再代表当前待办。

- 桌面和宽平板列表主字提升至 14px，必要辅助字约 12px 并加深颜色；列表最小行高收至 68px。手机的小型摘要行、统计卡与底部导航密度保持不变。
- 整机详情左侧放身份规格和检测，右侧依次放操作、来源金额、预留/销售摘要与时间线；窄屏仍单栏。1440×900 下预留单机详情实际页面高度由约 1761px 降至 1323px；可售状态的操作区也已查看。
- 首页三个标题按语义分组并调整字号，消除孤字尾行；设备示意建立独立层叠上下文，手机内容在桌面示意前景正常显示。
- 维修、采购、整机所有现有下拉框接入 `components/select-control.tsx`：白底细边框、圆角、紫色焦点/选中态、菜单阴影与勾选标记。手机字体 16px、选择框与选项至少 44px；长值在关闭框中省略，展开菜单仍显示完整名称。菜单在顶层展开，不被面板裁切，长列表可滚动。

选择器保留原生 `select`、选项、标签和事件，不引入 UI 依赖，不改变筛选或业务校验。浏览器支持时在 hydration 后添加原生选择按钮与 `selectedcontent`，并在卸载时清理；这是为避免当前 Next 打包 React 对新嵌套标签的警告，未关闭或压制错误检查。CSS 菜单定制使用渐进增强，不支持 `appearance: base-select` 时不插入新标签并回退平台原生菜单。能力与兼容边界参考 [MDN 可定制选择器](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select)；本轮没有实测 Safari、Firefox 等其他浏览器，不能宣称所有平台菜单完全一致。

实际浏览器验证：首页、整机列表/详情在 1440、1024、390、375 代表宽度查看；桌面另查工作台、维修/采购列表和录入、采购更正面板，手机另查维修优先级、整机成色、窄磁盘选择器和长工单选项。实际点击验证选值、维修排序、采购关联筛选、整机筛选、方向键与 End 移动、Enter 确认、Esc 关闭、焦点返回和 Tab 顺序；验证了型号复制后的换步、SSD 类型/容量单位、识码类型、平板抽屉导航与手机底部入口。本地会话失效时通过页面演示入口恢复，并验证密码显隐。未提交最终工单/采购/单机建档、到货更正或单机状态变更。

手机长筛选值挤出箭头的问题已在 390 与 375 复验修复。所查页面无页面级横向溢出；修复嵌套兼容问题后，新的独立验证标签未记录 warning/error。最终通过 lint、typecheck、25 项规则测试和 build。类型检查两次被带编号后缀的旧生成副本阻挡；最终构建重新生成类型后复验通过，没有放宽配置，副本重复出现的外部原因仍未确认。未穷举全部状态或进行跨浏览器验证。

本轮代表截图：[桌面选择器](../.local/ui-proof/desktop-fix-20260930-3bN7zG/retail-menu-1440.png)、[375 窄框省略](../.local/ui-proof/desktop-fix-20260930-3bN7zG/retail-long-selection-375.png)、[375 完整菜单](../.local/ui-proof/desktop-fix-20260930-3bN7zG/retail-menu-375.png)、[390 长工单菜单](../.local/ui-proof/desktop-fix-20260930-3bN7zG/procurement-menu-390.png)、[窄磁盘菜单](../.local/ui-proof/desktop-fix-20260930-3bN7zG/retail-disk-menu-375.png)、[桌面详情](../.local/ui-proof/desktop-fix-20260930-3bN7zG/retail-detail-1440.png)、[首页断行](../.local/ui-proof/desktop-fix-20260930-3bN7zG/home-1440.png)、[设备前景](../.local/ui-proof/desktop-fix-20260930-3bN7zG/home-responsive-1440.png)。两个临时验证标签已关闭，视口覆盖已重置；未关闭用户原预览标签。

当前仍是 M1 虚构样板，没有接入真实认证、数据库、生产写入或新的销售能力。原 ZIP 与历史原型未修改。

## 组件与样式复用声明

2026-09-30 用户要求在项目声明后续功能的统一组件和样式复用。已在根目录 `AGENTS.md` 写入强制规则，新增 `components/AGENTS.md` 局部继承约束及 [组件与样式复用规范](06-ui-components-and-styles.md)，README 与连续记忆已链接这些入口。

规范索引当前真实的 `Brand`、`SelectControl`、`AppShell` 与整机 `UnitIcon`，并区分公共 CSS 类与尚未实现的通用 React 组件；明确先复用后扩展、语义 token、模块边界、选择器渐进增强及公共修改回归要求。

本轮仅修改声明与文档，核对引用和实际实现对应关系；没有重跑页面、lint、typecheck、测试或构建，没有新增自动化 CI 门禁，不改变现有业务或后端授权。此前视觉与业务验证证据仍保留在各自记录中。

## 维修闭环研究与独立设计提案

2026-09-30 用户要求研究 SeaTable 日常记录与旧 `chinatech.in`，建立维修闭环及桌面、手机页面设计。本轮交付 [闭环规格](07-repairs-functional-spec.md) 与 [独立交互设计稿](../prototypes/repairs/closed-loop-v2/index.html)，当前应用的维修列表、详情、接机表单和后端均未替换。规格中的跟进阈值、欠款交机策略等是建议方案，尚未作为已确认业务规则实施。

只读研究两站的维修字段、视图、队列、代表详情、接单表单、采购视图和取机任务；未提交真实工单、状态变更、采购、联系或收退款。SeaTable 的 `DATA RITIRO` 在可见字段标记为最后修改时间，不能作为实际取机事件。旧状态中的维修进度、设备保管、寄修、沟通与欠款需要拆开事实；旧站当前步骤、下一步和负责人值得保留。未遍历全部记录或核验旧站服务端逻辑，不保存真实客户或解锁资料。

设计稿复用现有 `Brand`、`AppShell` 的虚构页面渲染结构及公共 CSS/token；新增样式仅在新原型目录内。详情同时展示维修与授权、设备保管、配件下单到货、客户结算。手机单栏、两列摘要、紧凑队列与列表，底部下一步在主导航上方；桌面采用工作内容和操作历史双栏。没有新增公共组件或 token，原型与历史原件保持原样。

实际浏览器检查：1440、1024、390、375 代表宽度下的列表和详情；所查页面无横向溢出。375 的搜索和操作输入均为 16px，列表打开入口和主要操作为 44px，关闭面板为 44×44px；底部操作条与主导航相接且没有覆盖。修正了手机历史区过早、列表首屏信息不足、搜索字号和底部间距。

实际点击：草稿到已下单、到件但仍未留下设备、实际接机后才允许开始、维修送测、失败返修、测试通过、未接通继续跟进、欠款例外交机、超额收款拒绝、分次收款与明确结案、结案进入历史、搜索空结果与清除、部分到货和原生超量校验、未修复交还与检测费余额退款、外修回店后测试、客户确认不自动下单、手机菜单开关和 Esc 关闭弹层。状态仅在设计页内存中变化；不证明正式幂等、事务、权限、采购异常、报价版本编辑或售后建单已经实现。

定向通过 `node --check prototypes/repairs/closed-loop-v2/design.js` 与 ESLint `--no-ignore` 检查。默认 lint 忽略整个 prototypes 目录，因此没有把“文件被忽略”的结果当作校验成功。设计页的浏览器日志没有 warning/error；未重跑当前应用 lint、typecheck、规则测试或构建。

证据：[桌面列表](../.local/ui-proof/repair-design-20260930/list-1440.png)、[桌面详情](../.local/ui-proof/repair-design-20260930/detail-1440.png)、[1024 详情](../.local/ui-proof/repair-design-20260930/detail-1024.png)、[390 列表](../.local/ui-proof/repair-design-20260930/list-390.png)、[375 详情首屏](../.local/ui-proof/repair-design-20260930/detail-375.png)。独立预览为 `http://127.0.0.1:8766/prototypes/repairs/closed-loop-v2/`，只提供设计稿和公共 CSS；不暴露整个项目目录，启动方式见原型 README。

## 工单设计稿布局整理

2026-09-30 按用户的三条页面批注，修改独立 `closed-loop-v2` 设计稿：移除全局顶栏、说明横幅、重复标题与列表四张统计卡；标题、新建同排，队列数量只保留一份，搜索仅位于列表。侧栏底部改为账号姓名、门店和角色，账号菜单集中收纳通知、闭环说明、重置与返回当前应用；规划中的客户与门店入口折叠收纳。维修导航返回本稿列表，不再打开另一份维修页面。详情中四类业务事实仍保留。

复用捕获的 Brand/AppShell 结构、既有按钮、面板、状态类与主题 token。样式与导航交互只作用于本原型，没有修改应用公共框架、公共 CSS、数据库或真实账号。账号和通知仍属预览，通知没有接入服务。

实际检查列表与代表详情的 1440、1024、390、375 布局，所查页面没有横向溢出。列表标题区桌面 64px、手机 56px；手机搜索 16px，菜单和新建按钮 44×44px / 44px。375 详情的下一步操作条下边缘与主导航上边缘均为 752px，未互相遮挡。实际点击筛选、搜索空结果与清除、详情返回原队列、新建说明、规划入口开关、账号信息、通知说明、闭环说明、记录虚构下单后通过账号菜单重置，以及侧栏关闭按钮、遮罩、Esc 和 Tab/Shift+Tab 焦点循环。修正了遮罩中心落在侧栏下方和折叠内容参与焦点循环的问题，再次验证通过。

定向 `node --check`、ESLint `--no-ignore`、HTML 唯一 ID / 单一 main 和 CSS 块检查通过；未重跑当前应用的 typecheck、规则测试或 build。没有改变原有维修状态迁移规则，也未重新验证全部闭环分支。新证据：[1440 列表](../.local/ui-proof/repair-layout-20260930/list-1440.png)、[账号菜单](../.local/ui-proof/repair-layout-20260930/account-menu-1440.png)、[1024 列表](../.local/ui-proof/repair-layout-20260930/list-1024.png)、[390 列表](../.local/ui-proof/repair-layout-20260930/list-390.png)、[390 账号菜单](../.local/ui-proof/repair-layout-20260930/account-menu-390.png)、[375 列表](../.local/ui-proof/repair-layout-20260930/list-375.png)、[375 详情](../.local/ui-proof/repair-layout-20260930/detail-375.png)。

## 当前应用：加车、实际下单与工单快捷操作

2026-09-30 用户确认文案“已加购物车 · 未下单”，并要求按供应商购物车流程整理工单快捷操作。本轮修改当前 Next.js 应用，独立原型与历史原件保持不变。完整闭环设计见 [维修规格](07-repairs-functional-spec.md)。

- 采购新增加车和带原因移出事件，数量必须为零；实际下单单独记录供应商确认订单号。加车不算下单，不能提前登记到货，实际下单后不能用移出购物车撤销事实。
- 工单列表改为必需配件进度分组与紧凑队列，维修阶段独立筛选。必需数量全部加车才进入加车组；部分条目下单为“部分已下单”；必需项全部下单才进入“已下单”，分次到货另显示数量。备选不进入必需分母；没有必需记录显示“配件待核对”。
- 列表、工单详情与采购详情复用 `ProcurementPreparation` 和同一提供器；多配件用 `SelectControl` 选择本次条目。原生模态框提供关闭、Esc 和焦点管理，分组改变时给出可关闭成功提示。
- 按批注移除详情大号标题块，改为一行返回和操作工具栏；工单号收进设备面板标题，阶段与优先级进入设备事实。
- 手机采购筛选改为横向短队列，避免五张卡导致标签截断。复用 AppShell、按钮/面板/表单语义类与现有 token；新样式限于模块作用域，没有新增 UI 框架或主题，组件索引已同步。

| 当前状态 | 预览行为 |
| --- | --- |
| 待选配件 | 可记录已发生的加车，也可直接记录实际下单 |
| 已加购物车 · 未下单 | 不允许到货，实际单号必填；可带原因移出并保留历史 |
| 部分已下单 | 只更新本次条目，其他未下单项保留 |
| 已下单 / 部分到货 | 继续分次到货和追加式更正，不自动改维修阶段或报价 |
| 已登记配件到齐 | 仅指已登记必需采购数量，尚无质量核验或完整需求分配 |
| 配件待核对 | 未登记必需条目，不推断为无需配件 |

实际通过 `npm run lint`、`npm run typecheck`、`npm run test`（采购 13 + 整机 15，共 28 项）和 `npm run build`。新增规则测试覆盖购物车不等于下单、未下单到货拦截、重复/非法事件、移出原因、实际单号、历史保留、多条必需数量聚合、备选与其他工单排除，以及到货更正恢复分组。

浏览器检查维修列表与详情的 1440、1024、390、375 代表宽度；采购列表/详情在桌面、平板、手机代表宽度走查，所查页面没有页面级横向溢出。手机搜索和表单输入 16px、模态关闭与主要操作 44px，详情工具栏在所查宽度为 44px。修正维修搜索原有 13px 字号和采购五列筛选标签截断。没有跨浏览器或全部状态穷举。

实际点击创建虚构两件采购、加车后进入加车组、加车与移出保留历史、缺单号拒绝、记录实际订单后进入已下单组、登记一件到货显示 1/2、工单与采购页面同源更新；另查两条必需配件中的部分下单、备选不改变主分组、搜索空结果与清除、阶段筛选、不分组、采购按状态分组与加车筛选、详情快捷表单、模态 Esc 关闭及焦点返回。新操作没有更改报价版本或维修 fixture。开发期有正常 Fast Refresh 全页重载提示导致预览内存恢复；浏览器未记录运行时 error。

证据：[桌面工单分组](../.local/ui-proof/repair-cart-20260930/list-1440.png)、[紧凑详情](../.local/ui-proof/repair-cart-20260930/detail-1440.png)、[1024 详情](../.local/ui-proof/repair-cart-20260930/detail-1024.png)、[390 快捷操作](../.local/ui-proof/repair-cart-20260930/cart-shortcut-390.png)、[375 详情](../.local/ui-proof/repair-cart-20260930/detail-375.png)、[390 采购加车队列](../.local/ui-proof/repair-cart-20260930/procurement-cart-390.png)。

仍是 M1 内存样板：同一标签客户端导航共用记录，刷新恢复，独立标签不实时同步。没有数据库、真实认证、供应商网站同步、发单或付款。当前只支持逐条整条数量下单；供应商合单、同条部分数量结账、缺货替换、取消退货退款及完整设备保管/授权/测试/交还/结案应用流程仍是后续范围。规格已补充合单只分配实际购买条目、设备未留下则安排送机、交机欠款继续跟进的规则，这些设计不能当作已实现能力。

## 六组闭环与到货通知规划

2026-09-30 用户要求按接单、处理中、下单、到货、完成、作废重新规划完整闭环，并融合购物车和到货后的已通知/未通知。已交付 [六组与到货通知规划](08-repair-groups-and-arrival-notification-plan.md)，同步维修规格入口与连续记忆；没有修改应用代码或原型。

规划采用一单一个主组，采购状态、设备保管、沟通和结算事实独立。购物车归下单子状态；部分到货继续在下单显示数量，当前必需配件核验齐备才进入到货。到货通知与设备已留/未留组合成四种情况；实际开始维修回到处理中，仍保留到货与沟通历史。完成包含取机、交还、待结算和结案；作废包含待收尾与已收尾，不删除真实事实。无配件项目跳过采购与到货，多项目并行时保留剩余采购待办。

用户已明确六组方向和通知切片。通知具体口径暂按成功告知本次到货、未接通仍未通知；未留机通知送机、已留机告知维修安排。到货通知不自动代表取机通知或报价授权，已留机也不自动变为已通知。该成功口径和已留机未通知原则上不阻止已有授权维修，均为建议，尚未获得用户确认。

本轮只进行规划一致性与文档引用核对，没有运行 lint、typecheck、规则测试、构建或浏览器测试，也未发送通知、修改供应商订单或实际款项。当前应用仍是上轮的 M1 采购分组和内存快捷操作，新六组及通知等完整维修能力尚未实施。

## 最新修正：配件一键标记与到货通知豁免

2026-09-30 用户明确：已留下设备不需要到货通知；配件只需标记是否加入购物车，无需填写供应商订单号。此规则覆盖上面的必填订单号、带原因移出和已留机到货沟通建议，早期记录仅供追溯。

已将当前 M1 工单列表快捷弹层、工单详情和采购详情中的准备操作统一简化为“标记已加购物车 / 取消加车标记”和“标记已下单”按钮。没有订单号、备注或取消原因输入；自动追加时间与操作历史。新建采购也移除了订单号字段；原有历史单号只读保留，无单号不显示空字段。复用 `ProcurementPreparation`、采购提供器、`SelectControl`、既有按钮与反馈 CSS，无新增公共组件、token 或样式。

下单仍是供应商实际结账后由员工做的事实标记。标记加车不增加下单和到货数量；实际下单后不能通过取消加车撤销采购事实。必需配件聚合与备选排除继续沿用；部分下单和全部下单仍准确分组。

已同步 [六组规划](08-repair-groups-and-arrival-notification-plan.md) 与 [维修规格](07-repairs-functional-spec.md)：到货未留设备分未通知送机 / 已通知待送机；设备已留显示无需到货通知并待安排维修，不计入已通知或未通知数量。实际接机后送机通知待办转为无需通知，保留原联系历史；取机通知独立处理。新六组与通知仍是规划，未将其冒充已实现页面。

验证：实际通过 lint、typecheck、28 项规则测试（采购 13 + 整机 15）和 build。调整既有采购测试覆盖空单号下单、无需原因取消加车、重复/数量拦截及历史保留；到货、更正、分组与整机测试继续通过。检查修改后的客户端组件，事件类型受限、hook 无条件执行，没有复制状态来源。

浏览器实际检查快捷弹层 1440、1024、390、375；另查工单详情 1440/375 和采购详情、新建草稿 375。所查视图没有页面级横向溢出；手机选择器与新建输入 16px，快捷操作与返回按钮 44px。实际完成加车 → 取消 → 再加车 → 空单号标记下单，工单从部分已下单变为已下单，到货仍为 0；创建无单号虚构草稿、采购加车同步工单详情、详情取消加车、备选不改必需分组，以及 Esc 关闭/焦点返回。验证标签未记录 warning/error；未重新执行到货 UI、跨浏览器或全部应用流程。

证据：[1440 一键标记](../.local/ui-proof/repair-markers-20260930/shortcut-1440.png)、[1024 快捷操作](../.local/ui-proof/repair-markers-20260930/shortcut-1024.png)、[390 手机](../.local/ui-proof/repair-markers-20260930/shortcut-390.png)、[375 手机](../.local/ui-proof/repair-markers-20260930/shortcut-375.png)。原有预览服务已停止，确认 3000 无监听后重启本项目 dev 服务（仅监听 127.0.0.1）；未停止其他进程。现有浏览器标签绑定失败后新建验证标签，原标签保留；视口覆盖已重置。

限制：仍是本次标签内的 M1 预览内存，刷新恢复。没有正式数据库、通知发送或供应商下单。六组、保管交接、到货通知和完整维修收尾待后续实施。

## 后台统一电脑与手机两套布局

2026-09-30 用户要求中间窗口也使用电脑端布局。当前 `/app/*` 已统一为 768px 及以上电脑结构、767px 及以下手机结构，覆盖旧的 1199px 折叠侧栏和 980px 单栏详情规则。电脑侧栏按空间调整宽度，完整列、详情双栏与工作台结构保持；筛选允许换行，宽表格仅在面板内滚动。手机继续用抽屉、单栏卡片和底部主导航，不缩小文字输入和触控目标。公开首页、认证页面仍按内容保留原有响应规则，独立 8766 原型未改。

复用 `AppShell`、既有按钮/表单/面板、语义 token 与 `SelectControl`；新增公共 `.module-table-scroll` 样式并同步复用规范。维修、采购、整机与工作台的表格滚动区域提供名称和键盘焦点，列表工具栏不随表格横移。表单字段在电脑结构内最多两列，空间不足时自动换行。只增加语义容器和 CSS，没有新依赖、状态来源或业务迁移。

实际通过 `npm run lint`、`npm run typecheck`、`npm run test`（采购 13 + 整机 15，共 28 项）和 `npm run build`。维修列表覆盖 1440/1024/390/375；采购、整机列表/详情与工作台检查代表桌面、窄电脑和手机宽度，并实测 767/768 边界。另查接机与整机建档 1024/768/375，公开首页、登录和注册 750 共享样式。所查页面无整页横向溢出；768 整机表格内容 754px、区域 558px，键盘右移后仅区域滚动。390 手机搜索/选择器 16px、配件操作 44px，375 菜单 44×44px。

实际验证维修与采购搜索/清除、工单空结果与恢复、侧栏和底部导航、手机抽屉开关、表格键盘滚动、窄电脑配件快捷弹层打开/Esc 关闭/焦点返回、接机与建档表单换步、登录密码显隐及注册入口。未提交真实账号、工单或单机，也未改采购标记等业务事实。最终临时验证标签未记录 warning/error；已关闭该标签、重置视口覆盖，并将原预览标签恢复到维修列表、保留其内存演示状态。

证据：[1440 工单](../.local/ui-proof/two-layouts-20260930/repairs-1440.png)、[1024 完整电脑布局](../.local/ui-proof/two-layouts-20260930/repairs-1024.png)、[390 手机](../.local/ui-proof/two-layouts-20260930/repairs-390.png)、[375 手机](../.local/ui-proof/two-layouts-20260930/repairs-375.png)、[1024 采购](../.local/ui-proof/two-layouts-20260930/procurement-1024.png)、[1024 整机详情](../.local/ui-proof/two-layouts-20260930/retail-detail-1024.png)、[1024 工作台](../.local/ui-proof/two-layouts-20260930/dashboard-1024.png)、[1024 接机表单](../.local/ui-proof/two-layouts-20260930/intake-1024.png)。

本轮是当前 M1 应用布局调整，没有重新执行完整维修/到货闭环、全部状态或跨浏览器验证。六组和到货通知仍按规划待实施；真实认证、数据库、外部发送和生产部署不在本轮范围。

## 简洁导航、可收起侧栏与维修扫码（2026-09-30）

用户最新批注覆盖此前顶部工具栏和手机底部主导航规则。当前应用已取消全局顶栏、底栏、页面眉题与功能解释，保留标题和必要业务反馈；账号、通知及退出收进侧栏底部。展开侧栏复用 Figma `nhZ37YLOUVP8zpDBBGihhS` 的仪表盘侧栏 `12327:112060`：白色品牌区、灰底导航、紫色选中边与底部账号卡；电脑可主动收成 72px 图标栏，手机从标题行打开 270px 抽屉。切换点仍是 767/768，不增加平板样式。

新增公共 `PageTitle` / `SidebarToggle` 承载各模块标题和手机菜单，复用 `Brand`、`AppShell`、现有 CSS/token；成功页和采购/整机缺记录状态也保留导航。维修、采购、整机及工作台共用框架，移除已失效的顶部/底部间距和样式。没有新增框架、主题或图标库。

新增维修专用 `RepairScanner`，工作台与工单列表复用相机、相册、手动查单。按需加载 `@zxing/browser`，默认后置镜头，支持镜头切换、内联视频、权限/占用/无设备提示及启动超时恢复；关闭、后台和卸载停止扫描，过期异步返回不会重开镜头。相册只在本地解码并释放 ObjectURL。工单号、SN/IMEI 与本站工单路径只返回已知候选，用户点击查看；外链、未知值不会打开或新建记录。没有关联生产数据、发送图片或改变维修事实。

最终通过 lint、typecheck、32 项测试（采购 13、整机 15、扫码 4）和 build。扫码测试使用实际 QR 解码后匹配工单，另覆盖精确/多候选、未知与外链、权限错误提示。React 定向自检确认 hook 无条件调用、扫码依赖延迟加载、异步取消与媒体清理、模态语义和共享选择器复用；没有为纯布局复制实现型测试。

当前应用检查覆盖维修列表 1440/1024/390/375，采购列表/新建与整机列表/新建/详情、工作台和接机表单在受影响代表宽度走查。所查页面无整页横向溢出，1024 保留完整电脑列和双栏详情；手机菜单/关闭 44px、输入 16px。实测侧栏展开/收起、抽屉关闭/Esc/焦点返回、跨模块导航、账号菜单与通知、本地退出返回首页和重新演示登录；接机四步仅使用虚构内容校验成功并验证成功页菜单，没有创建真实记录。

IAB 实测相册二维码找到已知工单、序列号查找、外链无匹配、候选详情跳转与弹层关闭；相机未开启时的 15 秒恢复也已看到。桌面 Chrome 实测手动查单、Esc/焦点返回；macOS Safari 实测手动输入和本地相册二维码识别。**没有完成 iOS/Android 实机相机、真实扫码枪或打印机验收**，权限成功和活体镜头解码不能由响应式截图证明。相机需要 HTTPS 或浏览器认可的 localhost；当前扫码只查虚构 fixture。通知界面仍为“暂无通知”占位，六组和到货通知仍未实施。

证据：[1440 展开](../.local/ui-proof/navigation-scan-20260930/repairs-desktop-1440.png)、[1440 收起](../.local/ui-proof/navigation-scan-20260930/desktop-collapsed-1440.png)、[1024 电脑](../.local/ui-proof/navigation-scan-20260930/repairs-desktop-1024.png)、[375 手机](../.local/ui-proof/navigation-scan-20260930/repairs-mobile-375.png)、[375 抽屉](../.local/ui-proof/navigation-scan-20260930/menu-mobile-375.png)、[390 相册识码](../.local/ui-proof/navigation-scan-20260930/scan-photo-result-390.png)、[1024 账号菜单](../.local/ui-proof/navigation-scan-20260930/account-desktop-1024.png)。详细行为与浏览器限制见 [维修规格](07-repairs-functional-spec.md#当前-m1-查单扫码)。 临时 Chrome/Safari 验证标签已关闭，IAB 视口已重置，最终维修预览标签保留；用户原有标签未改。

## 图形化分组表格与更新时间排序（2026-09-30）

用户要求先分析排版层级再执行，分组默认收起，最新更新的工单位于组底；已确认排序沿用 SeaTable 修改时间升序、建单时间升序。只读核验指定视图 `tid=1u9H&vid=x4FH`：STATO 升序分组，DATA RITIRO / DATA AGGIUNTA 两列升序，排除作废，视图锁定；分组菜单有折叠全部/展开全部。可见的复合状态需拆为工作、设备、沟通、结算事实，不修改真实记录或推断全量统计。

Figma 核验任务列表 `12327:116272`、实际表格 `12327:117916`、分组标题 `12327:117918`、行末入口 `12327:117964`，以及任务详情弹层 `12327:136741`、创建弹层 `12327:131690`。借鉴色条、图标短标签、数量徽标、细线与对齐列；未核验行末菜单展开内容，不照搬模板时间计数或业务。分析先保存到 [图形化表格规划](09-repair-table-layout-plan.md)，再修改应用。

已实施当前采购组的默认收起、逐组/全部切换，删除重复队列数量栏，把配件条件收进共享选择器。保持六列，类别改真实品类图标，维修阶段改图标短标签，负责人配优先级旗标与更新时间；加车、下单、到货分别显示图标和实际数量。桌面约 70px 数据行，窄电脑仅表格内部横滚，分组标题在横滚时仍可操作；手机维持卡片、16px 输入字号与 44px 主要操作。

新增明确的虚构建单/修改时间，独立于接机时间；共享采购提供器仅在成功新建或追加操作后更新关联工单修改时间。修改时间记录本次提交，不能用补记历史到货时间代替。失败和界面操作不更新时间。排序 helper 保持同时间按建单和编号稳定排列；当前仍是客户端门店时间，正式版需服务端权威时间。

复用 PageTitle、AppShell、SelectControl、采购事实和现有图标/token；`RepairProcurementShortcut` / `RepairProcurementDialog` 分离图标入口与组外弹层，换组不卸载。关闭后打开目标组并定位该工单；重开默认选择待处理配件，Esc 与多配件选择继续有效。没有新 UI 框架、图标库、生产写入或客户消息。

实际通过 lint、typecheck、35 项规则测试（采购13、排序3、扫码4、整机15）及 build。IAB 实测 1440/1024/390/375：默认收起与重新进入、全部/单组/键盘展开、空筛选与恢复、搜索、完整列及键盘内部横滚、手机触控和字号。实测 MacBook 加车不增加下单量、无需订单号下单后换组并排底，弹层保持打开；ThinkPad 备选修改不改变必需分组但移到组底、取消/Esc/焦点返回、多配件重开选择重置。无效到货数量被拒绝，返回列表的修改时间不变。验证标签读取未见 warning/error；未重跑扫码硬件或完整维修闭环。

证据：[桌面展开](../.local/ui-proof/repair-table-groups-20260930/expanded-1440.png)、[桌面默认收起](../.local/ui-proof/repair-table-groups-20260930/folded-1440.png)、[手机展开](../.local/ui-proof/repair-table-groups-20260930/expanded-390.png)、[375 默认收起](../.local/ui-proof/repair-table-groups-20260930/folded-375.png)、[手机加车弹层](../.local/ui-proof/repair-table-groups-20260930/cart-dialog-390.png)。1024 横滚截图早于标题固定补丁；补丁后已实际查看可见页面，并核验标题左边界与滚动容器一致。手机截图对应的手机 CSS 保持不变，最终标题固定与容器规则仅作用于电脑宽度。

收尾复用旧预览标签时发生绑定超时，随后尺寸设置也超时；已停止反复设置，原标签与真实 SeaTable 内容保持不变。新增验证标签的连接已恢复、标记保留，并实际切回全部收起；原标签未关闭。最后单独尝试重置测试视口也超时，因此清理未确认。保留已有截图，不以未完成的收尾捕获冒充新证据。六主组、设备保管、通知与收尾仍为规划，当前 M1 刷新恢复 fixture，不写库、不发单。

## 2026-09-30｜接机字段、共享识码、照片和打印

按最新十条批注保持四步与现有 UI/token：电话可编辑搜索＋显式客户选择，称呼选填；候选修改后解除关联。类别/品牌/型号关联可搜索或手填，颜色常用选择＋其他，随件多选＋自定义。Chrome 实际研究旧站空白新建页的故障分类/细分、随件与照片入口，以及 A5 横向、A4 横向、上半、双联纸张选择。未创建或提交真实工单；不把旧站报价品质项直接作为本次故障结论。

新增 `SearchCombobox`、`MultiChoice` 与公共 `IdentifierField` / `IdentifierScanner`，维修查单继续走同一镜头/相册生命周期，工单、客户设备及待售单机的匹配/查重保持模块分离。接机 SN/IMEI、整机 SN/IMEI1/IMEI2、整机识码查询全部带扫描确认。历史精确标识跨客户查询，同型号另列参考，不带入历史客户。照片前/后各一、其他最多四，拍照 capture/文件选择、本地预览、替换删除和 URL 释放；拒绝非图像、空文件和超大文件，并在成功解码后才替换旧图/计数，等待时禁止下一步。打印当前接机数据，四种纸张与客户/门店双联；没有正式单号或接机写库。

独立只读审查发现并修复：键盘候选后部不可见（选中项自动滚入菜单）、客户修改后旧关联徽标、空/损坏照片错误计数；打印 body 范围和跨客户查找未发现误绑定。更新根/组件复用约束与 docs/06、07，未加框架或图标库。

最终 lint、typecheck、43 项测试与 build 通过。新增 4 项设备标识和 4 项接机规则测试，覆盖电话规范/短查询、品牌候选、跨客户同设备与同型号区分、故障组合及文件校验；二维码测试实际解码后匹配。构建期间发现 `.next/types/* 2.ts` 的相同内容复制缓存，逐一确认与原件字节一致后清除；构建后复制件再次出现，已仅排除 `.next/types/* 2.ts` / `.next/dev/types/* 2.ts`；原始生成文件、所有业务源码和 strict 检查保持覆盖，未改变测试断言。

Chrome 实际验收候选键盘选择、改号码、改称呼解除关联、无姓名推进、品牌/型号关联与手填、颜色其他、扫描拒绝网址/先确认/历史命中，故障/随件多选、确认必选、当前数据纸张切换、Esc 关闭和整机 IMEI 格式/确认/查到候选。修复后第 9 项键盘候选位于菜单可视区域，手填型号可继续，客户徽标已解除。

IAB 实际验收正面/背面/两张其他文件，均 `naturalWidth > 0`，无效非图像保留旧图、删除减少照片数；核对/接机预览为同一次填写的数据；1440/1024/390/375 宽度与对应截图已检查，所查无整页横向溢出，手机输入 16px、故障细分按钮至少44px。后续空/损坏图解码修复通过规则测试及静态检查，但**未完成修复后的再次文件交互**：触发系统打印后 IAB 鼠标不响应，新标签和可访问点击也无变化，已停止重复尝试。

打印预览及四种纸张已验证；触发原生打印时 CDP 输入超时。工具明确禁止操作 `com.openai.codex` 系统窗口，因此无法自动读取/取消系统打印，已向用户请求手动取消。没有执行真实打印，也没有证实硬件纸张排版；等待取消的标签8已标记保留。收尾已确认 Chrome 测试视口恢复 1437×771、IAB 恢复1280×720；维修原有扫码入口用 SN 返回已知工单候选也已补验收，研究和普通验证 Chrome 标签已关闭，最终接机 Chrome 标签保留。系统打印标签8仍待用户处理。Chrome自动图片选择因扩展缺少 file URL 权限失败，未修改扩展设置；前述实际照片验收改在 IAB 完成。真实 iOS/Android 相机、Safari 本轮、HEIC 实机解码均未验收。真实客户/历史数据库、云端照片、正式保存仍未接入。

证据：`.local/ui-proof/intake-20260930/`，包括 [最终电脑故障界面](../.local/ui-proof/intake-20260930/final-faults-1440.png)、[设备与历史](../.local/ui-proof/intake-20260930/device-1440.png)、[1024照片](../.local/ui-proof/intake-20260930/faults-photos-1024.png)、[390手机](../.local/ui-proof/intake-20260930/faults-photos-390.png)、[375打印](../.local/ui-proof/intake-20260930/receipt-375.png)、[双联预览](../.local/ui-proof/intake-20260930/receipt-double-1440.png)、[整机IMEI](../.local/ui-proof/intake-20260930/retail-imei-390.png)。照片截图早于解码修复，照片布局未变；不能冒充新的损坏图/空图浏览器验收。

## 2026-10-01｜图形核对、配件规格、真实拍照与接机二维码

按最新七条批注先梳理层级再实施：颜色用实际色块＋标签，常用颜色弹出单选、自定义手填；屏幕原装/组装与 Incell/TFT/OLED、电池原装/组装及 Apple 扩容/跑诊断/两者、尾插原装/组装分别记录客户请求。取消故障清除对应规格，改为非 Apple 清除苹果处理，原装屏清除组装技术；这些选择不作为诊断、报价或客户授权。核对页改为设备主卡、联系资料、维修需求、随件与照片缩略图，修改按钮回到对应步骤并要求重新核对。电脑保持侧边步骤＋双列核对，手机单栏。

新增公共 `SingleChoice` / `ColorPicker` / `PhotoCapture`，复用原生 radio、项目图标、按钮和 token；普通下拉继续用 `SelectControl`。拍照改为 `getUserMedia`，预览确认后才加入照片，可重拍或上传回退，关闭/后台/卸载释放镜头与临时 URL。照片仍只在当前接机预览，不写本地存储或云端。新增维修专用 `IntakeReview`，接机核对与本地详情共用；`SearchCombobox` 增加 `maxLength`。

为使接机二维码可查到本次新记录，M1 增加版本化浏览器本地接机存储和 `LOCAL-…` 编号，保存后出现在维修列表、查单和标识历史；同次表单修改沿用编号，刷新可读。没有生产写库、真实认证或跨设备服务。采购创建/列表/详情统一消费合并目录，工单摘要继续读取同源采购提供器；采购标记本身仍仅内存，刷新恢复。存储异常不覆盖原记录，容量为 100 张。独立定向审查修复了标识长度不一致、服务枚举非字符串接受和存储权限失败后缓存无法恢复；未改变其他模块身份与数据边界。

打印按用户提供的意大利样张，两栏依次排列订单/客户、设备、请求、诊断、款项、服务，以及门店、二维码、保修条款和签名；默认 A4 横向，另保留 A5 横向、A4 上半页与双联。保修条款取自用户样张；没有填写的报价、款项、保管和保修期保持未记录/待确认。二维码实际编码本站工单地址，不含客户联系方式或设备标识；当前仅能在创建记录的浏览器与预览会话查找，未提供公开跨设备进度查询。

最终 lint、typecheck、47 项规则测试及 build 通过，日志位于 `.local/ui-proof/intake-refinements-20260930/`。四项新增测试覆盖配件条件清理、本地记录格式与未知金额、存储异常/同编号更新，以及真实 QR 编码解码后匹配本地工单；没有为颜色间距复制实现型测试。React 定向检查保持 hook 无条件、重计算不引入副作用、拍照异步取消/清理、识码依赖按需加载及共享控件边界。

实际浏览器验证：无姓名推进、颜色色块、原装/组装切换、Apple→Samsung→Apple 不带回旧处理、核对必选/返回修改、有效前后照片与损坏/空图失败保留旧图。IAB 在 Mac 上真实开启 1920×1080 镜头、拍摄、重拍与关闭释放，真实镜头照片未保存或截图；上传回退确认使用虚构照片。1440/1024/390/375 核对页均无整页横向溢出，桌面保留双列与可见保存按钮，手机单栏/主操作至少44px。已有手机输入16px规则保留。

实际保存虚构接机单后刷新详情、按编号/SN 搜索、将打印预览上的 QR 截图通过相册识码找到同一记录并打开详情；随后关联虚构采购草稿、加车，详情与列表显示“已加购物车 · 未下单”，实际下单仍为0；采购列表新工单筛选、型号搜索和按工单分组均已验证。没有执行外部供应商下单或发送客户消息。

四种纸张与双联结构/页面规则已检查，默认 A4 已补验证。代表三项维修请求的 A5 预览实测约733×495 CSS px，位于扣除8mm页边距后的194×132mm区域；双联两份合计尺寸也在 A4 可用高度内。375 打印预览单栏、宽351px且整页无横溢，打印按钮44px。以上为 DOM/预览尺寸证据，未再次触发原生打印，不证明实体纸张、长备注分页或打印机缩放。手机 Safari、iOS/Android 镜头与 HEIC 实机未验收；先前 IAB 已恢复可操作，本轮未停在打印对话框。

证据：[颜色色块](../.local/ui-proof/intake-refinements-20260930/colors-1440.png)、[图形核对](../.local/ui-proof/intake-refinements-20260930/review-1440.png)、[1024 电脑](../.local/ui-proof/intake-refinements-20260930/review-1024.png)、[390 手机](../.local/ui-proof/intake-refinements-20260930/review-390.png)、[375 手机](../.local/ui-proof/intake-refinements-20260930/review-375.png)、[A5 两栏](../.local/ui-proof/intake-refinements-20260930/receipt-a5-1440.png)、[二维码查单](../.local/ui-proof/intake-refinements-20260930/qr-lookup-1440.png)、[关联采购](../.local/ui-proof/intake-refinements-20260930/local-procurement-1440.png)、[本地工单详情](../.local/ui-proof/intake-refinements-20260930/local-detail-1440.png)。六主组、设备保管、到货通知与结案仍按既有规划待实施，本轮不表示完整维修闭环已上线。

## 后续实施暂停点

G1 视觉方向已于 2026-09-30 获用户确认，可按模块顺序继续交互样板。成员授权规则确认前不开放真实员工后台；没有用户授权不接生产、不覆盖旧站、不使用现有密钥、不实施任何有真实业务后果的操作。


## 2026-10-01 详情层级、统一返回与配件主次选项

用户要求先分析 Figma，再让本地新工单详情更直观，统一页面返回入口，并降低屏幕技术等细分选项的视觉权重。实际重新读取 Figma `nhZ37YLOUVP8zpDBBGihhS` 的详情弹层 `12327:136741` 截图及子实例 `12373:180275` 的完整设计上下文：借鉴窄操作栏、主标题、图标标签和值对齐、主辅分区及少量状态色；没有复制时间跟踪、AI 或模板业务。

- 本地详情取消大面板内连续堆叠：设备摘要在上，左侧维修需求和采购、右侧客户与随件。白色面板保持稳定，紫色强调设备与选择，黄色表示待检测；配件原装/组装与 OLED、苹果电池处理分层显示，联系电话可点击。仍复用 `IntakeReview`，通过维修模块的 `layout` 变体组合采购，未复制业务规则。
- 后台 `PageTitle` 统一图标返回、标题、可选状态和副说明；`.module-heading` 为页内 sticky 工具栏。工单、采购、整机详情和录入页面继承相同入口。手机详情动作收为有名称的 44px 图标按钮，固定栏约 62px；电脑保留图标＋文字。整机返回保留原搜索和状态参数。原手机整机固定搜索行改为随正文滚动，避免与工具栏重叠；账号退出仍在侧栏。
- 展开的屏幕、电池和尾插配件类型为主选项，屏幕技术与苹果电池处理收进浅灰次级区域；电脑与故障现象左右排列，空间不足时自然换行，手机单栏。复用 `SingleChoice` 和 `MultiChoice`；原装清空组装技术、非 Apple 清空苹果处理、取消故障清空规格的规则不变。确认页保留逐步核对的顺序与修改入口。

实际验证：IAB 在 1440、1024、390、375 宽度检查本地工单详情、既有工单详情、采购和整机详情，均无整页横向溢出；最终手机工具栏均 62px，返回按钮 44×44px。故障选择在四宽度无横溢，选项至少 44px，手机输入 16px。实际点击图标返回、手机菜单与 Esc、打印预览打开关闭、采购快捷折叠，以及整机搜索 `iPhone` / 可售后进入详情再返回（URL 条件保留）。实际验证屏幕键盘切换至原装后隐藏并清空组装技术、重新选择 OLED，Apple 电池原装和扩容跑诊断、改非 Apple 后清空处理、尾插组装，以及确认页修改设备入口。未创建新工单或修改采购/整机事实；截图与输入均为本地虚构样例。

本轮最终 `npm run lint`、`npm run typecheck`、47 项既有规则测试、`npm run build` 全部通过。未为样式添加镜像测试；React 复用与原生单选/多选语义已检查。日志与尺寸结果在 `.local/ui-proof/detail-hierarchy-20261001/`；浏览器未记录 warning/error。截图不能代替手机镜头或硬件打印，本轮仅打开打印预览，未触发原生打印。

代表截图：[桌面详情](../.local/ui-proof/detail-hierarchy-20261001/localRepair-1440.png)、[手机详情](../.local/ui-proof/detail-hierarchy-20261001/localRepair-375.png)、[桌面屏幕主次选择](../.local/ui-proof/detail-hierarchy-20261001/fault-screen-1440.png)、[手机故障选择](../.local/ui-proof/detail-hierarchy-20261001/fault-screen-375.png)。临时验证标签已整理，尺寸覆盖恢复；用户原有新建表单未改动，最终详情保留供查看。

仍为 M1：本地工单依赖当前浏览器，照片不持久保存；采购/整机事实是预览内存。未新增六主组、保管、到货通知、结案或正式权限/数据库，也未进行生产写入。


## 2026-10-01 维修／客户／门店管理：当前应用 M1

最新用户要求形成 [维修、客户与售出闭环框架](10-work-order-customer-loop.md)。维修整行可点，阶段及供应商／配件为独立按钮；列表和详情共用添加、未下单编辑、加车、下单、分批到货、追加更正与历史。主导航移除采购跟进，旧采购地址兼容保留。增加八阶段记录、六主组视图、保管核对与仅未留设备到齐后的人工通知标记；阶段不推断真实交机或结算。

客户按归一化号码分维修／售出记录，称呼选填，资料可新建和维护。接机与售出读同一候选目录。可售单机可登记手机号及明确成交价，保留单机身份、成本快照、历史与幂等／版本检查；收款金额仍未知、交付未确认。客户设备按精确标识查看历史，同型号不合并身份。

头像内进入门店资料、供应商启停和联系资料、手动经营收支、打印默认设置。收入／支出按整数欧分，作废保留原金额和原因，销售／报价／采购不自动记作实际收付款。打印共用两栏接机单，读取当前阶段、保管、已知报价和门店资料，未知款项不填零。

工单、状态、采购、客户、单机与设置使用独立版本化浏览器存储。独立审查发现并已修复：临时读失败同内容无法恢复；采购超过1000条／1000事件保存后读不回；写入成功后的额外读取异常误报保存失败。真实存储函数的内存隔离测试覆盖恢复、损坏不覆盖、容量边界、写失败、旧版本、加车资料更正与历史保留。编辑弹层保留打开时的期望版本；门店资料与打印仅保存各自字段。

最终实际检查：`npm run lint`、`npm run typecheck`、71项测试与`npm run build`通过。未放宽断言或检查。新增客户、售出、工作流、存储边界规则测试；旧接机存储测试只补齐新依赖，原断言保留。

浏览器真实验证：

- 维修列表1440、1024、390、375均无整页横溢；电脑74px行，手机134–135px卡片、收起筛选区113px、阶段按钮44px；1024表格内部横向滚动266px，桌面列保留。实测客户文字所在行区域点击进入详情；配件／阶段入口不会触发行跳转。
- 实测默认折叠、全部展开／收起、手机筛选展开收起、六主组切换、搜索；列表及详情打开同一配件弹层，切换草稿／已下单条目、查看未下单编辑表单、关闭返回；阶段选择作废显示必填原因并取消，不改现有事实。
- 工单详情、门店收支页、客户设备页四宽度无横溢；详情返回44px，手机供应商编辑／设备搜索输入16px。头像菜单在手机实际打开并进入收支；供应商编辑取消、打印设置进入可用。三位小数金额在页面被拒绝，未新增收支。
- 客户列表、详情、售出表单各四宽度无横溢，共12张截图。Chrome实际新建明确DEMO客户、编辑备注、刷新、搜索与空态、售出候选键盘确认；未改真实客户。
- 打印预览打开／关闭、默认A4、双联两份二维码已实测；未调用原生打印。客户设备展开精确历史并点击回工单。

证据：`.local/ui-proof/unified-loop-20261001/` 与 `.local/ui-proof/customer-sales-20261001/`。前者只保留fixture和明确DEMO数据，用户原新建表单未改动；临时宽度已恢复。

此前自动审批因认为测试提交未获授权拒绝最后提交；用户于2026-10-01明确回复「是 帮我测试」后，实际点击本地`demo-unit-1`（`CT-26-0001`）的「确认登记售出」。测试仅用DEMO称呼、虚构号码和€260成交价。单机变为已售出、版本1→2、时间线由一条建档记录增加为两条，新增一条售出记录；原单机身份及成本资料保留。刷新单机页后状态与销售历史仍在；从销售历史进入客户档案，维修记录0、销售记录1，内容对应同一单机和€260价格；刷新客户页后仍为一条，记录链接能返回同一单机。收款与交付仍显示未确认，未执行付款、真实出售、交付或发送。测试页error日志为空。

补验收截图：[提交成功](../.local/ui-proof/unified-loop-20261001/sale-submitted.png)、[单机刷新后](../.local/ui-proof/unified-loop-20261001/sale-after-reload.png)、[客户销售记录刷新后](../.local/ui-proof/unified-loop-20261001/customer-sale-after-reload.png)。结果保留在IAB标签15。本次仅浏览器测试和更新验收记录，未改源码或配置，沿用前轮已通过的lint、typecheck、71项测试与build，不将它们描述为本次重新执行。

仍为M1：仅当前浏览器、同源标签更新，无跨浏览器／跨设备资料或服务端权限事务；照片不持久。正式认证、数据库、外部下单／通知、支付、实际交机与完整结案、退货退款均未接入。旧轮「仅内存」限制仅对应旧实现，以本节为当前状态。

## 2026-10-01 账号菜单与详情精简

用户要求头像固定底部、菜单向上且移除重复管理入口；整机详情图形化并集中标识；工单详情将保管、接收时间、负责人归纳，压缩设备与故障。以既有 Figma 视觉语言和公共 token 为基础，参考 Carbon 的 [相关内容列表](https://carbondesignsystem.com/components/contained-list/usage/) 与 [小型状态标签](https://carbondesignsystem.com/components/tag/usage/) 收纳方式；未引入其组件库或业务内容。

- 头像摘要展开前后位置一致，菜单仅门店设置、通知、退出。供应商／经营收支／打印仍在门店设置内部。侧栏收起时菜单保留文字；手机 Esc 先关账号菜单，再关抽屉，Tab 首尾循环，通知关闭返回摘要。修复测试发现的 Esc 同时关闭抽屉和关闭抽屉后的残留阴影。
- Fixture 工单将设备、颜色色块、故障、随件合为紧凑卡，SN／IMEI 折叠；概况辅助卡集中阶段、保管小标记、时间、负责人、等待与预计交付；报价缩为三项，既有时间线收进历史。本地工单通过 `IntakeReview.asideContent` 复用同一概况，手机先概况与客户、再采购。保管展开仍使用 `SelectControl`，按打开时版本保存；到货通知条件未改。
- 单机摘要显示品类图标、颜色色块＋文字、实物标签、售价。内部编号、SN、包装码、IMEI 集中在一个折叠区，操作时间线默认收起。规格、检测与实物、金额来源、预留／销售分组；待检测状态的三项核验只在操作区编辑，其他状态保留只读结果。复用 `UnitIcon`、`ColorSwatch`、公共按钮与表单，没有新增主题或 UI 库。

实际浏览器验证使用独立 IAB 标签16，未改用户原标签或输入。Fixture 工单、LOCAL 详情、单机详情各检查1440、1024、390、375宽度，均无整页横向溢出。工单设备卡225.5px（电脑）／210.5px（手机），概况272.5px，手机客户卡91.5px；阶段与单机操作按钮44px，手机输入16px。头像在900px高视口展开前后均为 top832／bottom888，菜单 bottom824；收起侧栏菜单190px宽且完整显示三个入口。

实际点击：单机标识／时间线、同型号新建后取消返回、可售单机售出表单打开与取消、已预留电脑规格；工单标识／历史、保管展开与Esc、阶段弹层取消、打印预览打开关闭（二维码语义可见）、新增配件表单取消并关闭父弹层。手机账号菜单验证外部点击、Tab 首尾循环、两层Esc、通知打开关闭和门店设置导航。期间直接刷新返回登录，使用本地演示登录恢复继续验证；未使用真实账号。没有新增或更改业务事实，未执行原生打印、外部发单或客户消息。

本轮真正执行 `npm run lint`、`npm run typecheck`、71项既有规则／存储测试、`npm run build`，均通过；最后源码调整后再次完成lint、typecheck与build。React Hooks、事件清理、原生披露控件、焦点和共享状态组合已检查。独立只读审查未发现可证实回归；目录无Git历史，无法据历史diff复核，本轮未在浏览器提交保管变更或跨标签冲突，版本拒绝只经源码专项核对及既有规则测试。测试页warning／error日志为空，临时视口恢复。

证据：[维修电脑](../.local/ui-proof/compact-details-20261001/repair-1440.png)、[维修手机](../.local/ui-proof/compact-details-20261001/repair-375.png)、[单机电脑](../.local/ui-proof/compact-details-20261001/retail-1440.png)、[单机手机](../.local/ui-proof/compact-details-20261001/retail-375.png)、[头像向上菜单](../.local/ui-proof/compact-details-20261001/account-mobile-375.png)、[侧栏收起菜单](../.local/ui-proof/compact-details-20261001/account-collapsed-1024.png)、[本地详情](../.local/ui-proof/compact-details-20261001/local-repair-375.png)、[尺寸与交互记录](../.local/ui-proof/compact-details-20261001/verification.json)。新版工单保留在标签16供查看；仍为当前浏览器 M1 样板，不代表正式数据库、权限或完整业务后端接入。

## 2026-10-01 单机逐项编辑与紧凑资料区

用户要求缩小日期／IMEI区域、明确每个可维护字段的编辑入口、保存二次确认，并提高信息密度。本轮将单机详情分为设备摘要、标识与规格、实物情况、金额与入库、检测／销售；桌面双栏，手机单栏。品牌和型号独立编辑，颜色保留色块；编号／SN／包装码／IMEI直接呈现在小格内，时间线默认收起，入库日期为44px小行。售价只在摘要编辑，操作区移除重复标价表单；非待检测状态保留小型只读核验记录。

`RetailFieldEditor` 复用 `IdentifierField`／识码核对、`ColorPicker`、`SelectControl`、公共表单／按钮和现有 token。28个可维护字段依类别开放；系统 ID、版本、历史、销售、预留、所有权及照片不通过普通编辑更改。先验证资料，再核对前后值，最后确认保存；弹层保留打开时原档案与版本。确认前和取消均不写入；无变化、重复身份、旧版本或保存失败不追加历史。可售身份／规格／核验资料更正转待检测、清空核验，在确认页明确提示；预留与已售保留既有保护。检测、上架、暂停、重新检测也经过操作确认。

独立只读审查实际复现并修复：单机读取异常时用 fixture 替换已保存资料；保存成功后额外读取失败使界面显示旧默认事实。现在异常保留最后成功快照、显示错误并禁用写入；写成功直接发布新快照。真实 retail-provider 函数的内存隔离回归覆盖临时读取异常与恢复、写失败字节不变、写成功后立即读失败、新版本及追加历史保留、旧版本拒绝。

实际浏览器验收使用独立IAB标签17／18，未更改用户原页输入：

- demo-unit-2在1440、1024、390、375宽度均无整页横向溢出；资料格约53.8px、入库日期44px，手机所有编辑入口至少44×44px，编辑输入16px。375编辑弹层337px宽，无横溢；多块磁盘编辑手机输入16px。
- 存放位置实际更正后版本1→2、历史1→2，刷新保留；另一个已打开确认的标签出现冲突且禁用保存。随后通过相同二次确认恢复原位置，版本2→3、历史3条，原保存和恢复均保留；取消和未修改继续不追加历史。
- IMEI无效长度拦截、有效虚构15位值进入核对但取消，统一扫描入口打开／关闭返回编辑；重复已有单机编号被拦截；三位小数金额拒绝、两位精度核对；机身存储可明确清空为未知再取消，日期编辑正确带入原值。品牌、型号逐项输入／核对／取消、检测确认取消、多块磁盘添加／核对取消均实际点击。
- 可售demo-unit-3更正型号的确认页显示回待检测影响，取消仍可售；售出表单仍可打开／取消。已预留电脑和已售手机编辑被禁用，核验记录及售出历史保留；未执行新的销售。手机同型号新建保留型号候选、身份清空，手机网络版本字段可见；接机共用颜色展开／Esc回归通过，两层Esc先关颜色菜单再关资料编辑。
- 浏览器运行时error为空；开发期间只记录Fast Refresh正常重载警告，不描述为无warning。未再次开启硬件相机、执行原生打印或外部写入。

本轮最终运行lint、typecheck、build通过；86项规则与存储测试全部通过，其中单机33项。最后标题可访问名称补丁另通过定向ESLint和包含TypeScript的构建，既有业务测试源码未变化。React检查已覆盖状态快照、受控输入、原生模态焦点、条件渲染、模块作用域和客户端存储，不新增框架或全局主题。

证据：[桌面详情](../.local/ui-proof/retail-field-edit-20261001/detail-1440.png)、[1024详情](../.local/ui-proof/retail-field-edit-20261001/detail-1024.png)、[手机详情](../.local/ui-proof/retail-field-edit-20261001/detail-375.png)、[手机IMEI编辑](../.local/ui-proof/retail-field-edit-20261001/imei-edit-375.png)、[手机二次确认](../.local/ui-proof/retail-field-edit-20261001/confirmation-375.png)、[跨标签冲突](../.local/ui-proof/retail-field-edit-20261001/version-conflict.png)、[保存与恢复历史](../.local/ui-proof/retail-field-edit-20261001/saved-history.png)、[可售更正影响](../.local/ui-proof/retail-field-edit-20261001/available-reinspection-confirmation.png)、[尺寸与交互](../.local/ui-proof/retail-field-edit-20261001/verification.json)。测试视口恢复，临时冲突标签已关闭。仍为本地M1样板，照片上传、预留变更、真实数据库／权限／云端同步未接入。

## 2026-10-01 Figma整机列表／档案／录入统一

实际读取指定画布5084:877，查看表格12327:117916截图、两列高保真子节点12327:117926／12327:117950，以及详情实例12373:180275截图和高保真样式。借鉴白色面板、轻灰分区、细边框、主辅信息、语义状态色与紫色主操作，按门店高密度场景适配；没有复制模板时间跟踪、评论或头像业务。布局规划已写入docs/05的当前应用章节。

三页共用私有retail-surface.module.css，1200px内容上限、48px卡头和同一字体层级；公共PageTitle／AppShell／按钮／面板／表单与token沿用。列表状态卡解除维修样式耦合，电脑搜索筛选一行，颜色色块＋文字、68px完整六列；手机44px状态标签、展开筛选、108px卡片并保留成色位置。详情强调20px电脑／18px手机型号，资料识别码与实测规格分区，减少桌面网格边框，铅笔仍直接可见。新建三步按身份、识别码、实测、成色随件、金额来源组织；电脑识别码两列，第一步从本轮初稿766px压为608px。ColorPicker及包装码IdentifierField复用，无新库／主题。

实际IAB在列表、详情、新建各检查1440／1024／390／375，均无整页横溢；1024桌面表头未隐藏，850px表格仅在814px面板内滚动。手机输入16px、操作44px，IMEI格约54px、入库日期44px。实际点击筛选／排序／搜索空态／重置、整行打开及返回保留URL、包装码两候选、手机菜单、IMEI编辑前后核对并取消、预设色块／自定义／Esc、包装码扫描弹层、必填校验、三步前后导航、多磁盘类型单位／空容量／增删、同型号复制、可售登记售出打开取消、预留和已售编辑锁定、检测确认取消、历史展开收起。新建与更正均未提交，本轮未改变业务事实；旧DEMO售出和demo-unit-2版本3／历史3条保留。

最终lint、typecheck、build通过，86项既有规则／存储测试通过。React核对了受控输入、条件字段、原生模态、确认取消与CSS作用域；未改domain／provider／公共组件或global样式。当前标签warn／error日志为空。本轮未重新验收跨标签冲突、实际字段保存、硬件镜头或原生打印；前两项已有上轮证据，后两项仍须实际设备验收。仍为本地M1样板，照片／预留变更／正式后端等未扩大接入范围。

证据：[电脑列表](../.local/ui-proof/retail-unified-figma-20261001/list-1440.png)、[手机列表](../.local/ui-proof/retail-unified-figma-20261001/list-375.png)、[电脑档案](../.local/ui-proof/retail-unified-figma-20261001/detail-1440.png)、[手机档案](../.local/ui-proof/retail-unified-figma-20261001/detail-375.png)、[电脑新建](../.local/ui-proof/retail-unified-figma-20261001/new-1440.png)、[手机二次确认](../.local/ui-proof/retail-unified-figma-20261001/edit-confirmation-375.png)、[尺寸与交互](../.local/ui-proof/retail-unified-figma-20261001/verification.json)。临时视口恢复，统一列表保留供查看，未改用户原页输入。


## 2026-10-01 新机／翻新机分类与销售商家保修

最新用户要求覆盖整机列表、新建、单机详情与打印。商品分类统一为新机／翻新机；旧存储全新→新机、二手／整备→翻新机，只兼容读取，不重写旧历史。列表增加44px分类分段，保留状态、搜索、类型与返回URL的组合。详情和新建均使用同一保修选择器：默认12个月，可选6／12／24或自定义1–120整数月；null表示不提供额外商家保修，法定权利不受影响。详情逐项编辑保修沿用前后值核对及二次确认，预留／已售仍锁定。

登记售出前单独核对商品、客户、价格及条款；保存销售时冻结期限、门店名称／地址／电话和条款版本retail-2026-10-v1。售出不记录收款或自动交付。实际交付是独立二次确认，日期限定销售登记日至当前日，保存打开版本、追加历史；保修从实际交付日起算。相同销售／交付请求可幂等重放，旧版本与改动内容拒绝。旧销售没有保修和交付日期时继续未知；重印不能把当前门店当作原担保方或倒填本轮排除条款。

打印复用原生dialog与接机单的A4／A5横向、上半页、双联版式。意大利文列出担保方、商品／成交价／交付／期限及届满日、售后办理和客户签名；不输出内部成本，不作为税票。额外商家保修覆盖正常使用硬件故障，排除由跌落、碰撞、挤压、进水、液体、腐蚀或不当使用等原因造成的故障，须核实因果关系；不自动剥夺其他符合性缺陷的保障。消费者法定免费救济保留，新机法定两年不被默认一年商家保修缩短，翻新商品也未自动缩短法定期限。规则核验来源：[MIMIT商家保修](https://www.mimit.gov.it/it/mercato-e-consumatori/tutela-del-consumatore/diritti-del-consumatore/garanzia-commerciale)、[MIMIT法定保修](https://www.mimit.gov.it/it/mercato-e-consumatori/tutela-del-consumatore/diritti-del-consumatore/garanzia-legale)。

独立只读专项审查提出旧销售原担保方被当前门店倒填的问题，已修复并实查旧销售预览。浏览器原生日期显示输入值但React未收到变更，已在交付、新建及逐项编辑日期补onInput；编辑核对取消、新建前后导航和真实本地交付保存／刷新均验收。坏存储错误快照曾每次重读导致getSnapshot引用变化，已修复缓存稳定性，新增真实provider隔离回归；临时读失败仍可恢复。

本轮实际验收：

- 列表、默认保修详情、已售详情、新建保修控件、销售打印预览各1440／1024／390／375，无整页横溢；手机输入16px、分类与打印操作至少44px。桌面双栏保留，手机打印单栏。A5预览纸张约733×488 CSS px（129mm高），上半页一份、双联两份实际切换检查。
- 自定义空值及121个月被拒绝；18→24→18月二次保存、刷新与历史保留；默认一年／无额外商家保修确认页正确。原demo-unit-2编辑日期和保修仅核对后取消，版本3／历史3保留；已预留与已售字段锁定。
- 新建明确虚构CT-DEMO-AB6DC8EA，完成三项核验、可售、条款核对销售及单独交付，版本7／历史7。18个月销售快照冻结，2026-10-01交付、届满2028-04-01，刷新保留；收款仍null。原demo-unit-1销售／版本2未更改，不删除既有DEMO历史。
- 新机／翻新机与状态组合、空态、清除及返回URL实际点击。旧销售打印原担保方／期限未知，不倒填当前条款。最终页面刷新后warn／error为空；开发中的临时错误已记录和修复，不描述为整个开发期间无错误。

最终lint、typecheck、build通过，92项规则／存储测试通过（单机38项）；业务专项审查及React受控输入、模态、快照与模块CSS核对完成。仍为当前浏览器M1样板；未执行原生／物理打印、真实付款、税票、退款、外部写入或云端同步。

证据：[分类列表](../.local/ui-proof/retail-warranty-20261001/list-1440.png)、[默认保修详情](../.local/ui-proof/retail-warranty-20261001/warranty-detail-1024.png)、[手机销售核对](../.local/ui-proof/retail-warranty-20261001/sale-review-375.png)、[A5销售保修单](../.local/ui-proof/retail-warranty-20261001/sale-receipt-a5-1440.png)、[双联预览](../.local/ui-proof/retail-warranty-20261001/sale-receipt-double-1440.png)、[旧销售未知信息](../.local/ui-proof/retail-warranty-20261001/legacy-sale-unknown-375.png)、[尺寸与交互记录](../.local/ui-proof/retail-warranty-20261001/verification.json)。临时视口已恢复，商品列表保留供查看。

## 2026-10-01 参考图单机档案、售卖与员工权限闭环

用户要求先完整规划并反复核对，再实现售卖、买家、售后及员工／利润权限。已先完成docs/11及两次规划核对，用户明确选择本地样板／权限演示后实施；后续独立专项复核领域、读取投影、保存鉴权与售后来源。不是正式账号、数据库权限或真实交易交付。

- 单机档案以参考图的照片摘要、颜色＋文字、售价和图形电量／存储／核验指标重排，双栏资料与成本／操作；照片复用PhotoCapture，压缩本地保存、6张上限、确认后写入，未知用品类图标。逐项铅笔及原版本二次核对延续；手机当前操作前置、历史销售与操作历史收起，已售不重复显示检测面板和标价预计毛利。
- 新销售冻结商品、买家称呼／归一化电话／可选邮箱地址备注、原成本及保修；核对页有SN／IMEI、金额、门店和条款。明确尚未收款才初始0；旧记录null仍未知。预留／解除、分次收款、历史实收核对／冲销、交付与欠款放行、退回／退款／冲销分权，整数分、有效日期、稳定ID和版本拒绝。收退款不自动双写手工经营收支。
- 交付结清后正常开放；欠款例外需独立能力及责任／跟进日，不改变欠款事实。保修从明确交付日算；打印使用该销售冻结商品和约定，显示款项、退款／退回、交付及原保修，无成本／利润。退回损益待核对，不把仍持有的退回实物成本算成已实现亏损。
- 售后绑定原销售／单机／申请三元组，从原商品快照新建客户维修，保留设备保管；半写失败重试复用同单，不冒充事务。关闭需真实绑定工单、完整维修结束事件及有效交还日。未送机未关联申请带原因撤销，不能对已收机／已关联假装交还；未关闭申请阻止退回及复售。实物退回先隔离，退款结清并重新检测后才能上架复售，原销售／售后及客户记录保留。
- 门店设置新增员工分类：本地DEMO标识、五个角色模板、19项能力、账号／门店成员双状态、二次确认和追加审计。默认老板全能力；店长、销售、技术、只读能力各自明确，财务查看／编辑、收款、冲销、退款、欠款和员工管理分开。不能自提权、授予无权分配能力、改老板／停最后老板。坏资料、SSR未载入和无效成员读默认拒绝，实际保存重新鉴权；身份和成员版本变化卸载输入。账号菜单增加明确预览身份选择，非真实登录。
- 成本、销售成本快照与敏感财务历史从普通身份读取投影中去除；新建／编辑／打印／客户／经营收支与维修采购入口收口。无维修写权限保留事实和历史，隐藏／禁用新建、阶段、保管、通知和配件写操作，直达new显示AccessPanel；售后销售角色只经专用来源桥接建单。

实际132项规则、存储和权限测试通过（含整机63项、员工14项、售后保管初始化及边界）；最终lint、typecheck、build通过。独立专项修复坏员工回默认老板、财务历史泄露、售后绑定／关闭证明、取消后继续修改及待处理售后复售等反例，回归测试覆盖。浏览器发现员工核对页审计时间格式不同和手机38px按钮，已修复并实际重试；原生增强select内部展示按钮不当作独立触控目标。React核对覆盖hooks、状态快照、受控字段、模态／焦点清理、跨身份卸载及模块CSS，无新UI库／主题。

IAB独立DEMO CT-DEMO-DFE4EBDF实际完成：建档／照片刷新→三项检测／可售→预留→买家售出→100+100分次收款→交付／一年保修→售后关联LOCAL维修（提前关闭拒绝）→维修结束／交还→另一个未送机申请撤销→实物退回／200退款→复检上架→独立新销售210收款／交付，最终版本23、两笔销售。原买家维修1／销售1显示退回、退款和售后，复售买家独立；未更改或重复出售旧DEMO记录，demo-unit-2仅核对取消仍v3。照片为专用虚构棋盘测试图，不是实物商品照片。

员工UI实测新增、保存／刷新、自定义财务查看与撤权停用；默认销售／只读无成本利润、销售不能普通新建维修或改采购，技术员相应入口可用，店长默认无员工／财务页。手机身份切换关闭抽屉，权限实时切换；退出后内部路由回登录，演示登录及密码显隐恢复，业务记录保留。IMEI非法输入和已有可售单机销售核对取消未写入。

四宽度1440／1024／390／375覆盖列表、详情、新建、售出核对、售后弹层、员工编辑与打印，均无整页横溢；手机输入16px、主要按钮44px。当前销售手机优先，历史默认折叠；最终刷新窗口warn／error为空，不代表整个开发过程无临时问题。测试视口已恢复，老板身份与原单机档案保留供查看。

证据：[规划](11-retail-sales-staff-plan.md)、[桌面摘要](../.local/ui-proof/retail-sales-staff-20261001/overview.jpg)、[手机档案](../.local/ui-proof/retail-sales-staff-20261001/detail-390.jpg)、[手机已售](../.local/ui-proof/retail-sales-staff-20261001/sale-375.jpg)、[员工设置](../.local/ui-proof/retail-sales-staff-20261001/staff-1440.jpg)、[打印](../.local/ui-proof/retail-sales-staff-20261001/receipt-1440.jpg)、[流程与尺寸](../.local/ui-proof/retail-sales-staff-20261001/verification.json)。未执行真实认证／邀请／权限隔离、支付退款、外部消息、生产、硬件镜头、原生／物理打印或税务接口；收费售后仍需维修报价客户授权，不自动批准。当前资料／照片无云备份，清浏览器数据会丢失，正式服务端接入另行授权。

## 2026-10-02 整机全量输入与就地编辑

用户先要求遍历所有整机输入／编辑选项，再补充尽量不用弹窗。已先生成[完整清单和执行计划](13-retail-input-audit-plan.md)，覆盖列表、建档／复制、资料、检测、预留、买家、款项／交付／退回／售后及照片／识码／打印。复用既有选择、搜索、色板和标识工具，新增整机私有电池／整数、金额、日期、逐盘控件；普通字段、检测、售出与13类交易操作迁移到原卡片，两步核对、版本、权限和取消不写继续保留。

电池图形滑轨与精确0–100整数，数量加减、容量预设自定义及单位、逐盘独立key、RAM和保修范围、€前缀／欧分反馈、日期清空、备注多行已统一。创建数值／日期校验与更正对齐；金额接受单独逗号或点小数，精确整数分，拒绝混合和非法原文。付款方式、售后保管初始未选，保障从原申请读取；核对显示原买家／款项／售后和有效合计前后变化。照片放大留在页面，移除核对显示具体缩略图。

独立专项84项测试通过，发现容量未知时TB丢失已修复并实际重试；删除首盘后第二盘1.5TB草稿保留。实际UI又修复增强select内部button被宽泛触控样式撑为66px，以及步骤切换／检测取消焦点。根执行149项测试、lint、typecheck、build通过，React核对受控草稿、stable key、hooks／ref、焦点与CSS作用域。

IAB新虚构CT-20261002-0001从建档、电池85%保存刷新、三项检测及明确可售，到买家售出、220.50实际款项演示、独立交付和未留下售后撤销，最终v9／销售完成；18月冻结保修交付2026-10-02、届满2028-04-02。收款缺方式和221超额拒绝、100.25核对取消不记账；退款核对取消刷新仍0。保修18→19核对返回保留草稿，取消还原18。原电脑CT-20261001-0002只打开和取消仍v4／6磁盘；旧照片DEMO仍v23。只读DOM无成本／毛利且编辑禁用，身份变化会卸载未保存成本编辑，恢复老板；最终刷新后warn／error为空（此前开发临时报错已消除，不代表整个开发期无错误）。

四宽度1440／1024／390／375覆盖列表、电脑录入、电池编辑、售出核对和照片大图，无整页横溢；手机可见文本输入16px、主要操作外层44px。颜色嵌套Esc、无变化拒绝、IMEI查询123拒绝和numeric键盘已实测。逐项审查不等于每字段重复相同测试；旧售后维修交还／完整退回复售／跨标签冲突证据复用，本轮未重新执行硬件拍照扫码、照片上传移除或原生打印，仍是M1本地权限样板。证据及准确范围：[验收记录](13-retail-input-audit-plan.md)、[电脑编辑](../.local/ui-proof/retail-inputs-20261002/battery-final-1440.png)、[手机编辑](../.local/ui-proof/retail-inputs-20261002/battery-final-375.png)、[流程与尺寸](../.local/ui-proof/retail-inputs-20261002/verification.json)。

## 2026-10-02 SeaTable 同步机制研究

用户要求研究 SeaTable 的同步实现并形成报告，评估本项目不同端和不同账号实时同步。完成[研究与接入方案](15-seatable-realtime-sync-report.md)，核对官方服务端架构、Socket.IO／WebSocket 与 SDK 事件、共享权限、公共数据集同步、离线和专有许可；结合当前 localStorage store／provider、预览认证、版本和财务投影分析接入边界。

工程建议为当前项目独立真实身份／门店授权、Postgres 事务／幂等、持久变更事件、私有最小通知与重连查询，优先评估 Supabase Auth／私有 Broadcast／Storage，按工单→采购→整机试点。报告明确账号协作不越过权限、财务字段不随整行广播、并发售出仅一个成功、授权撤销不能只靠缓存频道策略。技术选型和正式实施均未确认，最新需求及M1范围不变。

本轮验证为官方资料和定向源码检查、报告结构与本地引用检查；未改业务代码、安装依赖、创建外部项目、接入真实认证／数据库、迁移或部署，未运行跨设备同步／并发后端测试。部分源码与Supabase changelog索引未能获取，完整内部算法与实际延迟不作已验证声明。


## 2026-10-02 接机小选项、三语打印与签名

先保存[计划14](14-repair-intake-print-signature-plan.md)并核对来源／政策／权限／存储，再实施。分类箭头改为就近非模态面板，组装技术在同一面板内切换；选择保留草稿，接机最终确认才写。纸张旁加三语打印，默认意大利语，结构化值统一译文，自由文字保留原文。维修／整机默认6／12月在门店资料，可自定义1–120月；新记录冻结政策，旧整机销售不追溯改约定。

签名是接机资料核对：末步可选、详情补签，归一化笔迹与采集比例、快照、版本、语言、时间、操作者同源保存；新工单及签名一次本地envelope写入，补签不改售后来源事实。重新签署追加，20次上限；业务revision与签署打开时的历史数量分别检查，权限及账号写前复核。旧事实签名不覆盖变化内容，也不证明收款、检测、报价接受或权利放弃。独立专项发现原表单历史count缺口并修复；24项专项及168项全量测试、lint、typecheck、build最终通过。React核对涵盖hooks、受控草稿、错误保留、SSR/存储门控、事件清理、键盘及焦点、module CSS与SelectControl复用。

IAB独立DEMO完成新建签字→保存→刷新→两次详情补签→历史3→三语打印；另一个DEMO跳过签字保存。自定义9／18月实测并恢复6／12，原接机6月及原DEMO销售18月不变。四宽1440／1024／390／375小面板、签字区无整体横溢，触控44px、手机输入16px；手机采集比例切桌面、刷新及打印一致。纸张四格式／双联对象核对通过，未操作实体打印。证据：[交互记录](../.local/ui-proof/repair-intake-20261002/verification.json)、[最终打印](../.local/ui-proof/repair-intake-20261002/print-final-it-a4-1440.png)。

最终lint曾扫描到.local新出现的另一套源码备份；将本地生成物／归档排除源码扫描后重新通过，并非放宽应用规则。未改原用户LOCAL工单或既有整机数据。本轮仅合成键盘笔迹，原生自动化拖动无笔迹，手指／触笔／鼠标、真实纸张分页及跨设备正式签名仍未验收；M1不具备云备份或服务端事务。

## 2026-10-02 跨设备与多账号实时同步实施规划

按用户“按照你的想法继续规划”保存[规划17](17-realtime-sync-execution-plan.md)，将研究15转为首期一家门店、多员工账号的分阶段实施要求。推荐独立 Auth／Postgres／私有 Broadcast／Storage，以 Next.js 服务端短事务复用领域规则；日常数据库角色不拥有表或绕过 RLS，业务数据不向浏览器开放通用写入口。规划覆盖门店与财务隔离、稳定操作 ID、并发版本、持久 outbox、频道授权版本轮换、重连查询和降级轮询。

定向源码与独立只读事务核对确认：售后建维修与销售关联目前分两次本地保存，到货通知依赖调用时采购快照；规划要求同一事务核对依赖并保存。签名随接机及冻结快照原子提交，照片采用暂存／校验／绑定与清理。正式采购成本写入拟收紧至 financial.edit，明确为未来权限方案，不改当前演示角色。

验收按身份底座、工单、采购、整机销售、文件与运行保障逐阶段完成，包含两账号／两设备、并发售出、响应丢失、撤权、售后回滚和签署冲突；延迟指标是待实测目标。已核验相关官方资料，6份文档187个本地引用及Markdown围栏检查通过；本轮未安装依赖、改应用、接真实后端或执行跨设备／后端并发测试。Supabase changelog 索引仍未获取，正式实施前须补版本及平台核验。


## 2026-10-02 正式后台、资源复用与线上替换

用户选择先接正式后台再切换，业务空库，复用现有Supabase而不另购10美元项目，首位老板绑定指定现有已验证账号。已建立12张隔离业务表、专用受限角色、一个空门店与老板，旧public表和Auth触发器保留；正式Auth/门店权限/财务投影/事务/版本/幂等与照片持久化已实现。Vercel仅配置候选分支Preview，main/正式域名仍旧。

174单元测试、36本地真实API检查、8本地捕获邮件PKCE检查、空库迁移、严格类型及正式构建通过。ESLint无错误，有一条认证失效整页跳转建议警告。IAB真实本地登录、接机含JPEG保存刷新、客户设备联动、工作台统计、退出，以及详情/工作台四宽检查通过；合成测试仅在隔离本地门店。独立审查覆盖共享Auth兼容、RLS/权限/事务及私有照片不可变ID和历史上限。

本轮采用15秒/聚焦轮询，未完成规划17私有Broadcast/outbox或实测跨物理设备，支付税务/消息仍未接。接机照片私有bytea，限240KB/1000px、当前6张、历史30张，与工单同事务。完整事实和切换剩余条件见[正式后台与切换](18-formal-backend-and-cutover.md)，旧备份限制不变。

## 2026-10-02 直接替换main与正式域名完成

用户最新要求直接替换旧版main并将旧站抓取到本地。PR25已合并，main315b84eaadb57ca1dfaac07e1a93f640477e7e20保留两份历史，188文件树与候选完全一致，main CI通过。Vercel正式dpl_BWuqdTHJcrksT1jBWMLmQknT2v4D READY并分配chinatech.in/www；保留原308到www跳转，实际验收发现认证来源错配后统一APP_ORIGIN并重建完成。原Vercel项目framework同步Next.js、原Supabase复用独立v2，未新建付费项目，业务仍为空。

旧完整不可变备份保留，新增cutover-20261002-1153补充最新差异：云原Postgres JSON字节→本地事务恢复7表，163张非会话旧表内容摘要一致、3序列同步、5附件原云元数据未变且238348bytes文件重新SHA核对。新SQL/原schema+roles/Storage元数据及文件manifest16文件复制SHA通过；旧本地3107/login200。旧ChinatechOS未提交工作未覆盖，旧云表未删除。

正式HTTP11项与IAB公开流程通过：同源空认证400/匿名command401/异源403/演示404、内部跳login；手机375输入16px/按钮44px无整页横溢，已恢复视口。没有云老板手工密码登录、发送注册邮件或正式业务写入，不冒充完整线上老板验收；本地174单元/36真实API/8捕获邮件及独立专项证据复用。细节与剩余能力限制见[正式后台与切换](18-formal-backend-and-cutover.md)。

## 2026-10-02 线上选项点击修复验收

- 范围：公共 SearchCombobox/SingleChoice/ColorPicker，以及维修屏幕技术和整机类别联动。候选继续显式选择；原生下拉与多选无需另造控件。修正 iOS 取消 pointerdown 后输入失焦丢点击、已聚焦输入不展开、已聚焦候选确认后菜单重开、输入法确认误触，以及已选颜色/技术无反馈和商品类型切换后的自定义颜色残留。独立只读审查补出焦点恢复顺序反例，已覆盖。
- 本地：20 浏览器交互、174 业务测试、TS、正式构建通过；lint 无错误，既有导航建议 1 条。维修与整机 1440/1024/390/375 实际浏览器布局/操作检查，候选≥44px、手机输入16px，保存/刷新/采购反向关联使用本地虚构数据。WebKit 失焦顺序由测试显式模拟；实体 iPhone 和搜狗键盘尚未实测。
- 持续验证：npm run test:controls，Chromium/WebKit；CI 安装对应浏览器并必跑，失败保留 trace/截图，不替换业务测试与正式 Supabase build。
- 交付：GitHub main e6c097a27575d8a3b3fbad1deecf2d44090986c9，CI https://github.com/kyox215/Chinatech-codex/actions/runs/37012148575 成功；Vercel dpl_4AdK3iuqvtMAffDEhra8hFvpiZ1M production READY，chinatech.in/www 已切新版本。190 公共文件字节核对一致，匿名 HTTP 6 项通过。云后台和数据未写入；本轮没有实体手机或云老板账号点击验收。证据 .local/ui-proof/controls/ 与 .local/ui-proof-choices-*.private.log。

## 2026-10-02 整机宽屏与 SeaTable 分组请求

整机额外1200px限宽已移除，列表/详情/新建及复制与维修页对齐共享宽度；24本地虚构布局检查和正式构建通过。当前main9158939f83a9c888befff3fdfcdfbe142c409446，Vercel dpl_9DwtXGNsjbMN8tW5aiKvV1acWiu4 production READY，两域名已指向新版本，190文件逐字节一致；线上匿名页面与保护状态正常。证据.local/ui-proof/retail-width-20261002/。

维修分组排序待用户Chrome连接恢复：用户明确要求使用其Chrome读取给定SeaTable；控制连接持续超时，尚未读取实际分组或排序，不作假设或自行替换已有规则。IAB只能到登录页且用户已指定Chrome，不继续用IAB替代。尚未改维修分组、迁移数据或写SeaTable。

上述宽屏补丁 GitHub CI https://github.com/kyox215/Chinatech-codex/actions/runs/37025116887 已全部成功，包含既有20浏览器交互与174业务测试及正式构建。SeaTable部分仍待Chrome连接，未标完成。

## SeaTable 维修分组对齐（2026-10-02）

已通过用户 Chrome 的 RIPARAZIONE／进行中视图读取实际规则：STATO 升序，分组依次为「久等 未答复、欠款 已拿走、寄修、IN CORSO、下单、到货、到货已通知、修好、修好已通知、FATTO」；默认排除作废。组内先按 DATA RITIRO（mtime，最后更新）升序，再按 DATA AGGIUNTA（ctime，建单）升序，同值以编号稳定排序。新系统保留配件分组、不分组及显式查看作废入口。

分组由 lib/repair-workflow.ts 统一计算，列表和正式工作台共用；维修中／待测试／待确认归 IN CORSO，待取机归修好、维修结束归 FATTO。待检测或待配件的工单按真实必需配件下单／到齐事实进入下单／到货，加车及尚未下单仍归 IN CORSO；到货已通知须客户保管、必需配件已到齐且沟通签名有效。需求改变、未接通或设备保管改变不沿用已通知分组。

新增久等未答复、寄修、欠款已拿走、修好已通知四个可保存阶段，沿用既有 workflow 命令、权限、版本、事务和事件历史；旧状态值及历史兼容，无数据迁移。欠款取走须先核对客户保管并写备注，终态恢复须原因；修好已通知须从待取机核对后记录。阶段不自动登记款项或交付、不发送任何外部通知。详情、客户共享目录、三语打印和工作台待取机统计同步适配。状态保存后展开目标组并恢复焦点。

验证：177 业务测试通过；既有20浏览器回归通过，新增6个 Chromium/WebKit 用例通过（分组顺序、作废筛选、双字段排序、实际保存、移动分组焦点、刷新和详情同步、通知前置校验）；1440／1024／390／375 无页面横向溢出。首次桌面测试误使用只在手机显示的重置按钮，修正测试入口后6项全通过，未放宽断言。正式 Supabase-mode build 与严格 TS 通过，lint 无错误、保留既有导航建议警告。证据 .local/ui-proof/seatable-groups/ 与 .local/seatable-*.log；不包含 SeaTable 客户记录，未导入或修改其业务数据。

发布验收：main `ba540bf28710d9e4adcb3ab2a8cf246d45be2c11`，只改本轮9文件；191个公开文件与本地一致。Vercel `dpl_4yEzoWJwH7b56zYTudcTJTjcZmbr` 为 READY／production，chinatech.in 与 www.chinatech.in 均指向此提交，aliasError 为 null。GitHub CI [37045060833](https://github.com/kyox215/Chinatech-codex/actions/runs/37045060833) 全部成功。用户 Chrome 已登录的线上维修页面实际读取默认选择，并验证配件分组与维修状态分组往返切换；未创建或更改真实工单。


## 空分组显示（2026-10-02）

用户确认空分组也显示。维修状态与配件分组不再隐藏零单分组，数量显示0、可展开并提示“暂无符合条件的工单”；原SeaTable顺序保留，默认仍排除作废，显式包含作废时显示该组。复用既有分组按钮、计数与section-empty样式，不改变工单/数据库。Chromium/WebKit共6项定向回归及1440/1024/390/375布局通过，严格TS、正式构建通过；lint无错误、保留既有导航警告。代码与测试共2文件发布main8254b4f73abef95e1e3c78c7500a25456ccac031，191公开文件字节一致。证据.local/empty-groups-*.log、.local/empty-groups-published-verification.json。

本轮线上核验：Vercel dpl_7yjgesfhMcoVYcH7TEo68ftQHmBL READY/production，chinatech.in/www均为main8254b4f；用户Chrome实测10个分组顺序及零单计数、空组展开提示正常，未写业务数据。CI37053543332全部成功（177业务测试、26浏览器回归、lint/TS/build）。


## 2026-10-02 字体与显示可读性优化

用户要求参考主流网站，改善部分显示器文字刺眼／模糊。官方参考、声明统计与使用规范已写入 [组件规范06的字体段](06-ui-components-and-styles.md#字体与可读性2026-10-02)。采用系统 UI 字体及中文回退，移除 Source Sans 3 依赖和强制字体平滑；22处650、2处750收敛到600，2处800改为700；99处后台小字号提高至12px。正文14px、公开页基础16px、手机输入至少16px，按钮行高1.35；主文改深灰、过淡辅助文字加深，白底主／次辅助文字约14.65/6.39/5.25:1。复用已有CSS语义与控件，新增 `--font-sans`；1024px登录／注册原520+620固定列下限同时修为弹性列。

验证采用线上 `8254b4f` + 本轮7文件的项目内独立副本，避免首页美化和同步机制任务正在写入的中间状态。Node24：lint无错误（保留已有导航warning）、严格TS、177业务测试、26 Chromium/WebKit控件与分组回归、正式Supabase-mode构建通过。12路由×4宽度(1440/1024/390/375)加Chromium DPR2和WebKit手机模拟，共72布局检查，无整页横溢、手机输入至少16px、网站正文字体请求0（明确排除开发工具自身 `/__nextjs_font/`）。实际登录错误／密码显隐／预览登录与既有工单选择、保存、刷新回归通过；三语接机单A4预览无横溢，保留8.5pt和1.25行距，未执行实体打印。已查看桌面/手机维修列表、详情、接机、整机及意大利语接机单截图。

证据 `.local/ui-proof/typography-20261002/`（`verification.json`、`print-check.json`、`*-isolated.log`、`before/`、`after/`）。首轮根目录验收遇其他任务尚未完成的首页CSS与recovery-store文件，独立副本通过不代表这些并行功能已经验收；保留其他执行者改动。移出生成目录中的重复 `* 2.ts` 到证据目录，未更改源码类型规则。实际Windows/ClearType及用户物理显示器未测试，浏览器DPR模拟不能证明所有屏幕主观模糊已消除。

发布：main `666af411cdbe86225b858c2f27890bcb84dd42ed`，7文件；Vercel `dpl_8jkAJzhrnZqYB8hS5D6Pth8FqFa2` READY/production，chinatech.in/www均分配。线上四宽度3公共路由共12项、匿名state401、密码显隐及注册导航通过，字体文件请求0、页面错误0。CI37055699353全部成功（lint、TS、177业务、26浏览器及正式build）。7公开文件与已验收副本逐字节一致，无其他文件改动；线上Chromium实际字形为系统.SF NS与PingFang SC，非自定义下载字体。


## 维修分组管理（2026-10-02）

维修列表“管理分组”支持维修状态／配件两套分组名称与顺序按门店保存；拖动手柄兼容指针触控，另有方向键及上下移动按钮，显式保存／取消。零单分组继续显示，默认排除作废；管理可编辑作废分组名称和位置，未改变作废筛选。固定业务key不可增删或改写，仅显示名1–40字符且同类不可重复。维修状态分组与实际阶段字段分开，改组名不改变工单、签名、打印的阶段事实；工作台分布和配件筛选读取同一分组配置。

复用既有settings.edit（界面名称“门店、分组、供应商与打印设置”），老板及被授予该权限的成员可管理；普通维修编辑权限不包含该能力。不新增权限默认、不改变成员授权。可选StoreSettings.repairGroups沿用私有store_state JSON，旧数据按既定SeaTable顺序默认，旧客户端省略字段时保留已存配置，无数据库迁移。正式settings.save按当前成员、门店、设置版本、幂等和事务边界保存，前端撤权或身份版本变化关闭草稿；失败保留编辑、并发冲突不覆盖。

新增RepairGroupEditor为维修模块专用（业务标识与组别约束），复用repair-parts-dialog、field、icon-button与语义token，不新建通用输入/选择组件或UI框架。独立审查未发现权限绕过或并发丢更新；已修复StrictMode关闭事件竞态与向下拖动插入线方向。

验证：178单元测试、8项真实本地API检查（隔离55421/55422合成账号；3131候选服务）、32项全浏览器回归；新main字体样式合入后12项定向复验、1440/1024/390/375无横溢，真实Chromium触摸事件拖动及WebKit指针拖动、键盘排序、改名持久化、跨标签更新、无权限/撤权和并发冲突通过。正式build、严格TS通过，lint0错误保留既有导航建议。云上不写测试分组或工单。当前工作目录存在其他未发布改动，精确发布候选在.local/group-edit-candidate，命令层仅合入本轮字段兼容与鉴权补丁。证据.local/group-edit-*.log及group-edit-api-verification.json。

## 2026-10-02 公开首页与账号流程美化

首页电脑双栏/手机紧凑首屏、工作台图形、功能卡片、流程切换、双端展示、FAQ和轻量动画已实现。账号页共用AuthFrame，邮箱登录/注册确认/重发/找回与有效密码重置完整接入；Google PKCE入口及安全回调已写入，但云provider实时为false，需要ChinaTech专用Google Cloud应用配置后才能使用。未复用当前Google Cloud中的PartsPro客户端，未发送外部邮件。具体契约与限制见docs/01本轮节。

验收：48浏览器布局＋2交互组、本地真实登录/退出/重置7项、本地API/捕获邮件10组、最终183单元检查、正式构建；lint无error，发布副本仅保留原有1项导航建议warning。工作区另有并行业务修改导致根测试loader未解析新recovery-store，本轮用当前main666af411独立发布副本，只叠加31个明确归属文件完成测试，未回退或夹带其他任务代码。发布状态与最终证据见PROJECT_MEMORY和`.local/ui-proof/public-redesign/`。

补充：8个编辑器用例全通过（含两套分组独立持久化）；手机新增测试曾在加载前跳过筛选入口，已改为等待真实按钮点击并复验。13文件已发布main ee3099b96a2b6ef6bb0990358f77916f4b311bef，基于已上线字体提交666af411，部署/CI待核验。

上线完成：main ee3099b96a2b6ef6bb0990358f77916f4b311bef，Vercel dpl_Bnq4ZcbUZbkSdna4aA6frPYt3UFz READY/production/两域名，GitHub CI37057179599全成功（178单元、34浏览器、lint/TS/build）。用户Chrome已实测店主可打开管理分组，收尾连接中断后恢复确认弹窗关闭、原顺序保留；没有保存测试云配置。196发布文件与隔离候选一致（仅测试端口及生成类型路径归一化），旧后端integration测试恢复发布版，本轮实际API验证用repair-groups.integration.mjs。独立临时3131/3132服务已结束，未停止其他本地服务。截图.local/ui-proof/group-editor/使用虚构数据。

本轮已发布main6c9ef15，保留最新ee3099b维修分组功能；全部公开文件与发布副本字节一致。Vercel dpl_D2fNAsjhQGcHmPotiWK72KsR7RE1 READY/production/两域名，CI37062208049全部成功；正式匿名13项检查通过。此前Google新项目创建被自动审批拒绝，未创建项目。

Google后续选择：用户明确复用ChinaTech OS原入口、确认同一个Google账号，已取消新建方案。旧站Auth源码/相关Git记录无Google入口；同一Supabase的Google配置关闭且客户端ID/密钥为空。当前Google账号9个项目仅2个已有客户端：PartsPro-Italia对应partspro.app及其独立Supabase；Nextend社交登录对应noetech.it；另7个项目未配置Google Auth。未读取完整密钥或改变其他应用，当前缺少可确认属于ChinaTech的旧客户端。需用户确认客户端名称后继续，真实Google登录仍未完成；此轮仅配置调查与文档更新，无代码、部署或性能变更。


## 2026-10-02 SeaTable 电子产品完整导入

用户确认定金/标价/成交价/成本和入库/拿走日期映射，全部先归翻新机，矛盾保留原值标待核对。正式导入1,393行×19列：在售81、已售1,264、其他48；509行待核对，1,207行可通过有效号码关联客户。整机入口新增历史整机，支持搜索/筛选/50条分页/只读全字段详情/客户历史反向关联。原始值独立存储，不臆造检测、收款或物理身份；细则docs/21。

35批暂存、最终事务逐行核对source_hash及typed/raw内容SHA256后统一发布；云1393 published、1393翻新机、源行2–1394，导入审计与回执各1，普通物理单机0。独立安全审查修复准备时间幂等、全量摘要与异常格式漏标；本地10项RLS检查、9项领域/真实事务反例通过。

已基于最新main6c9ef15保留其他任务功能，18文件发布f578499b49ef8276dc5449dbf2ab19464d188cce，字节核对一致；Vercel dpl_Hq2iRmLkmKtqdX3ftATDKYwqqqPN READY/production/两域名，CI37063207897全部通过。最终191业务测试、严格TS、lint0错误（既有1warning）、正式build通过。合成Chrome列表/详情/客户四宽度及交互通过；用户真实Chrome核验1393总数、81在售、1264已售、509待核对、iPhone13搜索29与来源一致、完整字段和客户历史链接。私有数据与证据只在.local/seatable-retail-import/。


## 2026-10-02 多设备协作与断网恢复闭环

用户要求先推演故障并完善规则、再实施和验证。已形成[42场景规则／报告19](19-sync-failure-scenarios.md)，衔接原[SeaTable研究15](15-seatable-realtime-sync-report.md)与[规划17](17-realtime-sync-execution-plan.md)。本轮落地成员绑定、统一版本冲突、完整事务有限重试及门店版本行锁、最小回执、安全取消墓碑、20秒请求限时、持久原命令恢复、账号／权限隔离的设备草稿、照片字节及签名恢复、可见5秒／聚焦／联网补查。未实施 Broadcast／outbox 或离线冷启动；未提交草稿仅在本机。规则16、组件规范06已联动。

本地证据：npm test204通过／1历史导入集成用例未显式开启而跳过；真实后端44项，含10次取消／迟到竞争和售后故障回滚；真实IndexedDB双浏览器26项；公共交互34项；4宽度、严格TS、ESLint零错误（1既有建议warning）、隔离副本Supabase-mode webpack生产构建通过。独立审查发现的草稿清理／乱序／身份异步窗口已修复，最终关键路径无确证P1/P2。最终照片兼容修复通过Chromium和WebKit，实体手机／异地网络未实测。完整证据索引在文档19。

本轮仅在当前项目实施及隔离本地后台验证，没有提交／部署此次同步代码，也没有写生产业务或发外部消息；同目录其他任务的发布记录不作为本轮上线证明。本地草稿无法保证浏览器清理、强制终止前未落盘或设备损坏后恢复，界面区分本机草稿、门店保存及结果待核对。


## 分组拖动实时动效（2026-10-02）

维修分组管理沿用现有模块、手柄和语义样式，拖动时整行跟随鼠标／触摸坐标，其他行平滑让位，目标位置显示占位框；松手归位后仍需保存才对全店生效。列表边缘持续自动滚动；Escape、取消指针、失焦／尺寸变化可恢复草稿原顺序。方向键和上下按钮继续可用；减少动态效果偏好保留即时位置反馈，取消平滑动画。只改变客户端呈现，settings.edit、服务端权限／版本和两套分组保存边界不变。

验证及发布记录见PROJECT_MEMORY；独立候选.local/group-motion-candidate只叠加编辑器、模块CSS及浏览器测试三文件，保护其他未发布工作。

上线闭环：实时动效3文件发布main adc58de1，Vercel dpl_EAq1FXiHKgbBHpUvoQ8yNMq1ck8Y READY/两域名，CI37068106768全成功；191业务、36完整浏览器回归（含10定向）、四宽度和正式构建通过。用户Chrome已打开新窗口并取消，未保存测试设置；实际拖动GIF见.local/ui-proof/group-motion/live-drag.gif。


### Google 配置选择更新（2026-10-02）

用户已选择在现有kyox215项目配置ChinaTech专用Google登录，不创建新云项目。应用名称/支持邮箱/外部受众/联系信息已准备；Google用户数据政策尚未勾选，创建品牌及凭据前等待本次明确确认。未创建客户端或配置秘密。已核对Supabase站点与应用回调许可，生产同源Google入口503/异源403；源码未变，无本轮发布或性能变更。证据及下一步见PROJECT_MEMORY。


## 2026-10-02：实时通知与同步发布候选

按用户“开始执行”，整合恢复闭环与已存在的stateToken减负，接入数据库事务内最小Broadcast、门店私有接收RLS、HttpOnly SSE与断线补查。不同账号按实际权限读取；不允许通知携带业务正文，不自动重放未知提交，不自动跨设备传输设备草稿。详见[文档19实时实施段](19-sync-failure-scenarios.md#实时通知实施与本轮验收2026-10-02)。隔离候选保护main f578499的历史整机/账号/首页功能，云迁移成功；恢复26项＋WebKit精确观测13项复测通过；18原生对照/16平台日志相关性核对，真正JS异常/未知错误仍严格失败。整合adc58de分组动效后36控件/230单元/44API/16实时浏览器/8Broadcast、TS/lint/build通过。已发布main2f07ca3（40文件逐字节一致），Vercel dpl_DBUhCfi2kTvrZQGK5r2fiaijcBba READY/两域名；线上10拒绝/只读检查及现有正式Chrome私有SSE ready/心跳、历史1393通过，无生产业务写入。CI37070930552全部成功，发布验收闭环完成。


## 2026-10-03 维修采购与单条状态计划（待实施）

用户讨论后要求具体执行计划，整合[文档22](22-repair-supplier-batch-notification-plan.md)。同单多维修项目分别依据接单偏好核对并选供应商；加入采购车不进下单，单供应商批量记录实际下单／本批到货。到货／修好通知回归单条状态；修好后久等／欠款跟进独立，作废保留。领域合同、旧数据兼容、100条原子批量、并发回执和完整度反例列入执行顺序。只读源码核对与独立计划检查已完成，未实施、未执行新测试、未发布。

用户补充：屏幕／电池仅举例，通用项目支持其他配件与设备、自定义规格及纯服务无需采购；不把未选件当无需采购，汇总同商商品仍保留工单／项目分配。已补计划22，仍未实施。

用户已答复部分到货／开修选择：何时开修自己手动改状态，系统负责事实记录；配件数量与是否到齐按实收显示，不因到齐自动开始维修。已更新计划22，本轮仍仅规划。


### Google 登录启用与真实验收（2026-10-03）

用户明确同意后在既有kyox215配置ChinaTech品牌/ChinaTech Web，基本身份范围；Google secret仅保存到ChinaTech_date provider，未落盘/输出/提交。正式provider已Enabled，nonce校验保留、无邮箱关闭。真实Chrome Google授权回到工作台，刷新保持会话；只读云查询确认唯一原账号新增google身份且email身份保留，无业务/成员权限写入。正式入口200、Google client/callback匹配、S256/HttpOnly/Secure、异源403、额外provider400、缺code安全回login全部通过。无代码/构建/部署变化。

控制台仍Testing，发布按钮要求补品牌资料，隐私政策尚无确认文本；未冒称品牌验证/正式品牌发布完成。Google官方基本身份例外适用于实际email/profile请求（名单0已成功），授权页显示Supabase域名。后续品牌展示需补齐隐私政策及Google验证资料。证据.local/ui-proof/public-redesign/google-live-verification.json、google-provider-enabled.png；新未授权Google用户本轮未创建或实测。


## 2026-10-03：整机首页在售优先与新机／翻新机

按用户规划并执行：默认在售商品，已售移入已售历史，其他原状态单独保留；各区均有全部／新机／翻新机、搜索、类型及待核对筛选。复用既有PageTitle、SelectControl、classification语义按钮和历史表格；保留单机管理／识码／原详情。当前在售81（新机0、翻新机81）、已售1264、其他48；源字段和矛盾待核对不改写。详见[规格21](21-seatable-retail-history.md#在售优先与商品分类)。

基于同步发布2f07ca3叠加10文件，main35569767b0e849c7ea555d23a59a5ceb0584f471；10文件逐字节一致，Vercel dpl_J2ohswdR5eSoBkmzbnfWAEwuWzuT READY/production/两域名。235业务、4新增Chromium/WebKit回归、TS、lint0错误/1既有warning、正式build通过；合成四宽度无横溢，线上Chrome核对分类、三视图统计、刷新恢复通过。索引查询CPU指标见docs20，既有全店快照仍属P2，未声称服务器分页或线上INP提速。本任务5条本地合成单机已清理，3137/3138验证服务已停止，原服务保留。证据.local/retail-available-first/。CI37071293875第二次运行全部成功：235业务、40浏览器、lint/TS/正式build。首轮WebKit创建首个测试页面耗时27.943秒导致既有维修用例超时，其余39通过；按原代码原断言重跑通过，追踪保留在证据目录。

## 2026-10-03 Apple 接口与账号关联

完成独立账号设置、主邮箱双确认、Google/Apple身份关联与区号/短信OTP接口；原身份和门店权限不变，正式manual linking经用户明确确认已开启。Apple/短信实际服务未配置。19项定向安全/SDK、7组真实本地邮件集成、四宽度Chrome页面验证通过；隔离候选249单元、构建通过。已发布main52b7f677，Vercel dpl_YqDjsvFDFWqmjhqTuuTBj9CnaXTg READY/production/两域名；CI37075940272全部成功。线上14接口检查及现有真实Google账号只读页面验收通过。未发送外部验证码或修改真实账号资料。详见[账号绑定规则23](23-account-linking.md)与PROJECT_MEMORY。


## 2026-10-03 维修采购与通知已发布

用户已要求按计划22开始执行。候选最终合入账号版main52b7f677；通用维修项目／配件关联、创建加车原子命令、按供应商1–100条批量下单／实际到货、折叠旧通知组、修好单条跟进及作废空组已实现。独立审查六个P2全部修复，266业务／18真实本地API／46完整双浏览器＋8最后定向回归／四宽度／strict TS／lint0错误1既有warning／正式build通过。main bedc26e022e4d37f97210798736430aa5dc73e6a精确35文件，Vercel dpl_9JKoBs9sgdrz2zxPQqvUQAQDqio9 READY／production／两域名。Chrome七组、空作废、原自定义名及项目参考要求、采购车和到货窗口只读通过，无正式业务写入。CI37076940674全成功（266业务／48浏览器／lint／TS／正式build）；证据`.local/repair-operations-release/`。


维修采购本地收尾：35文件已安全合回root，保留并行账号／性能代码；分页前联系筛选、跨页采购候选和回执／临时scope兼容已补。root TS／282单元PASS+1opt-in skip／lint0err1warning，冻结273文件20组真实API通过。其他线程后续4个列表UI／性能集成改动未纳入本轮UI证据，未回退或夹带35文件正式发布。本轮3144／3145已停止，原3117保留。完整边界见计划22。

## 2026-10-04 商品名称／售出排序与简化列表

按本轮截图要求，在售默认名称A–Z，已售默认售卖时间倒序；旧历史沿已有拿走日期，未知末尾，正式销售用登记时间。列表删除重复分类／ST等编号／类型行及空字段“未记录”，有值号码、识别码、日期与价格保留；真实零金额不丢，编号搜索和详情完整资料可追溯。共享列表索引在分页前完成排序，其他状态与原显式排序保留；规格见[历史整机21](21-seatable-retail-history.md#2026-10-04-商品排序与列表精简)。

仅本轮5个代码／测试文件发布，规格及执行记录保留项目内；排除已有本地InputControl改动，保护其他main路径。独立候选296业务、8双浏览器、四宽度和排序／筛选／搜索／刷新／详情返回通过，strict TS／lint零错误1既有warning／正式build通过。截图已查看，均合成数据，无生产业务写入，实体iPhone未测。正式发布与CI结果见下文，证据`.local/retail-sort-simplify/`。

正式闭环：基于教程更新main e63ddf62保留其他300路径，仅5源码／测试文件发布 **74eeeb572457869fac0a83eed1904e6d4609896a**，Git blob与冻结验收内容一致；合入后正式build再次通过。测试经自动审批提示后改用页面演示登录，未上传认证字面值；内部文档和执行记忆按审批结果仅保留本地。CI **37208912406** completed/success，所有门禁通过；Vercel **dpl_8GLPfPAgt5357B8zzcqVEJVFaiVw** READY/production/两域名，login200部署匹配、匿名state401。正式Chrome只读确认81／1264／48和在售50条名称升序／已售50条原拿走日期倒序、空标注及重复分类标签已移除；未存客户号码或识别码，无生产业务写入。3126已自动停止，原3121保留；实体iPhone未测。本轮完成。


## 2026-10-04：全项目输入框状态与维护声明

依据用户给定的输入框四态参考，普通输入统一默认、聚焦、错误和已填，补齐禁用、只读与提交状态。新增 `InputControl`／`TextareaControl` 与 `control-feedback`，原 `SearchCombobox`、`SelectControl`、`IdentifierField`／`IdentifierScanner` 内部复用；账号、客户／客户设备、维修、采购、整机、供应商／收支／员工设置迁移。当前静态索引42个使用文件、146处共享控件引用（不等于运行时字段数）；业务组件无绕过公共实现的原生文本输入。标签与具体示例保留、紫色聚焦、字段下方原因／改法、关联 aria、原更新入口清空、提交时锁住草稿和失败重试一致；已填不伪称保存成功。金额／数量／规格范围、未知 null 与实测0、候选关联、权限和服务写入边界沿原领域规则。

独立只读审查发现隐藏扫码必填会拦父表单，已按打开状态禁用并补维修、整机建档、识码查询反例。实际浏览器另修复新错误行改变按钮位置导致 Safari 显隐点击丢失；原生气泡改为就地反馈、首个错误聚焦。既有总错误断言改为具体字段关联断言，仍核对不发生部分保存、失败输入保留及成功刷新。维护要求已写入根／组件 AGENTS、[组件规范06](06-ui-components-and-styles.md#输入框状态与维护声明2026-10-04后续功能必须遵守)和联动规范16；ESLint拒绝新增文本类 input／textarea／select 绕过共享控件，专用类型例外。故意违规样例4处被拒绝的检查通过。错误文字提取既有深红为 `--danger-text`，边框仍沿原危险色；末次4项双浏览器／四宽度定向检查验证小字号错误文字对白底对比度至少4.5，布局与点击继续通过。

验证：Node24.19.0 下296业务测试、118完整 Chromium／WebKit 浏览器用例全部通过（无跳过或重试），strict TS、lint零错误／1既有导航 warning、Supabase-mode 正式构建通过。1440／1024／390／375 的账号及维修／采购／整机／门店设置共40组视口检查；代表模块补32组真实输入点击，关闭瞬时菜单并待侧栏退场后截图，2个补验用例通过，已查看电脑与手机截图。手机输入16px、主要目标44px、无页面横溢；空登录0 POST、提交锁定期间仅1 POST、503后保留原输入且可发第2次重试。仅本地开发预览与虚构数据／受控失败响应，这些是请求与布局证据，不是线上INP指标。未操作真实账号、外部消息或生产业务数据，未测实体iPhone／第三方输入法；上述为发布前本地验收；后续上线见下文。证据 `.local/input-states/verification.json`、`browser-results.json`、截图和日志；修改前快照与验证源码摘要也在该目录。


最终发布闭环（输入框）：用户明确“推送上线”后，以最新教程main5d362eba为父基线，只合入46个源码／测试／公共规范文件，保留其他262个跟踪路径；首批2381809、初始化补丁595c958，最终main **595c95846a24726ecb9ce3d207a3586e9ded68e2**，Git树与冻结验收内容一致。输入状态维护规范06／16及ESLint门禁随源码发布；执行记忆与本进度结果仅在项目内补记。

首轮云端117/118：注册页在React事件接管前即允许填值，失焦时空的受控草稿覆盖第一次输入。4类公开账号表单共用 `useFormReady`，初始化前锁住输入、显隐和提交，准备后才启用；新增延迟脚本与首次输入保留反例，原密码错误／确认不一致／修正断言不放宽。补验44项双浏览器、strict TS、lint和正式模式构建通过。

最终CI **37232434099** completed／success：296业务、120完整Linux Chromium／WebKit（无重试或跳过）、lint／TS／正式构建全部通过，既有1条导航warning保留。Vercel **dpl_4mTt1Hz6mpMUuH3CXhKgZTqy7KWf** READY／production／chinatech.in和www；官网HTML部署ID与main匹配，8组双浏览器四宽度四态／清空／显隐及注册共享输入通过；登录、注册、找回密码、验证邮箱8组延迟脚本检查验证初始化锁定和第一次输入保留。login200、匿名state401、主域308正确，电脑与手机模拟截图已查看。请求保护记录0生产写入，未创建账号、发送邮件／短信或修改真实业务；实体iPhone／第三方输入法及线上性能未测。证据 `.local/input-states/published-verification.json`、`release-manifest.json`、`ci-final.log`、`production-checks.json`、`production-proof/`及原失败trace；3121已自动停止，本轮完成。

## 2026-10-06 商品少步骤闭环

用户批准实施：单页新建默认待检测、已实检可建档可售；检测可合并上架；客户／实际收款／交付同表一次成交；未知成本、所有权、子权限、保修冻结和客户／打印／售后关联保留。现场已检并结清交付的正常路径两次保存、三个推进按钮，事实输入另计。独立后端与前端交叉审查，正式本地16组已验，最终发布候选结果见docs/30。


### 2026-10-07 商品少步骤闭环发布验收

商品单页建档／检测可售合并／客户实收交付一次成交及原打印回链已发布main672561217ed723f945d13fa6f469e1c185bb87d7，Vercel dpl_FNY8X5dAkW9MjMNFZAvZdzpMWnWn READY及双域名；保留工具箱，未合入登录设备。46限定路径／359其他blob保留。CI37546513630同SHA全部success：364业务、196 Linux双浏览器、3250键、TS／lint0错1旧warning／正式build；main重复37547878460未完成，不误报。

正式本地17组及商品布局／三语教程通过；线上14HTTP／9媒体哈希与Range／现有Chrome四宽度只读入口均通过。自动审批限制正式选分类与打开售出表单，完整保存只在本地正式后台验证，无生产测试成交。原旧缓存测试两轮超时原因未确认，新增上游就绪准备，原断言保留；官方Linux30重复及最终全CI通过。零迁移／生产业务写入；实体硬件／真实弱网未验。详见[流程及思维导图](30-retail-simplified-workflow.md)、PROJECT_MEMORY与.local/retail-workflow-release/published-verification.json。

2026-10-07 Windows preview.2 启动器修复已上线 main887c1e6 / PR29 merged：ASCII CMD、编码启动/Console三语、缺文件明确要求全部解压。两环境各18真实CMD、完整392unit/244浏览器CI、生产28浏览器/7filehash/Windows真实下载通过；dpl_FkS2iXnwTN4sfBB7mUG93Hb59ZtY READY，两域与现有IAB版本已核对。完整自动升级仍未开放；关联事实与证据见docs31及.local/windows-toolbox/launcher-fix。

## 2026-10-07 登录状态闭环修复

已登录保留公开首页，入口按实际账号/项目会话/门店状态切换；首页各CTA及工具箱同源。已登录登录/注册分流、待授权重核与撤销反例、服务故障重试、跨标签与迟到结果隔离、只读无Cookie/不续期一并处理。复用及接口见docs06/16/29；真实本地与浏览器证据.local/auth-loop/。发布需当前main祖先、同SHA CI与正式状态验收，不能把本地成功当上线完成。

正式发布补记：main49c0d5f／PR30 MERGED，同SHA CI37682861546成功401单测＋252 Linux双浏览器、类型/i18n/lint/build；Vercel dpl_H8PRerP3CzUzf8Xkbpgy81t3q1TS READY生产两域。当前Chrome真实会话返回首页及工具箱三入口正确，登录/注册直达工作台；正式匿名HTTP与三语四宽度通过。证据.local/auth-loop/published-verification.json，完整限制见PROJECT_MEMORY。未撤销真实设备或修改业务数据。


### 2026-10-08 Office桌面助手VM测试

用户要求专用VM尽可能找问题，并允许仅该VM使用Windows UI Automation；修复版0.1.1、实际四流程及13项WPF反例/布局/导出、5文件保留、51项C#与29PS反例记录见[VM审查报告](office-desktop-vm-audit-20261008.md)。后台仍未发布、EXE未签名；不复用本轮证据冒充网站全仓发布门禁。


2026-10-08 Office桌面助手发布准备：36文件隔离候选7f36421，新增下载卡及SHA/三语说明。本地正式build/TS/lint/i18n/405单测、下载面板24布局通过，独立权限复核通过。生产仅新增4私有FORCE RLS表与独立production签名变量，正式网站尚未部署。公开仓库push遭自动审批拒绝，源码公开授权已询问待答；不把准备状态当上线。详PROJECT_MEMORY及.local/office-desktop/release/release-prepared.json。

## 2026-10-08 Office命令实测继续（本地候选）

Office候选已合入main49c0d5f；三语教程、Skype选项录制和实际播放同步，20双浏览器、404单测／1既有skip、三语／类型／lint／正式构建通过。实际用户Word／Excel／PPT样本及六应用启动通过，SYSTEM失败记录保留；OneDrive已配置账号，未新启动同步。无Skype重装仍被自动审批拒绝，0次执行，待完整直接授权句。两终端实装／重启／正式命令矩阵未全验，未推送部署。UI继续复用原segmented-control／button／PublicHeader，无新主题／公共控件。详细证据见docs31与PROJECT_MEMORY，不能以视频图示或接口替身替代实装。


## 2026-10-08 公开首页具名账号菜单

用户要求看见当前账号，点击展开资料／设置并保留工作台、退出。已增加同源具名菜单，展示本人canonical姓名／真实主邮箱／有效门店角色，未获权和故障状态正确隔离；账号设置与登录设备复用既有入口，异步定位补齐。身份通知立即清资料并隔离迟到旧请求，手机44px及三语长文已核。源码、闭环和验收见docs06/16/29；本地隔离405单元（1既有skip）、16＋58双浏览器、真实Auth十组及TS／i18n／lint／正式build通过，证据.local/account-menu/。发布状态另记，不能把本地测试当线上结果。


2026-10-08正式发布：main7f36421、PR31 MERGED、完整CI37701448779 success（406单测/252浏览器/3444词条）及Vercel dpl_Cz8rWWszug5uVSFp3jjw5DZYk6Np READY，两域和实际下载通过。Office页新增三语0.1.1 x64/ARM64入口；账号设置由既有指定管理员生成/停用/重开，Native加密/并发/幂等和重开后旧token仍401闭环通过。4测试key均停用、无本轮Office执行/业务写入，全局Officeepoch4保持。签名变量服务器私有，EXE未数字签名。重复CI的一次既有WebKit点击时序失败及测试harness误差证据保留，详情PROJECT_MEMORY与.local/office-desktop/release/published-verification.json。


正式发布补记（2026-10-08具名菜单）：main82f9b4b／PR32 MERGED，19限定路径正常FF保留Office；精确SHA CI37704855734 success（410单元零skip、260 Linux双浏览器16.0m、3451三语键、TS／lint／正式build）。Vercel dpl_G1f1fL3zqwDCvixXT1rFB7z9riZm READY/production/两域；正式anonymous五字段、formal:true、零Cookie／个人资料已核。生产10HTTP与96公共布局零实际异常，现有Chrome真实账号的首页／工具箱具名菜单、详细资料、设置和设备hash定位通过；未记录个人值、未退出或撤销真实设备。12次本地HTTPS状态样本中位130ms／最大161ms仅为本地实验条件。实体iPhone未测；本次无迁移／生产业务写入。证据.local/account-menu/published-verification.json；测试账号／店剩0，自建3181/3182/3183已停。


## 2026-10-09 公开导航工具箱与退出位置

按用户截图要求，右侧统一工具箱图标及可见文字，独立退出收进既有账号详情，左侧具名账号／工作台继续保留。手机语言不再挤顶行账号；1024长导航另排，品牌可返回首页。只调整公共UI和相关回归，未改认证／权限／数据协议。隔离候选基于正式main695f6c6，根未上线UI状态／目录／Office等工作保护。验证与发布状态见PROJECT_MEMORY及.local/public-header-menu/；详见docs06／16。


正式发布补记（2026-10-09公开导航）：main5c2ea59／PR36 MERGED／CI37860235875 success（417业务、290浏览器、3590词条及TS／lint／build），Vercel dpl_AmNR4A1kM6GhwsXzMVWfBTb7Q6cD READY/production/两域。正式11HTTP和120三语四宽双浏览器布局通过；现有Chrome真实账号菜单内退出1、菜单外0，资料／设置／设备／工作台、工具箱实际导航及返回刷新登录通过。未执行真实退出／撤销或写业务数据，实体iPhone未测。保留此前Linux布局／测试滚动失败及最终修复证据；详.local/public-header-menu/published-verification.json。

## 2026-10-09 ChinaTech通用安卓助手0.3

按用户要求研究5厂商家族7个既有代表APK及LocalSend/Syncthing公开协议，复核摘要与定向反编译网络类，借鉴公开机制；闭源源码未复制或分发。自主客户端双向可授权资料迁移、真实网关/网络句柄、实时扫码及回退、系统VCF完整字段、图库独立账本与未公开副本安全恢复；修复批量选择与界面勾选不一致。没有总10000项/批准2h上限，有限自动重试保留。

最终APK0326b05a…20da2、204 JVM/216 Android16模拟器/161三语键通过；网站复用公开导航与下载语义，三语同步，旧APK保留。全品牌真机、旧API/光学QR/自动热点加入、系统联系人实际导入未验，私库/安装/块级续传未实现。详[研究与实施](android-assistant-v3-research.md)及PROJECT_MEMORY发布事实。

正式完成补记：2026-10-09 main52d47cb／PR37 MERGED，CI37864254780完整success（417业务零skip、290浏览器14.8m、3601词条、TS/lint/正式build）；production dpl_Hot8xtJvjeHLpA9GHKkf6sHKmKzR READY，两域/HTML与同SHA核对；正式30双浏览器+2无JS真实下载、8HTTP/最新APK全SHA/Range206/说明原字节/旧资产通过。无生产业务写入，真机与原生未实现范围保留。证据.local/android-assistant-v3/published-verification.json；本轮3213和两AVD已停。

## 2026-10-09 Smart Switch lab4原版界面

恢复原Launcher／首页／无线阶段原布局，接入CTSS5/6真实目录选择和发送确认、通知／取消／冻结选择重连。最终两APK及两模拟器真实传输／回执通过；物理HONOR与其他品牌、热点自动加入／光学QR待验。已上线main a9572de／PR39，精确CI417业务／290浏览器和正式30浏览器／2无JS下载／20HTTP通过；两版本独立原界面两机传输已验。详[规格](smart-switch-original-ui.md)及本轮published-verification.json。


### 2026-10-10 Office 桌面助手准入开关（本地候选）

暂停仅拒绝新会话，旧会话按原期限继续；不改旧Office总开关epoch/密钥revision。复用account panel/form/button/token及原账户身份边界，新增独立OfficeDesktopControl，不引入主题或控件库。后台真实本地Auth/API与双浏览器保存/刷新/丢失响应恢复/三语四宽32项通过，实际WPF联网检查与断网恢复11项、SQL10组、HTTP8组和C#56项通过；不代表物理x64或本轮Office安装验收。源码79836d0/21限定文件已备，783其他blob保留，自动审批要求明确本轮新增源码公开授权，尚未迁移或发布。详docs/office-desktop-assistant.md和.local/office-admission/prepared-verification.json。


## 2026-10-10 Office0.2免输入联网准入（本地候选）

用户选择无密钥、登录和验证码，启动联网后展示工具；网站暂停新启动或最低版本拒绝旧版，已有会话保持原expiry最长1h且已开始任务完成。手动官网下载更新；0.1.1需一次人工更新，旧v1会话仍受旧总开关／密钥控制。0.2保留AES包／runner指纹、原安全操作和恢复报告，后台移除密钥生成入口。只有具体版本完成两文件完整SHA才可设置最低版本，发布标记由受信任管道持有。实际本地Auth／RLS／HTTP、双浏览器与WPF证据分开，未写生产／公开源码／发布Release。最终记录见[规范](office-desktop-assistant.md)、[发布交接](office-desktop-0.2.0-release.md)及PROJECT_MEMORY；不是Office安装／许可验收。


## 2026-10-10 Office0.2已正式发布

本日随后VM复验发现管理员资格误判，修复仅本地候选：同管理员账户普通启动的UAC limited token允许进入确认，Worker仍需真实提权。独立审查、严格双架构/80协议、实际2000次资格/句柄216→216通过。继续测试已实过联网、检测/按钮、三操作确认语义No取消、真实脱敏JSON保存核对、中意英、意大利语页尾滚动、跨架构重复exit3、x64兼容层联网检测及正常关闭/ARM64重开；初次坐标审批拒绝已由公开代理初始化与可验证控件解决，不再等手工取消。Office操作0/两记录保持不存在，公开0.2.0字节未换；标准/提升账号、实体x64和实际Office操作许可仍待验。最新证据、截图与候选见PROJECT_MEMORY和Office规范。

用户已明确确认公开本轮30路径与上线。main正常FF d2f53bf／PR42 MERGED，原两完整CI成功433unit／320浏览器；生产限定两迁移经SQL摘要／权限独立复核通过，旧总开关epoch4/rev3及旧数据保持。GitHub双EXE首次及官网实际按钮二次全文SHA/大小通过，24三语四宽布局及生产HTTPS准入／最低版本426／暂停403／旧会话原期限和AES任务／恢复200通过；受信任放行verified0.2后由真实管理员UI设min0.2并恢复开启，刷新保持同一事实。最终Git main生产dpl_9wfCqD8gwFs6QQCtJ5bL8HiuSuy7 READY／两域。

专用Windows ARM64原生及x64兼容层正式EXE均真实无参数自动联网进入，两记录原本不存在，启动保持未创建；已有记录保护另有本地合成测试，未点Office动作；无实体x64／重复Office实装许可验收，仍未数字签名。main38066278657与tag38065326528自动CI均success，连同PR/push共四次完整同SHA成功（433unit零skip／320浏览器）；Release已稳定，三语README从实际地址下载字节一致；证据.local/office-public及[发布记录](office-desktop-0.2.0-release.md)。


## 2026-10-11 Office0.2.2持续迭代（本地未发布）

用户授权持续改进及专用VM测试。已修正常用预检/错误恢复/会话时间边界、大小写及附加应用文件保护，并新增按已验证客户端版本固定runner归档及SHA，保持旧会话/UUID/原期限、不扩大移除范围。0.2.1生产与下载保持；0.2.2未发布、正式准入未扩。根30 Node、第二轮176 C#/57 Windows AST与双RID构建/正式元数据通过；后台真实受限SQL/HTTP及精确清理通过。

首轮00b061冻结包实际SYSTEM执行器完成许可核验、卸载、安装、重装；安装/重装明确未激活，Skype与合成文档保留，真实三应用只读读回通过。最新89dc包仅构建/逻辑反例与GUI可读性检查，尚未重复完整实装。普通GUI→UAC全链没有启动，不算通过；标准账号、真实许可、实体x64及中断/重启恢复待验。详[专项报告](Office桌面助手优化报告-20261011.md)、PROJECT_MEMORY及 `.local/office-iterations-20261011/`。持续goal active，后续按真实反例迭代，不自动发布或恢复旧网页KMS路径。


## 2026-10-11 续迭代：任务恢复与取消句柄（本地未发布）

0.2.2最新runner b532c8d4…b32d70，24输入冻结round5，与根一致；Formal ARM6473d49e…cd5/x64b50e752…044，DEV6b1db696…4b7。RequiresRecovery三类未知/系统保护统一保留记录；取消事件及原工作进程同一SafeHandle持有至结束，PID/创建ticks核对，失联或句柄关闭停止下一安全边界，等待当前ODT结束。089bb的disposed-owner实际反例失败保留，未改原断言，b532的57+14真实Windows检查71通过。实际RecordResult六态、30Node、双RID183CLR/正式元数据/无开发类及定向lint通过。

旧89dc实卸载67s/无套件许可拒绝/安装172s完成；最新b532实SYSTEM worker/DPAPI/管道/PS/官方ODT完整重装241s，任务收口INSTALLED_UNLICENSED，Skype及合成docx/xlsx/pptx SHA保留，当前用户真实三应用只读读回内容通过。另当前用户Word占用诊断与完整脚本预置取消/ODT0通过；SYSTEM COM失败、测试器.txt后缀/传输回执/编码失败保留而非通过。最终无Office/setup/候选进程/unfinished/3258/主机3259，自有服务已停，防护与共享不改。后续只读许可查询licensed=true，但未执行activate，状态变化来源及权益未验，任务历史原false保留。

普通GUI/UAC及界面结果记录、最新候选另外独立三操作、真实ODT取消/断网/进程失联/重启恢复、实体x64/x86/许可权益/代码签名未通过。正式0.2.1/catalog/最低版/SQL上限/生产不改；旧版本和v1固定65061…7cad，未发布022显式固定b532，不能自动跟current。报告与证据：docs/Office桌面助手优化报告-20261011.md、.local/office-iterations-20261011/verification.json及round5/。持续goal active。


## 2026-10-11 Office0.2.1主流浏览器与Windows启动复验

专用Win11 ARM64：Edge154双包不常见下载信誉警告；Chrome155/Firefox157官方签名ARM64浏览器真实官网四下载完成、SHA/大小/MOTW正确，无浏览器拦截。正常Explorer首次打开，两ARM64实显SmartScreen未知发布者并选择不运行；两x64通过兼容层实际启动、联网进入操作页，随后正常关闭。IE入口转Edge，Win11独立IE不可验，IE mode未测。

Defender/实时/三防火墙与默认下载保护保持，相关检测记录为空；未绕过、无Office操作/源码或生产变更。已有VM不是新系统信誉基线、实体x64/第三方杀毒未验；未签名仍是分发风险，后续优先可信签名但不保证即时消警。保留另一任务DEV4880及原窗口，自己的3247服务已停。详细证据和限制见[浏览器报告](Office浏览器验证-20261011.md)及PROJECT_MEMORY。

## 2026-10-11 Office代码签名接入准备（本地，未签名发布）

新增独立release工具，冻结双架构正式构建与SHA，拒绝旧版本/开发包/变化输入；传统证书与Artifact PublicTrust配置、SHA256/RFC3161签名、完整预期发布者/EKU/可信时间戳/WinTrust/微软SignTool严格验证，全部原始程序内容绑定和最终签后SHA。双包通过才写结果，releaseReady=false，仍须真实应用与浏览器验收。独立审查的内容替换及提交后清理误报两项已修，最终复核无新实质绕过。

Python18、实际Windows三源解析/13拒绝/20模拟证书区载荷检查通过；原文件SHA不变。执行策略Restricted未改，AST源码测试不能当正常ps1链或真实证书签名通过。最终防护开启，双证书库可用私钥0/SignTool空，无签名输出；自己的3267已停，另一任务DEV4880保留。未购证/云登录/信任根写入/Office操作/生产更新，正式021与并行022不改。等待实名证书或已验证服务配置及受控签名机，详细[接入记录](Office代码签名接入-20261011.md)与.local/office-signing-20261011/verification.json。


### Office完整计划与边界验收 2026-10-11

本地0.2.2接入确认快照、完整语言媒体与最终核验、确认后会话和卸载后媒体复查、已知失败的移除检查点；每SKU与目标容量一致，严格JSON/深拷贝及三语同步。43冻结输入与根一致，双正式各1310CLR/PE、30Node、类型/定向lint/三语、Windows89+80范围及5真实Native拒绝/3PS结果读回通过，范围重叠；媒体/移除边界为替身，未算真实Office/GUI/UAC。当前LYNC缺失门禁保留，六程序/三合成文档保持，0生产/Office写入。夹具PSObject排序失败保留，修类型后原断言过；构建来源及复用见[验证](../.local/office-iterations-20261011/round24/verification.json)，详细[规格](office-desktop-assistant.md#完整确认计划与媒体边界-round24)。原UIA请求待答复，实际Skype/语言保留及真实恢复仍未齐。


### Office ARM媒体与架构失败闭环 Round25 2026-10-11

本地0.2.2从可信CIM区分原生ARM与x64 Office，ARM三文件必需，未知架构拒绝；移除后该错误继续保留明确未安装检查点，三语不再误称未开始。44冻结输入与根一致，f264新档/正式65061旧档保持；双RID各1315CLR/PE、30Node/类型/lint/三语、最终101PS、8实际微软媒体副本检查过，89未变执行器证据复用；移除是替身，不当真实Office验收。最终候选实际诊断Skype缺/许可只读licensed，未激活或验证权益。真实媒体18文件和六程序/三文档保持，0生产/Office动作。下一步完整基线/最新GUI与真实四操作/恢复及合法测试许可。详[验证](../.local/office-iterations-20261011/round25/verification.json)、[面向用户的报告](Office桌面助手下一步优化报告-20261011.md)。

## 2026-10-11 Office签名工具源码发布

用户明确授权发布上线。10路径工具/说明/CI白名单，813原blob保持，main正常FF775b673、PR44 MERGED；同SHA两完整CI38133446378/38133464425 success（Python18、PS5.1三源解析、436Node零skip、320浏览器、3656词条/strictTS/lint/build）。main第三次同源CI取消并复用既有成功，不当第三成功。正式Vercel dpl_7KZY6UidZkWb5poBNMNjS1p1zCoT READY/同SHA/两域；5公开GET、双下载链接/控制状态、五旧Release资产记录与公开README字节核对通过。

发布是签名工具源码与说明，不是新的可信签名EXE；0.2.1仍未签名、022候选不合入，无证书办理/Office操作/数据库变更。预览READY但正文未取得，临时分享旁路fetch被自动审批以可能暴露保护内容拒绝，未绕过/改保护；CI与公开正式验证分开记录。详[接入记录](Office代码签名接入-20261011.md)、[PR44](https://github.com/kyox215/Chinatech-codex/pull/44)与.local/office-signing-publication/published-verification.json。


### Office Skype 修复准备复核 2026-10-11

同版本官方索引与原件摘要相同，完整描述器未揭唯一排除条件。独立复核修准备包目的setup验签/SHA与末尾9文件核验，fresh目录实际VM预检过；18媒体/9文件保持，修复前快照实时确认，未调用ODT。候选44输入/R25证据继续适用，不新增构建或全测。已请求仅移除重加缺文件Skype的范围确认，默认保留策略不变；移除后原ProPlus/语言/文件检查不过不得Add。0新Office动作/激活/生产变更，实际四操作、最新GUI/UAC仍未齐，goal active。[证据](../.local/office-iterations-20261011/round26/verification.json)。


### Office 重装衔接独立激活 2026-10-11

未发布候选接两个既有动作：保存重装→新鲜状态/许可→新UUID/独立activate授权，失败仅重试激活，不重放卸载。UI锁/取消/两步骤历史与三语同步；三独立复核缺口已修，原7矛盾复现全拒。48源码冻结，双RID各1450CLR/PE、30Node、Windows135纯输入模块及当前DEV只读诊断过，范围重叠；9文件保持、LYNC缺，新GUI/UAC和实际四操作仍未齐。runner/Native/API与生产未改。初始测试与RID/restore失败保留修后过。[验证](../.local/office-iterations-20261011/round28/verification.json)。

### Office 1.3 Fluent界面（2026-10-13）

按用户推荐实施，先预览再原生，内置Fluent控件/应用选中卡/独立管理/固定底部进度。执行器与范围守卫不变；当前预览198组与严格编译通过，真实Windows合成布局/完整CI及发布待完成。详[1.3记录](Office助手1.3Fluent界面与上线20261013.md)。


## 2026-10-13 Office 产品介绍与微信视频

工具箱 Office 页面改为产品介绍与下载，移除 CMD／PowerShell 命令区，保留 1.3.0 测试版及三语 FAQ；43秒竖屏成片由用户自行发布微信。独立于待验收1.4。[实现及验证口径](Office助手产品介绍与微信视频20261013.md)。
