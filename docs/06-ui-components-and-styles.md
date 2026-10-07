# 公共组件与样式复用规范

## 2026-10-07 Windows 检测候选

`/toolbox/windows` 复用 PublicHeader、Brand、LanguageProvider、LanguageSwitcher、公共 button 与 token；PublicHeader 仅扩展 `page="windows"`，与 Office 共用返回工具箱。下载／条件面板使用工具箱私有 CSS Module，无新主题或依赖。核心说明与下载由 SSR 输出；无 JavaScript 仍可看默认中文说明并下载包含三语入口的ZIP。

网页与启动器同步三语，清单关联生成源哈希；明确显示检测版和自动升级未开放。三语四宽度／双浏览器和无JS下载已实测，Windows／PS2／实际旧浏览器未验。详细状态见[Windows工具箱31](31-windows-toolbox-upgrade.md)。



LanguageSwitcher复用useFormReady：服务端/初始化期间禁用选择，准备后保留第一笔语言选择及刷新偏好；防止未接事件时原生下拉值被保存偏好覆盖。所有现有使用方共用，无新样式/主题。

## 2026-10-07 Office 联网控制

OfficeToolboxControl 是全站工具管理专用组件，复用账号设置card/cardHead/form/muted/nav及原button/语义token；通过AccountOverview可选capabilities.canManageOffice接入原账号设置列与锚点。显示能力来自服务端，写权限由独立管理API/私有表再次检查。公开Office页仅异步生成受控启动器，Blob下载当前命令、网关源码链接，生成/停用/错误/复制/迟到响应独立反馈，44px与三语保留。仅复用组件，无新主题/依赖/普通输入框。控制语义与验证范围见[整体开关31](31-office-command-control.md)。
## 2026-10-07 Office视频复用

TutorialLibrary增加可选readonly教程目录、4:3／16:9及操作回调，默认首页目录／4:3与Strict ref微任务清理保留；Office通过独立三语目录复用播放器，不复制媒体处理或新UI框架。教程→对应命令使用有限OfficeAction hash，同页明确选项及焦点／刷新／前后返回保持一致；手动改选时已有command hash同步。共用PublicHeader、语言／按钮／token，私有Office锚点避开sticky header。目录语言只改显示，原命令及源码字节不译写、不执行。媒体／章节／封面／字幕按同一实测配音生成；图示必须标示，不能把动画当Windows实际执行成功。

## 2026-10-07 Office 命令工具

`/toolbox/office` 复用 PublicHeader 的 `page="office"` 返回工具箱、Brand、LanguageSwitcher、button、segmented-control 及已有颜色／圆角／边框 token；四种操作及终端选择、长命令与复制反馈使用工具箱私有组件和 CSS Module，无新公共控件、主题或依赖。选中终端复用 `segmented-control__active`，手机操作至少44px。Office 分类新增实际命令入口，其他待添加分类保持原展示。

命令数据归 `lib/toolbox/office-commands.ts`，八种终端命令与四份可读源码以静态 `.txt` 供查看／下载；网页只显示或复制文字。Clipboard 调用失败保留手动选择与下载，操作／终端变化和卸载组件均隔离迟到结果。全部内容同步中／意／英。单独安装／激活／卸载脚本使用独立临时文件及固定上游哈希；完整重装保留用户提供源码与配置预检。激活核对目标版本、授权状态及密钥后缀，不将其他 Office 版本授权当成功。

验收仅针对公开页面、命令字节／源码／下载一致性、语法和复制状态；不代替 Windows 真机安装或许可证验证。不新增后台读取／写入、权限或业务数据链路，签名／打印／教程及数据保存闭环不适用。

## 三语显示与后续维护（2026-10-06）

用户可见系统文字同步中／意／英，涵盖动态配置、结构化选项、消息模板、可访问名称及操作状态。共享显示helper复用结构化故障与打印词汇；客户原文、姓名、品牌型号与未知历史原样保留，缺值占位依据原始缺值事实，不靠姓名字典匹配。签署／打印语言独立，冻结事实不回写。

手机标题与菜单独占标题行，操作另行，扫码复用iconOnly和完整可访问名称；电脑保留文字。SearchCombobox的displaySelectedLabel仅用于预设标签，候选选择／校验／保存继续使用canonical value，手填不自动选中；客户姓名／号码等原文控件保持默认。普通下拉继续SelectControl。

后续新增／修改通过三语完整性、词条冲突、数字／变量与源文覆盖检查；源扫描明确动态边界，不能冒称证明任意运行时文字。受影响事实按新建→校验→保存→刷新→列表／详情／关联→历史／签名／打印／教程闭环；发现→修复→复验逐项留证，正式与预览分开，未完成不得宣称完成。


## 2026-10-05 共享语言显示

新增 `LanguageProvider`／`useLanguage` 维护三语显示状态与静态 `lib/i18n` 字典，`LanguageSwitcher` 复用 `SelectControl`、`.module-select`、Lucide Globe和既有语义token，沿用公共下拉框的原生回退／增强菜单、焦点与44px高度，模块仅设容器宽度与16px字号。根布局统一提供状态；页内文字和固定选项在渲染时翻译，禁止将显示译文用作保存值、搜索事实、权限或签署快照。未知自由原文保持原样；含变量消息显式保留原值，领域金额／数量／并发规则不放宽。

公共输入、候选、识码、SingleChoice／MultiChoice继续保留原控件、字段关联、值、onChange、焦点与校验。错误在显示层翻译，原 `setCustomValidity` 和领域异常未改写；SelectControl只在语言改变时刷新增强显示，原生option必须显式保存原value。表单不按语言加key；教程内容可按语言重建，以停止旧声轨并等待下一次用户播放。

首页、账号页直接显示44px／16px语言选择器；后台放在既有侧栏账号菜单，手机仍使用标题旁菜单，无新全局导航。字体、颜色、按钮、面板、原生video和字幕轨沿用公共样式及模块CSS，无新UI框架或主题。教程的实际控件落点由DOM测量，不能用装饰鼠标代替真实目标。验收与限制见docs04与PROJECT_MEMORY。

2026-10-04 旧站浏览器退役：根 layout 仅挂载无界面的 `LegacyServiceWorkerCleanup`。它只更新同源根 scope 的精确 `/sw.js` 旧注册，不向新设备安装后台脚本；更新失败保留旧壳，联网／返回前台重试。清壳和注销由替换脚本在激活接管后执行，范围仅 `repairdesk-shell-*`。不得强制刷新或导航当前新页面，不得清空登录 cookie、IndexedDB 草稿／附件、记住登录设置或其他缓存／后台脚本。旧恢复入口和双域名兼容详见[旧站清理25](25-old-site-residue-audit.md)。无新增 UI、主题、依赖或业务协议。

2026-10-04 手机连续行：维修列表的`.repair-unified-list`采用无独立卡片外框的两行网格，标准93px，长内容自然增高；电脑完整六列继续沿用。配件普通单元格和100%宽度按钮保留，列表手机供应商可省略但真实窗口完整读取。配件按钮浅紫、联系按钮浅灰、阶段原状态色，均复用现有token／按钮／图标。`RepairContactControl variant="list"`把适用事实放在同一真实“跟进”按钮内；只读展示同一事实，默认详情保持原结构。不可使用CSS伪文字、叠字或隐藏业务状态提高密度；焦点／44px／实际点击及关闭返回继续验收。无新公共组件、主题token或业务协议。

2026-10-04 云端WebKit窄桌面补充：长供应商按钮曾高于所在工单行，底部点击误命中下一单。仅改flex为grid曾无法修复，已在官方同版本Linux WebKit环境复现。配件入口增加普通`.repair-row-parts-cell`，内层按钮宽度100%、图标／文字使用明确网格列，手机行列定位归单元格；普通单元格让完整按钮高度参与本行布局。相同Linux环境原用例失败→包裹后通过，不断言未证实的引擎内部原因；两端沿用同一入口、token和44px目标。保留五点命中要求，补按钮必须完全位于本条工单范围的断言；诊断记录具体坐标、命中元素及裁切祖先。同一Linux环境完整82项及Mac20项定向浏览器检查通过，严格TS、lint零错误和正式构建通过；最终发布后的云端结果仍须另核对。

2026-10-04 后续简化：维修列表保留六列，移除独立配件进度和型号下内部编号，负责人／更新在末列。搜索、筛选、分组视图与排序复用既有控件；分组配置入口只在设置→订单管理，仍复用`RepairGroupEditor`与`settings.edit`。`RepairItemsForm`按当前接单项目排列紧凑行，草稿选供应商提示“保存后加车”，共享保存成功才显示“已加购物车”；成本门控不变。阶段和联系窗口沿原token、Lucide、44px目标与16px输入。详情主栏独立流排故障、采购和签名，右栏独立流排概况／客户／附件，去掉跨行撑高。返回状态由`lib/repair-list-view-state.ts`维护，搜索只在同页签内存，session仅保存不含个人搜索文字的视图参数，身份／门店／成员版本／权限隔离。fixture与LOCAL详情返回复用`PageTitle backScroll={false}`。`IntakeSignatureSection embedded`仅取消嵌入连续主栏时的额外外边距，fixture默认保持原样，签署事实／保存逻辑不变。


2026-10-04 维修列表视觉适配：`RepairStageControl`／`RepairContactControl` 的 `variant="list"` 仅调整列表中的短标签、事实分层和44px入口，默认详情外观不变；不得复刻写入和权限逻辑。`RepairScanner` 可透传 `iconOnly` 到已有 `IdentifierScanner`。列表两端共用同一个 `.repair-row-parts` 按钮，保留 `repair-action-<id>` 与可访问名称，关闭窗口返回可见入口；不再在行末放同功能图标。修复手机末条待核对提示隐藏。样式集中在原 `.repair-unified-list` 作用域及其两套断点，原token、系统字体与Lucide复用；方案及验收见[工单列表当前适配](09-repair-table-layout-plan.md)。

本规范用于后续功能的统一开发，强制入口见 [根目录规则](../AGENTS.md)；组件目录另有 [继承规则](../components/AGENTS.md)。它索引当前真实实现，不引入新 UI 框架，也不改变业务范围。

## 开发顺序

1. 先读 [项目连续记忆](../PROJECT_MEMORY.md)、适用的 `AGENTS.md`、[联动修改与闭环规则](16-change-consistency-contract.md)的受影响行和本次业务规格。
2. 按要实现的界面语义，查找以下组件、`app/globals.css` 中的类及现有使用页面；不要全仓复制近似页面。
3. 优先使用现有实现；能力不足时扩展稳定的公共 API。确实是新交互才新增组件，并记录原因、使用范围与验收状态。
4. 公共修改定位所有实际使用方，按影响选择代表流程回归；新增入口和变体同步维护本文。

不要求把每个 HTML 元素包装成 React 组件，也不把所有模块差异塞进一个组件。

## 已有组件入口

| 组件 | 实现 | 复用边界 |
| --- | --- | --- |
| `Brand` | [brand.tsx](../components/brand.tsx) | 首页、账号页与后台的品牌标识；支持 `compact`、`inverse`、`href`，不另写 Logo 标记。 |
| `InputControl` / `TextareaControl` | [input-control.tsx](../components/input-control.tsx) | 普通文本、邮箱、电话、密码、搜索、日期、数字与多行输入的共同状态入口；保留原生表单属性、事件与 ref，领域限制由调用方提供。图标／密码显隐用 `leading`、`trailing` 与 `shell`；清空由调用方显式提供。 |
| `SelectControl` | [select-control.tsx](../components/select-control.tsx) | 普通下拉选择；沿用原生选项、表单属性和事件，配合 `.field` 或 `.module-select`。 |
| `SearchCombobox` | [search-combobox.tsx](../components/search-combobox.tsx) | 可编辑搜索候选，支持键盘移动、滚入视区、确认、Esc、手动值与 `maxLength`；候选数据和选中客户的业务关联留在调用方。不是普通下拉的替代品。 |
| `MultiChoice` | [multi-choice.tsx](../components/multi-choice.tsx) | 原生 checkbox 多选标签，支持图标、选中态与键盘焦点；故障细项、随件复用，互斥和自定义值由模块维护。 |
| `SingleChoice` | [single-choice.tsx](../components/single-choice.tsx) | 原生 radio 图形单选，支持图标或图形、标签与选中态；用于直接可见的互斥选项，不复制普通下拉菜单。配件规格的条件与清理规则由维修模块维护。 |
| `ColorPicker` / `ColorSwatch` | [color-picker.tsx](../components/color-picker.tsx) | 设备颜色使用实际色块、文字标签和 `SingleChoice`；支持未记录与自定义颜色，Esc 关闭后返回触发点。色块是业务颜色数据，不另建主题 token；未知颜色保留空值。 |
| `PhotoCapture` | [photo-capture.tsx](../components/photo-capture.tsx) | `getUserMedia` 拍照、镜头选择、照片预览、确认与重拍；确认后才将 `File` 交给调用方，上传照片作为回退。关闭、后台、卸载及过期请求释放镜头和临时 URL；保存、数量限制及业务关联留在调用方。 |
| `IdentifierField` / `IdentifierScanner` | [identifier-field.tsx](../components/identifier-field.tsx)、[identifier-scanner.tsx](../components/identifier-scanner.tsx) | 所有可编辑 SN / IMEI 及识码查询入口统一输入＋扫码；相机/相册/手动共用生命周期，原文核对后确认填入。只读展示不重复加扫描按钮。IMEI 格式校验、拒绝网址归 `lib/identifier-scan.ts`；业务匹配、查重和建档归模块。 |
| `AppShell` | [app-shell.tsx](../components/dashboard/app-shell.tsx) | 后台全局导航与框架；由 [内部 layout](../app/app/layout.tsx) 统一挂载，新页面不再嵌套一份。 |
| `PageTitle` / `SidebarToggle` | [page-title.tsx](../components/page-title.tsx) | 跨模块标题、图标返回和手机菜单入口，统一用于页面内固定工具栏；继承 `AppShell` 的导航上下文。`title` 为标题，`backHref` 为明确返回地址并可保留模块维护的筛选参数，`backLabel` 提供返回目的的可访问名称；可选 `badge`、`subtitle` 保留详情状态与副说明，`children` 保持兼容。`backScroll={false}` 沿用整机详情返回时不重置滚动的 Link 行为。电脑折叠按钮只放侧栏，成功/空状态也须保留手机导航。 |
| `UnitIcon` | [unit-icon.tsx](../components/retail/unit-icon.tsx) | 整机模块内按 `RetailCategory` 显示品类图标；不作为客户设备身份或其他业务分类依据。 |
| `RetailCatalogControl` / `RetailRamControl` / `RetailStorageControl` | [retail-spec-controls.tsx](../components/retail/retail-spec-controls.tsx) | 整机私有规格输入，新建与逐项编辑复用；候选用SearchCombobox，容量用SelectControl，保留未知／自定义。目录、类别适用与实测校验留在整机模块，不复制公共控件。 |
| `ProcurementPreparation` / `ProcurementFeedback` | [procurement-preparation.tsx](../components/procurement/procurement-preparation.tsx) | 工单列表、详情与采购详情共用一键加车、取消加车及已下单标记，无需订单号或备注；读取采购提供器，业务校验归 `lib/procurement.ts`，不是公共控件或供应商发单组件。 |
| `RepairProcurementShortcut` / `RepairProcurementDialog` | [repair-procurement-shortcut.tsx](../components/procurement/repair-procurement-shortcut.tsx) | 工单列表短图标入口与稳定快捷弹层；列表集中管理打开的工单，换组不卸载弹层。当前项目直接用 `RepairItemsForm` 图形卡片填写选填供应商、报价与获权进价，一次保存；既有采购记录的按需切换复用 `SelectControl`。原生 `dialog` 管理模态焦点和 Esc，关闭后定位目标组与工单，仍属于维修与采购关联模块。 |
| `RepairProcurementSummary` | [procurement-summary.tsx](../components/procurement/procurement-summary.tsx) | 工单内展示同源采购事实和快捷表单；备选用途独立展示，不从外观或维修阶段推断下单。 |
| `RepairScanner` | [repair-scanner.tsx](../components/repairs/repair-scanner.tsx) | 工作台与维修列表共用查单；相机、相册、手动输入只返回目录中的 fixture 或当前浏览器本地工单候选。解码通过公共 `IdentifierScanner` 按需加载，匹配规则归 `lib/repair-scan.ts`；工单候选逻辑不作为整机录入或通用业务写入。 |
| `IntakeReview` | [intake-review.tsx](../components/repairs/intake-review.tsx) | 接机确认和本地工单详情共用图形核对区，显示联系人、设备、报告故障、维修需求与随件；当前照片可选传入，修改入口由接机流程提供。`layout="review"` 保持逐步核对顺序，`layout="detail"` 使用设备摘要＋主辅双栏；`metadata` 放工单元信息，`asideContent` 组合工单概况，`relatedContent` 组合采购摘要。手机按故障→概况及联系人→采购排列，不把工作流或采购规则塞进展示组件。属于维修模块，不作为检测、报价或正式授权组件。 |

新增后台模块复用 `PageTitle` 并继承 `AppShell` 的侧栏，不恢复全局顶栏或手机底栏。页面不增加装饰性眉题、开发说明或重复功能解释，只保留业务字段与必要反馈。账号、通知与退出集中在侧栏底部。权限与会话规则仍遵循业务规格，导航可见性不等于服务端授权。

后台 `.module-heading` 是当前页面内容顶部的固定工具栏，滚动时保留该页标题、返回、手机菜单及必要操作。返回入口与标题同一行，统一使用 `PageTitle` 的 `.icon-button.page-back-button` 和 20px 箭头；`title` 与 `aria-label` 说明返回目的，不另加标题上方的“返回某列表”文字行。只有明确传入 `backHref` 才显示返回，模块首页只保留菜单和标题，不使用浏览器历史猜测返回地址。采购与整机详情使用 `badge`、`subtitle`，保留各自业务事实与右侧操作，不复制标题结构。工具栏的白色面板、细边框、桌面操作及手机紧凑行由公共样式维护；手机返回与菜单目标至少 44×44px，账号与退出仍在侧栏。详情工具栏的 `.page-toolbar-action` 在电脑显示图标＋文字、手机收为 44px 图标按钮；调用方必须提供 `aria-label`、`title` 并以 `span` 包裹可见文字。采购与整机的重复副说明在手机正文查看，避免撑高工具栏。搜索和筛选随正文滚动，不再叠加第二条固定搜索栏。

## 已有公共样式

样式与 token 的唯一实现来源是 [app/globals.css](../app/globals.css)。下表是 CSS 类约定，**当前没有对应的通用 `Button`、`Panel`、`Field` React 组件**。

| 界面语义 | 优先复用的类 | 使用要求 |
| --- | --- | --- |
| 主次操作 | `.button`、`.button--primary`、`.button--secondary` | 导航用链接，操作用按钮；表单内非提交按钮明确 `type="button"`。 |
| 图标操作 | `.icon-button` | 提供可访问名称；手机主要操作仍须达到 44×44px。 |
| 白色面板 | `.panel`、`.panel__header` | 保持共同边框、圆角和标题层级。 |
| 表单 | `.field`、`.field-grid`、`.field--wide` | 保留关联标签，普通输入用 `InputControl`／`TextareaControl`，下拉框用 `SelectControl`；沿用原生输入语义。 |
| 图形单选与设备颜色 | `.single-choice`、`.single-choice--colors`、`.color-picker`、`.color-swatch` | 通过 `SingleChoice` / `ColorPicker` 复用原生单选与色板结构；颜色同时保留文字，不能只靠色块识别。 |
| 页面标题及操作区 | `.module-page`、`.module-heading`、`.module-title`、`.module-title__content`、`.module-title__line`、`.module-heading__actions` | 页面内固定工具栏通过 `PageTitle` 统一图标返回、标题、状态与手机菜单；副说明留在标题主体，窄屏必要操作可换行。 |
| 仅屏幕阅读器可见 | `.visually-hidden` | 用于保留原生文件输入等语义；不用于隐藏业务错误或关键操作。 |
| 列表搜索与筛选 | `.module-search`、`.module-select` | 保持搜索、选择和清空操作的统一外观与键盘可用性。 |
| 宽表格滚动区域 | `.module-table-scroll` | 桌面表头与数据行放在同一容器，提供 `role="region"`、明确名称和 `tabIndex={0}`；窄电脑窗口可键盘横向滚动，筛选工具栏留在外部。手机取消列最小宽度，维修采用紧凑连续行，其他模块沿各自已确认布局。 |
| 空结果与加载失败 | `.module-empty`、`.panel` | 空结果说明当前无数据或无匹配；加载失败提供明确重试。主次操作继续用 `.button`，空态简易按钮样式不得覆盖它；手机简易重置与重试目标至少44×44px。 |
| 详情与历史 | `.detail-section`、`.detail-section__head`、`.device-facts`、`.detail-timeline` | 复用展示结构，不复制其他模块的业务事实或状态迁移。 |
| 状态标记 | `.status-pill`、`.status-pill--warning`、`.status-pill--info`、`.status-pill--progress`、`.status-pill--success` | 状态同时有文字；颜色不是业务状态定义，映射在各模块维护。 |

桌面紧凑按钮变体不能直接用于手机主要操作。复用类名时同时核对已有 DOM 结构，避免仅套类名却缺少其子元素约定。

维修配件新交互沿用上述按钮、面板、表单、状态和选择器；`.repair-parts-*`、`.procurement-preparation` 和 `.repair-detail__toolbar` 是模块作用域样式，不形成第二套公共主题。没有新增主题 token 或通用 Button/Panel/Field 组件。

## 主题与样式扩展

- 主操作、焦点和选中态使用 `--primary-*`；背景、面板、边框和文字使用 `--bg`、`--surface`、`--surface-subtle`、`--border`、`--border-strong`、`--text`、`--text-secondary` 等现有 token。
- 状态色使用 `--success`、`--warning`、`--danger`、`--info` 及对应 `*-soft`；圆角使用 `--radius-control`、`--radius-panel`，阴影使用 `--shadow-sm`、`--shadow-md`。不在每个模块重新定义相同颜色或主题。
- 公共样式在原定义处维护；模块差异使用模块前缀或清楚的修饰类。不要新增宽泛的 `button`、`select`、`h2` 等全局覆盖，不以叠加 `!important` 或固定内联样式绕过共同规则。数据驱动的动态尺寸不属于重复主题常量。
- 后台统一两套布局：768px 及以上可收起侧栏、完整桌面表格及双栏详情；767px 及以下抽屉导航和单栏内容，维修列表采用连续紧凑行。无全局顶栏及底部导航，手机菜单放标题行。中间宽度沿用电脑结构，工具栏按内容换行，宽表格只在 `.module-table-scroll` 内滚动，不隐藏桌面列。公开首页与账号页仍沿用各自的内容排版规则。
- `.app-shell` 内的 `--app-sidebar-width` 同时控制侧栏宽度和主内容偏移，电脑展开时从 184px 弹性增长到 248px（1440px 时约 224px 内容宽），主动收起时为 72px 图标栏。折叠是用户选择，不产生第三套响应布局；手机使用 270px 抽屉。`field-grid` 宽容器最多两列，容器不足时自然换行，属于内容适配。
- 保持桌面主列表约 14px、必要辅助信息约 12px 的可读性；手机输入字号至少 16px，主要触控目标至少 44×44px。提高密度优先压缩无效空白，不牺牲关键文本、触控和焦点。
- 长值处理必须保留完整内容的可获得性，避免横向挤出页面；菜单、提示和固定工具栏不得被面板裁切或遮挡关键操作。

## 字体与可读性（2026-10-02）

全站继承 `app/globals.css` 的 `--font-sans`：系统 UI 字体优先，随后 Segoe UI Variable / Segoe UI、Roboto、Helvetica Neue / Arial、苹方、微软雅黑 UI / 微软雅黑、Noto Sans CJK SC。实际字形由操作系统、字体覆盖与浏览器选择；macOS/iOS 通常使用系统西文字体及苹方，Windows 使用系统西文字体及中文回退。不要在组件另指定一套正文字体。已移除 Source Sans 3 的根布局导入及 npm 依赖，无需下载网站正文字体。

| 场景 | 当前使用规则 |
| --- | --- |
| 公开页／账号正文 | 基础 16px / 1.5，长段落沿用页面的 1.55–1.75 行距；展示标题保持自身层级 |
| 后台正文／列表主要事实 | 基础及主列表 14px，正文 400，列表重点／按钮／页面标题 600；次要标签 500 |
| 辅助信息、状态与日期 | 后台原 8–11px 业务文字提高到 12px；仅品牌副标识和公开页的装饰性产品缩略示意保留小字 |
| 输入与交互 | 手机输入保持至少 16px，主要触控目标至少 44px；按钮行高 1.35，允许完整显示字形 |
| 页面标题 | 后台电脑 20px、手机 18px，600 字重、正常字距；不通过负字距挤压中文 |
| 文字颜色 | 主文 `#24292f`、辅助 `#57606a`、次辅助 `#656d76`，白底对比度约 14.65、6.39、5.25:1；背景 `#f6f7f9` 下约 13.67、5.96、4.89:1 |
| 渲染与打印 | 不强制非标准 font-smoothing、不加文字阴影／轮廓、不用 CSS 缩放真实表单；纸张 pt 字号与已有专用打印行距保留 |

统计口径：以本轮开始时线上版本 `8254b4f` 的 21 个 CSS 文件为样本，计 CSS 声明而非页面数或屏幕文字数。原 650 字重 22 处、750 字重 2 处、800 字重 2 处，分别收敛为 600、600、700；全局样式原有 115 处小于 12px 的字号声明，99 处后台声明提高到 12px，其余 16 处为品牌／公开页缩略示意。复用现有 `.button`、`.module-heading`、`.field`、列表和详情语义类，并在原规则处修改；新增公共 token 仅 `--font-sans`。登录／注册原固定 520+620px 列下限改为弹性列，修复 1024px 横溢。

参考 5 个官方设计体系，核验日期为 2026-10-02；以下是规范对照，不是品牌官网 CSS 实测或市场份额调查：

| 参考 | 官方字体／常用正文 | 本项目借鉴 |
| --- | --- | --- |
| [GitHub Primer](https://primer.style/product/primitives/typography/) | 当前 Mona Sans VF 优先，随后系统字体；14px/21、16px/24，正文 400、标题 600 | 语义层级与常规／半粗分工；不把当前 Primer 误称为纯系统字体 |
| [Microsoft Fluent 2](https://fluent2.microsoft.design/typography) | Web 默认 Segoe UI，Body 1 为 14px/20 Regular | 管理后台的紧凑、可读正文 |
| [Apple HIG](https://developer.apple.com/cn/design/human-interface-guidelines/typography) | 按平台与语言选择系统字体；iOS 原生 Body 17/22pt | 适应系统，不将原生 pt 数值照搬成网页 px |
| [Vercel Geist](https://vercel.com/geist/typography) | Geist Sans／Mono；Copy 14、Copy 16，独立 Label 与 Strong | 正文、标签、强调各司其职 |
| [Google Material 3](https://developer.android.com/develop/ui/compose/designsystems/material3) | Roboto，Body medium 14/20、large 16/24（原生 sp） | 常规正文与中等字重标签 |

[Microsoft 中文字体说明](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography)支持简中 UI 使用 Microsoft YaHei UI；[Apple 字体概览](https://developer.apple.com/documentation/technologyoverviews/fonts)强调系统按语言选择字体。[Mozilla font-smooth 说明](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-smooth)指出强制抗锯齿属非标准、macOS 相关行为，不是 Windows 或所有显示器的通用清晰度修复。更换字体与调色属于基于这些资料的项目设计选择；屏幕分辨率、缩放和物理显示器仍须实际观察。本轮线上 macOS Chromium 的 CSS.getPlatformFontsForNode 实测品牌英文为 `.SF NS`、中文标题为 `PingFang SC`，均 `isCustomFont: false`；Windows 回退属于配置，尚无实体 Windows 渲染证据。

## 选择器约束

普通下拉框直接使用 `SelectControl`，传入既有 `value`/`defaultValue`、`onChange`、`name`、`required`、`disabled` 与选项；保持可见关联标签，必要时提供 `aria-label`。不要另写一份原生 `select` 或菜单增强逻辑。

该组件保留原生选择行为；支持 `appearance: base-select` 时在 hydration 后增强，不支持时回退平台原生菜单。不要在页面直接插入 `button`/`selectedcontent`，也不要关闭 React 警告掩盖兼容问题。搜索候选、多选标签和直接可见的图形单选分别使用 `SearchCombobox`、`MultiChoice`、`SingleChoice`；这些是不同交互，不在页面临时复制同类控件。

## 公共组件扩展边界

- API 使用明确的 TypeScript 类型、稳定语义和少量必要变体；保留原生可访问性和事件语义，不堆叠按模块命名的布尔开关。
- 数据、业务校验、权限检查和状态迁移留在对应模块；通用控件只承载展示与交互契约。不能因为共用一个面板，就合并客户设备、待售单机或商品型号。
- 新增抽象必须有明确复用价值；只使用一次且紧贴模块流程的组件先留在模块内。没有合适控件时可在当前授权内正常新增，不为复用强行改变业务流程。
- 新公共 API、变体或 token 在本文记录真实路径和使用边界；涉及业务决策时同步对应业务规格与进度文档，执行摘要写入 `PROJECT_MEMORY.md`。

## 交付验收

- 说明本次复用、扩展或新增了哪些入口；确认没有复制同语义控件、主题常量或全局框架。
- 公共修改覆盖实际受影响使用方；UI 改动在 1440、1024、390、375 代表宽度检查相关页面和关键状态，验证换行、溢出、密度、层级与固定导航。
- 实际验证涉及的选择、输入、导航和提交行为；选择器还检查键盘移动、确认/关闭、焦点及禁用状态，使用渐进增强时检查回退路径。截图不能代替交互测试。
- 状态覆盖按根目录规则和本轮明确范围执行，不宣称未实现的 loading、error、no-access 或 conflict 已完成。
- 代码改动运行相应 lint、typecheck、业务测试与构建检查，记录真正执行的范围及剩余限制；纯文档改动核对引用和实现对应关系，不冒充重新运行应用测试。

这些是后续开发必须遵循的项目约束与验收清单；本次没有新增自动化 CI 门禁，不以声明本身保证未来改动已通过检查。

## 接机新增交互的复用约束

类别、优先级与打印纸张沿用 `SelectControl`；品牌/型号和电话候选使用 `SearchCombobox`，故障细项与随件使用 `MultiChoice`。颜色使用 `ColorPicker`，原装/组装、组装屏类型及苹果电池处理使用 `SingleChoice`；图形单选保留原生 radio 语义，不另写下拉菜单。不能在后续页面复制这些控件或镜头代码。新可编辑 SN / IMEI 字段必须用 `IdentifierField`；候选查找可用 `IdentifierScanner` 的结果呈现契约，但不能据扫描自动建立客户设备/待售单机或猜测参数。

`IntakeFaultPicker` 维护故障与配件需求的条件，规范化规则归 `lib/intake-services.ts`：取消对应故障清空规格，非 Apple 品牌清空苹果电池处理，原装屏清空组装屏技术。它们是客户请求，不能变成检测结论、报价或维修授权。`IntakeReview` 复用图形核对展示，确认页可返回对应步骤修改，本地详情不复制另一套核对结构。故障与配件候选在分类箭头附近的锚定小面板内编辑；组装屏幕技术切换为同面板子视图，保留返回与已选摘要，苹果电池请求在对应选项内维护，不撑开整页。模块样式只调整 `SingleChoice` / `MultiChoice` 的层级，不复制 radio、checkbox 或条件规则。

`IntakePhotos` 通过公共 `PhotoCapture` 拍摄，继续提供直接本地上传；解码成功后才计数，失败保留旧图，退出/移除释放 URL，待读取期间禁止进入下一步。`PhotoCapture` 的弹层样式限定在 [photo-capture.module.css](../components/photo-capture.module.css)，沿用公共 token；照片只用于当前预览，不随本地工单持久保存。

`IntakeReceipt` 留在维修模块，通过 body 下的原生 dialog portal 和限定的 print CSS 展示意大利样张的左右两栏，默认从门店设置读取纸张，并支持 A4/A5 横向、A4 上半页与 A4 双联。预览纸张旁选意／英／中，默认意大利语，系统结构值统一翻译、自由文字保留原文。二维码只包含本站实际工单地址，不含客户资料；已知报价与当前阶段／保管从共享事实读取，未知款项保留待确认。维修保修与门店资料读取冻结 policy，无 policy 的旧维修使用当前门店默认。当前签名须与接机事实及 policy 匹配，历史失配保留空签名线并提示重新签署。弹层临时切换纸张或语言不更改默认设置。`--overlay` 复用扫码和打印遮罩，其余颜色、边框、圆角沿用现有 token。

## 维修与客户闭环新增入口（2026-10-01）

- `RepairStageControl` 和 `RepairWorkflowPanel` 共用 `repair-workflow-store.ts`；列表、fixture详情、本地详情读同一目录。弹层打开时保存期望版本，阶段、保管和人工通知规则归 `lib/repair-workflow.ts`。
- `RepairPartForm`、`ProcurementActions` 和既有 `RepairProcurementDialog` 共用配件表单与追加式事件。列表供应商／配件列和详情摘要打开同一弹层，业务规则仍归采购模块。供应商候选用 `SearchCombobox`，不复制下拉控件。
- `IntakeReview.statusContent` 可传当前阶段；`relatedContent` 组合该工单进度与配件摘要，不把状态迁移塞入展示组件。
- `useCustomerDirectory` 合并同号码的维修／售出／基础资料；接机与 `RetailSaleForm` 共用 `customerCandidates` 和 `SearchCombobox`。客户设备页保留维修标识与已售单机身份的区别。
- `SettingsPage` 承载门店资料、供应商、手动收支和打印默认设置。管理入口在 `AppShell` 的账号菜单，不另搭侧栏；门店资料和打印保存各自字段，编辑表单保留打开时版本。
- `.repair-unified-list` 仅调整维修七列与手机三行卡片；`.repair-stage-*`、`.repair-part-*`、`.settings-*`、`.customer-device-*` 为模块样式。客户页与售出表单采用作用域 CSS module，共用现有 token；没有新主题、图标库或通用控件复制。

实际验收范围和本地保存限制见 [闭环框架](10-work-order-customer-loop.md) 与 [进度](04-decisions-progress.md)。

## 紧凑详情与账号菜单（2026-10-01）

- `AppShell` 账号摘要固定在侧栏底部；原生 `details` 的菜单绝对定位向上展开，侧栏收起时仍显示完整操作名称。菜单仅保留门店设置、通知、退出；供应商、经营收支、打印由门店设置内部导航承载。外部点击关闭菜单，Esc 先关闭账号菜单再关闭手机抽屉；通知关闭返回账号摘要。主导航独立滚动，菜单不推动头像或被侧栏裁切。
- `RepairWorkflowPanel` 使用 [作用域样式](../components/repairs/repair-workflow-panel.module.css)，`metadata` 组合接收时间、负责人等只读事实，`historyContent` 合并既有时间线。保管用小标记展开 `SelectControl`，保存保留打开时版本；通知条件和阶段规则仍由共享工作流维护。
- Fixture 工单详情使用 [模块样式](../components/repairs/repair-detail.module.css)：设备、故障、随件合为主卡，标识折叠；概况与客户为辅助列，报价紧凑显示。手机为单栏，阶段、标识、历史和保管触发点至少44px。
- 单机详情使用 [模块样式](../components/retail/retail-detail.module.css)：照片、品牌型号、售价与指标为摘要；颜色／分类归基本规格，外观等级归实物情况。编号、SN、包装码、IMEI 在紧凑资料格直接显示，自动编号只读，其余逐项编辑；历史默认折叠。金额、来源、位置和入库日期集中在辅助列；手机单栏。待检测三项核验只在操作区编辑，其他状态保留只读核验记录。
- 继续复用 `PageTitle`、公共按钮／面板／表单 token 与既有采购弹层，未新增 UI 框架、通用控件或主题 token。React 检查及四宽度真实交互证据见进度记录。


## 单机逐项资料编辑（2026-10-01）

- [RetailFieldButton / RetailFieldEditor](../components/retail/retail-field-editor.tsx) 为整机模块专用入口，直接显示字段值与铅笔；29字段兼容类型保留，当前28项可普通编辑，自动编号只读。可编辑字段和状态边界由 `lib/retail.ts` 的 `RetailEditableField` / `canEditRetailField` / `validateRetailFieldEdit` 定义，不抽成跨业务万能编辑器。编辑期保留原档案及版本，先核对前后值，再确认保存；取消、无变化、失败、冲突不追加历史。
- 型号、品牌等手动资料用关联标签；类别、成色、等级和容量单位复用 `SelectControl`；颜色复用 `ColorPicker`，SN / IMEI 复用 `IdentifierField` / `IdentifierScanner`。磁盘按块保存容量、单位和类型；未知规格／金额保持 `null`。没有新增主题、公共 token 或选择器实现。
- [RetailDetailView](../components/retail/retail-detail-view.tsx) 只负责紧凑分组及编辑入口，检测／销售由 `retail-detail.tsx` 组合；售价只在摘要编辑，移除操作区重复标价表单。日期为44px小行，原生 `type="date"` 字段保留 `onChange` 并用 `onInput` 同步浏览器日期输入，核对页读取当前值；操作时间保留在历史。不可直接编辑系统 ID、版本、销售／预留事实或核验历史。
- [RetailOperationConfirmation](../components/retail/retail-operation-confirmation.tsx) 在检测、上架、暂停、重新检测提交前显示操作影响；期望版本及事实规则仍在整机模块。这两种确认已在2026-10-02改为所属区块内的命名region，焦点进入编辑／核对步骤，失败保留原资料；`ColorPicker` 展开时先消费Esc，再次Esc关闭就地编辑。
- 实际验收包括1440／1024／390／375、字段与确认手机字号16px、目标至少44px、跨标签版本冲突、保存刷新和取消；范围及存储异常回归见 [进度记录](04-decisions-progress.md)。

## 整机三页统一视觉（2026-10-01）

- [retail-surface.module.css](../components/retail/retail-surface.module.css) 是模块共用样式，继承 AppShell 可用宽度并承载48px区块头和品类图标；三页继承 `PageTitle`／`AppShell`，继续用公共面板、按钮、状态、表单和token。没有新增跨业务Panel／Field或第二套主题。
- 列表的 [模块样式](../components/retail/retail-list.module.css) 替代本页旧全局retail类；状态卡不再借用维修卡片，电脑保留完整六列，手机展开筛选仍用 `SelectControl`。颜色用 `ColorSwatch`＋文字，长值提供完整 `title` 并可进档案；URL及返回记忆仍由原模块维护。
- 新建的 [模块样式](../components/retail/retail-form.module.css) 对三步作事实分区；颜色复用 `ColorPicker`，包装商品码也用 `IdentifierField`，扫描核对后才填入。未新增扫码、下拉、颜色控件或业务创建逻辑。
- 详情共用标题和字体层级，逐项编辑、状态确认、售出仍保留原行为与边界。字体保持固定CSS字号，改列宽／换行适配；手机输入16px和44px触控不缩小。映射与规划见 [整机规格](05-retail-functional-spec.md)。

## 整机分类、保修与销售打印（2026-10-01）

- 列表的“全部／新机／翻新机”分段留在 [整机列表模块样式](../components/retail/retail-list.module.css)，独立于品类和状态，触控目标至少44px；和既有搜索、其他筛选及URL同步。分类映射与旧资料兼容由整机模块维护，不新增通用选择器或改写历史文本。
- [RetailWarrantyControl](../components/retail/retail-warranty-control.tsx) 是整机模块私有控件，新建第三步和逐项保修编辑共用。普通期限选择复用 `SelectControl`，自定义月份使用关联标签和原生输入，范围校验留在 `lib/retail.ts`；[作用域样式](../components/retail/retail-warranty-control.module.css) 沿用公共表单与token，不复制下拉逻辑。
- [RetailWarrantyPanel / RetailSaleWarranty](../components/retail/retail-warranty.tsx) 分别展示单机当前设置与销售冻结快照；[RetailWarrantyTerms](../components/retail/retail-warranty-terms.tsx) 共用条款展开区，条款文本来自 `lib/retail-warranty-terms.ts`。保修、交付、版本及已售／预留锁定规则仍归整机模块，[保修模块样式](../components/retail/retail-warranty.module.css) 只承载布局与反馈。交付日期也保留原生 `type="date"`、`onChange` 与 `onInput`，先核对再确认，不把交付写成普通资料编辑。
- [RetailReceipt](../components/retail/retail-receipt.tsx) 留在整机模块，复用 `IntakeReceipt` 已有的 body 原生 `dialog` portal、焦点／Esc和 `.intake-receipt-*` 打印样式。纸张与语言用 `SelectControl`，纸张读取门店默认值，支持A4／A5横向、A4上半页和双联；临时切换不改默认设置。打印只组装原销售与保修事实、所选三语条款及纸面签名空白区，默认意大利语，不印内部成本；明确为本地非税务单据，不替代收据或发票。
- 商家期限、担保门店和条款版本取销售快照，交付日起算到期日；缺少旧销售条款或交付日期时显示未知，不能用当前设置补作历史承诺。业务边界及官方来源见 [整机规格](05-retail-functional-spec.md)，实际应用验证由 [进度记录](04-decisions-progress.md) 记录，本文不声明新增功能已实测通过。

## 分类前置、规格与宫格色板（2026-10-01）

- [RetailCatalogControl / RetailRamControl / RetailStorageControl](../components/retail/retail-spec-controls.tsx) 将目录搜索和容量预设封装为整机私有组合，不重写SearchCombobox或SelectControl。电脑移动／桌面候选与游戏机品牌过滤由lib/retail-catalog.ts维护，实际字段仍由lib/retail.ts校验；既有及手填值可继续保存，容量对象按选项复制，不共享可变数据。
- 新建按ready门控后首次初始化草稿；品类相关RAM／容量控件用独立key重置，仅处理未保存草稿。编号领域生成，RetailFieldButton的code为只读div，兼容旧数据而无铅笔。
- 电池图形概览复用RetailFieldButton，移除实物区重复值；保修直接复用RetailWarrantyControl，其disabled反映权限／状态／存储。RetailWarrantyPanel只维护未保存期限草稿，核对候选交回RetailFieldEditor.initialCandidate，保存仍走原版本及单字段写边界。取消自定义同步重置控件key，不保留旧输入。
- ColorPicker稳定公共扩展为常规5列／钛金属4列与其他独立行；色板固定定位按触发点及视口计算，低屏内部滚动。radio／文字／44px目标保留，resize、scroll和外部pointer监听仅展开时安装并清理；Esc只在展开时消费，不越级关闭父dialog。主题沿用原token，动态位置不是第二套主题。
- 实际新建／复制／核对保存／刷新、四宽度、手机容量和CPU弹层、接机色板复用／键盘／自定义／嵌套Esc及权限代表流程已验收，详见[执行记录](12-retail-specifications-execution-plan.md)。没有新增公共token、UI框架或图标库。

## 单机售卖、照片与员工权限（2026-10-01）

- `RetailGallery` 属于一机一档模块，复用 `PhotoCapture`，本台照片上传压缩后经核对保存（最多6张、单张约250KiB），未知显示 `UnitIcon`，不以型号图片冒充实物。模块内复用按钮、原生文件选择及token；拍照实现继续共用公共镜头组件。
- `RetailSaleCard`／`RetailReservation`／内部 `TransactionForm` 组合销售、分次款项、交付、退款和售后；普通选择用 `SelectControl`，客户候选用 `SearchCombobox`，二次核对已在2026-10-02改为原销售、原款项或原售后卡片内展开。款项、权限、日期、幂等、版本及售后来源属于lib/retail.ts和写边界，不放入公共控件。销售冻结商品／买家／成本／保修，打印读取该销售，未知旧快照不倒填。历史销售默认收起，手机当前操作前置。
- `StaffSettings`／`useStaff`／`AccessPanel` 留在员工权限模块；设置员工分类复用现有门店导航，预览身份放账号菜单，没有真实登录密码／邀请。读默认拒绝、角色模板及能力域见lib/staff.ts；原始本地数据不是服务端安全边界。身份／成员版本变化卸载业务确认输入，写边界仍重新鉴权。
- `RetailDetailView` 延续retail-surface与公共token，在详情作用域强调紫色区块图标、颜色文字＋色块、图形电量／核验指标和获授权毛利。没有新主题、图标库、UI框架或万能编辑器。普通身份看来源日期，不接收成本字段／敏感历史；只读与预留已售按能力／状态禁用铅笔。
- `RepairStageControl`／`RepairWorkflowPanel`／采购表单沿已有组件收口维修写能力；无权保留事实、详情和历史，隐藏写入口；直达新建显示AccessPanel。售后关联维修通过专用来源核验桥接，不授权销售身份任意新建维修。

实际132项测试、浏览器流程和四宽度证据见docs/04、11与retail-sales-staff-20261001。手机主要按钮及输入已定向补验；原生增强选择器内部展示按钮不作为独立触控目标，外层SelectControl保持44px。

## 适配输入与就地编辑（2026-10-02）

- `RetailMoneyControl`、`RetailNumberControl`、`RetailDateControl`在整机模块内复用，分别承载€单位／十进制反馈、电池SVG与整数加减／滑轨、图标日期与可选清空。校验与写入仍由lib/retail.ts负责，原文解析辅助在lib/retail-input.ts，不把权限或状态规则塞进控件。没有合适的公共电池／计数／货币控件，因此新增整机私有组合；选择仍共用SelectControl，图形单选共用SingleChoice。
- `RetailDisksControl`共用于新建和逐项更正，逐块卡片拥有稳定草稿key，类型用SelectControl、容量用RetailStorageControl；删除前盘保留后盘自定义输入，未知容量保留单位。SelectControl内部渐进增强button不被磁盘删除按钮的44px样式覆盖。RAM和保修的自定义共用整数控件，手机文本输入16px、主要操作至少44px。
- `RetailFieldEditor`不再portal/dialog，而由RetailDetailView放到所属区块；RetailEditScope禁用其他普通编辑入口，提示先保存或取消。打开原版本和核对候选保持冻结；输入／核对切换管理焦点，Esc尊重搜索／色板先处理。更正备注默认折叠，保修核对取消重置到已保存期限。自动编号仍只读。
- `RetailSaleForm`和交易表单为卡片内命名region，操作入口Ref负责取消后的焦点恢复；检测核对也用显式入口Ref，原草稿隐藏而保留DOM。确认第二步、冲突、失败反馈和保存鉴权沿用原实现；付款方式和保管无默认事实。照片放大改为原位展开，移除核对显示具体缩略图。
- 公共SearchCombobox透传原有required到真实输入及aria-required；IdentifierScanner的IMEI手填使用numeric键盘，其余原文使用text。硬件、识码核对和打印仍用既有专用弹层，未新增UI框架、主题或图标库。

本轮实际验收范围与限制见[计划和验收](13-retail-input-audit-plan.md)，当前实现优先于上文较早的弹层描述。


## 接机小选项、三语打印与签名（2026-10-02）

- `IntakeFaultPicker`继续复用SingleChoice／MultiChoice，模块内非模态固定定位portal锚定分类箭头；一次一个、外点／焦点离开／Escape关闭，子技术视图先返回再关闭。动态位置和滚动避让属于维修专用交互，未新增通用选择器、主题或UI框架。
- `IntakeSignatureEditor`／`IntakeSignatureSection`是维修专用就地区域，SVG笔画支持手指事件和键盘、撤销／清除；SignatureImage复用于草稿、详情、历史与打印。首笔冻结比例，随后CTM取点并等比显示；数据、快照、权限及写版本归维修领域与store。
- 普通语言、纸张、默认保修仍用SelectControl；两种WarrantyDefault在设置内，语言只在预览。打印文案由lib/print-language.ts统一，维修条款在repair-print-terms.ts，零金额／未知事实与原文分开。两个打印模块纸张SelectControl按language重建以更新增强显示，其他公共组件未改。
- CSS复用公共token、button、panel、field；维修popover与签名使用module CSS，公共button用:global作用域正确限定。手机主要目标44px、输入16px，不以缩小字号压密度。实际范围见[计划14](14-repair-intake-print-signature-plan.md)。


## 正式后台数据门控（2026-10-02）

BackendProvider接收服务端已投影快照，在配置完成前不渲染业务子页面，定时/聚焦重新查询，账号或成员版本变化由既有AppShell身份范围卸载草稿。它只协调数据生命周期，不承载业务权限/校验/写入规则，不新增主题或通用表单控件。正式页面继续复用PageTitle、AppShell、SelectControl与现有表单/列表语义样式。接机沿用IntakePhotos/PhotoCapture界面，扩展为压缩附件与私有照片引用；后台模式持久读取，M1预览仍明确照片不持久。详细范围及验证见[正式接入记录](18-formal-backend-and-cutover.md)。

## 2026-10-02 选项交互兼容修复

- SearchCombobox 的候选使用原生 button/option、click 显式确认；mousedown 保持输入焦点，不取消 pointerdown/touch 滚动，也不在按下阶段提交。iOS 的取消 pointerdown 仍可丢失焦点问题见 https://bugs.webkit.org/show_bug.cgi?id=322721 。外点、离开焦点与 Escape 关闭，已聚焦输入再次点击可展开；确认先恢复焦点、最后关闭，避免可访问技术激活候选后重开。IME composition/229 期间不截获确认或方向键。
- SingleChoice 的 onChange 仍只表示值变化；可选 onRepeatSelect 表示用户再次确认当前值。仅颜色面板与组装技术子视图使用该能力完成/返回；重复自定义颜色只关闭，不清文字。原生 radio 键盘和 MultiChoice 取消语义保留。
- 整机切商品类型以类别 key 重建 ColorPicker，与 RAM/容量的类别重置契约一致；清空颜色时不保留旧自定义模式。
- 浏览器回归入口 npm run test:controls（先 npx playwright install chromium webkit），用本地虚构预览，覆盖 Chromium、WebKit 触控模拟及 1440/1024/390/375；CI 必跑，失败留 trace 和截图。失焦顺序由测试显式注入复现，不等同实体 iPhone/搜狗键盘验收。

## 2026-10-02 整机页面宽度修复

retail-surface.module.css 的 page 不再额外限定1200px，整机列表、详情、新建和复制表单统一继承 AppShell 的可用宽度（当前上限1540px）；保持列表列布局与手机单栏，不在整机模块另造宽度 token 或改变全局宽度。24 浏览器布局检查覆盖1920/2560/1440/1024/390/375，以维修页为对照，未出现整体横溢，1024宽表仍仅在面板内滚动。证据.local/ui-proof/retail-width-20261002/verification.json；正式构建通过。

## SeaTable 状态分组（2026-10-02）

维修列表默认按共享 workflowGroups／workflowGroup 展示，复用 SelectControl、既有分组折叠和表格样式。RepairStageControl 增加可选 onSaved 回调，仅在保存成功后让列表展开目标组并恢复焦点；三语标签、阶段校验和业务映射留在领域层。无新公共主题或控件。新增6项桌面／WebKit交互回归及四宽度通过，详见 docs/10。


2026-10-02：维修模块新增 RepairGroupEditor（components/repairs/repair-group-editor.tsx），复用原生dialog/repair-parts-dialog、field、icon-button及主题token，模块CSS实现手柄触控拖动/插入提示，键盘及上下按钮等效排序。它管理固定业务分组，故保留模块边界；共用StoreSettings与权限，不新增通用选择器。

## 公开首页与账号组件（2026-10-02）

- `components/home/product-preview.tsx`：首页和账号侧栏共用的静态产品图形；演示数字明确标注，不读取门店API；样式在 `product-preview.module.css`。
- `WorkflowTour`：首页维修/采购/整机流程的原生按钮切换，`aria-pressed`/live region反馈，无自动轮播；模块样式 `home.module.css`。
- `TutorialLibrary`：首页 `#tutorials` 的单播放器与分集列表，静态目录来自 `lib/tutorials.ts`；复用原生视频控制、按钮语义类、既有 token 与 Lucide，样式限于 `tutorial-library.module.css`。`preload="none"` 且仅在用户播放／点击时间点时挂入媒体源；选集与卸载停止旧视频，不自动续播；稳定ref清理在microtask确认元素未重新绑定后释放，避免Strict开发回放误停首次播放。中文字幕轨、加载／失败重试、可定位文字步骤与实际功能链接属于首页教学，无门店 API 或业务数据。新增原因是原流程图无媒体播放语义；验收覆盖四宽度、键盘、触控、惰性请求、选集停止与失败恢复，实际结果由当前任务交付记录。
- `AuthFrame`：登录/注册/恢复/邮箱验证/待授权页面共用品牌、内容容器和电脑产品侧栏，手机单栏；复用Brand和既有auth-form/input-shell/button语义类，作用域CSS在 `auth-experience.module.css`，不改后台公共主题。
- `GoogleSignIn`：登录和注册共用真实POST入口、busy/失败反馈。`VerificationSent`负责注册确认/重发，`VerifyEmailForm`负责独立重发入口，`PasswordRecoveryForm`负责请求与有效重置状态。权限继续由服务端处理，控件不授予成员身份。
- 沿用既有颜色/边框/阴影token、Lucide图标和按钮语义。仅Google品牌标志使用其标准四彩色；未增加UI框架或图标库。44px主要操作、16px移动输入、键盘与减少动画均有检查。旧公共营销CSS保持以免干扰其他并行任务，当前公开页面使用上述模块样式。


## 设备草稿与提交恢复（2026-10-02）

`useDeviceDraft` / `DeviceDraftNotice` 是已接正式后台表单的公共恢复入口。每个编辑器独立 ID，门店＋成员＋当前权限集合隔离；草稿保存与业务命令分开。恢复必须由人点击，恢复输入及原业务版本，不恢复确认勾选，不自动执行销售、收款或权限变化。新建身份随草稿持久保存。异步草稿写入及清理共用队列，晚到结果不能覆盖最新输入；失败显示明确状态，不清除旧资料。草稿列表复用 `SelectControl`，按钮／错误／面板沿用既有语义类和 token。

`BackendSyncNotice` 放在 AppShell 内容区，避免桌面固定侧栏遮挡。显示“核对提交结果／重试原提交／撤销未完成提交”；后台权威回执确认后才清除持久意图。共用网络层限时20秒、设备存储打开／事务分别限时4秒，解除等待不代表业务失败。照片草稿保存字节并重新建立预览，不存仅本页有效的 blob URL。签名笔画有独立草稿，恢复仍须核对条款；确认签名不替代工单提交。

当前接入：接机、签名、配件新建／编辑、客户编辑、整机新建／字段更正／售卖／交易、门店设置、供应商、手工收支、成员编辑。其他短操作共享持久命令保护；未接入的输入控件不能宣称有设备草稿。新增编辑流程按[文档19](19-sync-failure-scenarios.md)补录入、失败、恢复、版本冲突和权限变化验收。


## 历史整机（2026-10-02）

历史整机列表/只读详情/客户历史区复用 AppShell、PageTitle、SelectControl、既有 button/panel/module-search/table-scroll 语义及主题 token。来源行缺少检测与冻结销售事实，因此组件留在 retail-history 模块，不混用普通单机编辑/收款控件。模块 CSS 只维护历史表格、50条分页、来源入口和事实展示；桌面搜索14px、手机16px，主要触控44px。列表/详情/客户页1440/1024/390/375无整体横溢；真实交互与生产字段核验见docs/21。


## 分组拖动实时动效（2026-10-02）

维修分组管理沿用现有模块、手柄和语义样式，拖动时整行跟随鼠标／触摸坐标，其他行平滑让位，目标位置显示占位框；松手归位后仍需保存才对全店生效。列表边缘持续自动滚动；Escape、取消指针、失焦／尺寸变化可恢复草稿原顺序。方向键和上下按钮继续可用；减少动态效果偏好保留即时位置反馈，取消平滑动画。只改变客户端呈现，settings.edit、服务端权限／版本和两套分组保存边界不变。

验证及发布记录见PROJECT_MEMORY；独立候选.local/group-motion-candidate只叠加编辑器、模块CSS及浏览器测试三文件，保护其他未发布工作。


在售优先改版：整机列表复用已有classification/classificationActive三段分类、SelectControl及retail-history表格/分页，不新增通用控件。主入口按在售/已售历史/其他状态区分，单机管理保留原识码与操作；详情返回保留来源区与筛选。手机三个状态入口同排、分类44px、搜索16px；四宽度与分类交互证据见docs/21。

## 2026-10-03 账号绑定组件

`SocialSignIn`/`ProviderMark` 统一登录、注册和账号设置的 Google/Apple 标识与入口，替代原 Google 单独按钮。`AccountSettings` 为账号专属模块，复用 Brand、PageTitle、SelectControl、button/panel/field/status token；不加载 AppShell/门店业务快照。电脑主辅两栏、手机单栏，四宽度与交互证据见[账号绑定](23-account-linking.md)。没有新框架、图标库或主题token。


### 2026-10-03 维修采购与联系复用

RepairRequirementsPanel、SupplierBatchDialog 和 RepairContactControl 归维修／采购模块；列表和详情共享同一联系控件、现有 dialog、SearchCombobox、SelectControl、button／field／panel 语义及原颜色／圆角 token。新增样式限定维修项目、批量清单和联系区；手机工具栏允许换行，展开行联系操作占完整行，触控目标保留44px。未新增公共主题、UI框架或通用业务按钮。

2026-10-03：用户要求恢复已上线main，未上线性能分支的 BackendPage、分页查询、最小回执和菜单SSR改动已从本地移除。当前复用入口以main源码为准，不把原分支组件当作已有公共能力。

### 2026-10-03 选件与报价简化

RepairPartForm复用SearchCombobox及既有field-grid／button语义，只保留维修项、供应商、报价和获权进价；RepairRequirementsPanel仅作已有项目快捷切换。RepairPartReconfirmation属于采购异常处理，仅要求变化或旧登记未完成时显示，不加入正常流程。IntakeReview和IntakeReceipt共享itemQuotes，报价逻辑归lib/repair-item-pricing.ts；未新增公共主题、控件或CSS。新建工单的项目报价位于原故障选择下方，取消项目同时去掉对应草稿报价，详情与三语打印保留同源金额及规格。详见计划22最新段。

2026-10-03 当前供应商／金额窗口：模块专用 `RepairItemsForm` 复用 `SearchCombobox`、`.field`、按钮、status-pill与语义token；新增 `.repair-item-card` 仅作用于维修项目卡片。取消重复项目选择，电脑横排、手机供应商整行＋金额双列，保存时禁止关闭；成本权限与原子写入归领域及服务端。具体业务规则见docs22当前方案。

2026-10-03 列表可点击性：供应商／配件列复用 `.button.button--secondary`，模块 `.repair-row-parts` 只布局图标、供应商／配件两行和箭头；不靠hover才能识别入口。手机继续使用已有44px配件按钮。到货／修好组内联系筛选移除，单条联系控件保留。


## 输入框状态与维护声明（2026-10-04，后续功能必须遵守）

参考用户提供的[输入框四种状态](https://xhslink.cn/o/7eKthPIVwfX)，项目统一采用以下语义；颜色、字号与密度继续遵循本项目 token。

| 状态 | 统一行为 |
| --- | --- |
| 默认 | 保留真实字段标签；placeholder 给具体示例或说明未知可留空，不替代标签。必填使用原生 `required`，选填明确标识。初次进入不铺满错误。 |
| 聚焦 | 紫色边框、可见焦点环与光标；边框不改变尺寸，键盘、触控及输入法确认可用。 |
| 错误 | 原输入保留，字段下说明原因及修改方法，`aria-invalid` 与 `aria-describedby` 关联；提交／下一步校验并定位第一个错误。已有错误随修正更新，程序填值也重新核对；不以浏览器气泡或仅页顶总错误代替字段反馈。 |
| 已填 | 完整显示当前值；安全可清空的字段提供有名称的 X 按钮，清空调用原字段更新入口并返回输入焦点。已填不代表保存、核验或业务成功，不添加伪成功标记。 |
| 禁用／提交中 | 原生 `disabled` 或整段 `fieldset disabled` 锁住待提交草稿及显隐、候选、扫码、取消和重复提交；只读字段可按用途保留复制能力。失败解除锁定并保留草稿、原业务请求及重试边界。 |
| 只读 | 使用 `readOnly`，文字仍可读取、聚焦、选择和复制；不提供清空、选择或扫码修改入口。只读展示与无权限反馈不得混淆。 |

普通输入复用 `InputControl`；多行输入复用 `TextareaControl`；候选、下拉及识码分别复用 `SearchCombobox`、`SelectControl`、`IdentifierField`／`IdentifierScanner`。金额、规格、日期继续用所属模块的私有控件，它们内部复用公共输入。checkbox、radio、range、file、hidden、color 保持专用原生语义。

- 字段错误使用 `error`，辅助信息使用 `hint`；原生 pattern 需要具体的 `validationMessage`。`validate(value)` 仅调用所属领域的既有校验，公共 `control-feedback` 只呈现结果，不定义价格、数量、身份、权限或写入规则。已有私有反馈须关联同一字段，避免重复朗读。
- 标签应稳定且独立于错误文案。未知留空与实测 0 分开；金额不静默取整，日期、数量、IMEI 等范围沿用领域规则，不能以统一外观新增限制。搜索无匹配是结果状态，不是格式错误。
- `onClear` 必须调用与输入变更相同的入口：客户关联信息、依赖型号、报价和查询结果按原规则清理。密码不加清空按钮；多行长文本、金额、日期及规格使用各自明确的清空／“未记录”操作，不一刀切清空。清空不自动提交，不创建业务记录。
- 失焦或尝试继续时显示适用错误；清空、密码显隐和候选按钮的点击不得因新增错误行移动目标而丢失。网络、权限和版本冲突仍使用操作级反馈；业务写成功后才显示成功，前端反馈不代替服务端检查。
- 服务端预渲染的可编辑表单须在 React 接管事件前锁住输入与提交入口；账号表单复用 `control-feedback` 的 `useFormReady`，不能让首次输入在初始化时被空草稿覆盖。依赖业务数据的表单沿现有加载锁定。初始化完成后再启用控件，测试覆盖脚本延迟、第一笔输入保留与字段错误反馈。
- 未打开的扫码弹窗输入必须禁用，避免隐藏必填／旧错误挡住父表单；打开、关闭、Esc 和忙碌状态须一起核对。识别后仍先核对再填入，不自动创建或猜测设备。
- 样式集中在 `app/globals.css` 的 `.input-control`、`.control-feedback`、`.select-control`，沿用 `--primary-600`、`--danger`、文字／边框 token；错误文字使用 `--danger-text`（提取既有 form-error 深红色，保证小字号对比度），边框仍用 `--danger`。模块差异限定在自身作用域，不另建主题或引入 UI 框架。手机输入至少 16px，清空和主要操作至少 44×44px。

自动维护约束：`eslint.config.mjs` 禁止业务页面直接新增文本类原生 input、textarea、select；仅公共实现和专用类型例外。新增输入必须选择以上入口，并按影响运行 `npm run lint`、`npm run typecheck`、业务测试和 `npm run test:controls`。`tests/browser/input-states.spec.ts` 覆盖四态、点击／键盘清空、原请求锁定与失败重试、条件必填、数量／金额／未知与零、隐藏扫码和四个宽度；既有交互回归继续保留。具体本轮证据与未验证范围见 docs/04 和 PROJECT_MEMORY，不能以本声明代替验收。

## 2026-10-06 商品流程扩展

新建沿用公共输入／规格／识码／选择／保修控件与CSS语义token，宽屏三组并排、中宽两列、手机单列；仅新建手机标题取消吸顶，仍16px输入和44px目标。Gallery新增显式onDraftChange/onBusyChange用于未建档照片，原档案照片确认不变。Checkout复用sale样式和公共输入，选填客户与付款备注展开；普通检测与收款备注选填。业务权限、金额、状态留在retail-workflow及后台，公共控件不承担业务判断。详见docs/30。

## 2026-10-07 登录会话发布

本次登录勾选、活动追踪、个人/员工设备复用既有控件、三语和权限边界；用途/nonce隔离、原会话政策继承、账号+会话清草稿/确认、两个身份header、Cookie退出清理与窄范围幂等竞争处理共用正式后端。迁移先兼容、验证应用后严格启用，保留共享Auth及已提交业务；完整产品/迁移/当前验收见[登录设备29](29-login-session-devices.md)。

## 2026-10-07 公开账号入口与会话状态

公开首页和工具箱复用PublicHeader、Brand、LanguageSwitcher、LogoutButton及button/icon-button；AccountActions统一导航、首屏、底部行动与页脚。AuthStatusProvider读取最小服务端状态，所有门店写入仍在原领域边界。手机账号操作同排、44px，工具箱图标保留完整可访问名；ResizeObserver只测量公共栏高度，用局部--public-header-offset处理公开锚点，长译文不靠缩字或遮挡。AuthStatusUnavailable复用AuthFrame内表单语义。验证及限制见docs29与PROJECT_MEMORY。


## 2026-10-08 公开页具名账号菜单

`components/home/account-menu.tsx` 复用原生 details/summary、既有 profile-menu__avatar、button/icon-button、LogoutButton、角色词条和语义 token；模块 CSS 负责公开导航锚定、44px 触控、完整资料换行及受限视口滚动。导航按账号名称／工作台／退出显示；名称过长只截断触发器，展开仍完整显示。点击外部、焦点移出及 Escape 关闭；身份或状态变化重建菜单。复用个人账号设置，登录设备链接定位其异步挂载面板；不复制设置表单或扩门店权限。中／意／英及四宽度已覆盖，详见 docs29 本轮证据。
