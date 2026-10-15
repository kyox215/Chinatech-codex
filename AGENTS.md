# ChinaTech 项目维护要求

先读取 PROJECT_MEMORY.md，再按受影响流程读取 docs/06-ui-components-and-styles.md、docs/16-change-consistency-contract.md 和 docs/28-i18n-maintenance.md。

## Figma 设计守则（2026-10-15，后续设计与维护强制）

每次新增、改版或维护 UI，必须先读取 PROJECT_MEMORY.md、本文件、docs/06-ui-components-and-styles.md 的“Figma 当前基线”，再定位实际组件、使用方和已有用户决定。先写明本轮规划、组件复用与验收范围，再开始设计和修改；不得跳过守则直接另造样式。

- 视觉来源固定为 Figma nhZ37YLOUVP8zpDBBGihhS / 12373:155040。按具体子节点读取高保真上下文和截图，不能直接用整节的稀疏元数据实施；来源、组件映射和适用差异见 docs/36-ui-design-audit-20261015.md。
- 先复用现有控件与语义 token；基础视觉改变在唯一公共入口维护，不复制主题、控件或模板页面。Figma 只提供视觉，不重建模板的时间跟踪业务；已确认的独立品牌/型号、紧凑密度、手机分组折叠、无全局顶栏/底部主导航、B方案真实操作反馈继续有效。
- 条件显示、断点、焦点和选中状态必须独立于 CSS 导入顺序。模块显示规则使用明确作用域，公共默认样式避免抢占模块定位/可见性；禁止依赖同权顺序或堆叠 !important。
- 桌面和手机都验收真实折叠、键盘/触控、编辑/取消/保存恢复和适用失败状态。手机主要操作至少44×44px、输入至少16px；三语、可访问名称与减少动画保持。
- 发布前除既有检查，还要验证正式编译 CSS，不能用开发预览截图代替。仅报告实际运行证据；Figma无法访问或某状态无设计参考时如实写边界，不编造“完全一致”。更新组件规范、决策和 PROJECT_MEMORY，生产数据/权限/金额/签名规则不随样式改动。

## 工单详情维护补充（2026-10-15）

- 维修/供应商/照片/历史共用领域事实；按requirementId/revision定位采购，报价沿canonical item键，同名歧义不得猜写，缺报价与零金额分开。
- 新采购不得恢复cart操作；旧账本/原回执保留兼容，旧列表视图规范为待采购。联系采用选择式记录，实际交还/未结清事实门控不省略。
- 照片专用命令维护当前引用和私有原件，版本/权限/原请求恢复不省略；切分组草稿保留、真实保存细线持续，隐藏局部恢复交全局接管。列表弹窗owner跨移组保持，焦点ID按实例唯一。
- 新扩展同时核对详情、列表、客户关联、报价/采购/到货/历史/签名/打印及三语教程，按docs37与docs16验收。

## B方案操作反馈（新增、维护与扩展强制）

- 后续所有新增组件、页面、维护及扩展统一采用B方案：保留当前内容，在点击位置反馈，并在内容区域顶部显示2px紫色不定进度细线；复用共享反馈组件，禁止整页灰色骨架和用加载文案替换业务标题。
- 每项交互验收适用的默认、执行中、成功、失败/重试、空态、离线、无权限、冲突及结果待核对；不适用说明原因。同步操作即时反馈，只有真实异步过程显示等待，不造百分比或成功，不重复画加载圈。
- 同范围刷新保留内容、失败保留输入；身份/门店/权限变化立即隔离私有资料，旧响应不得回填。保存和恢复继续绑定原requestId，未知结果不能自动重新提交。
- 详细组件接口、首访/刷新规则及验收见docs/06，联动闭环见docs/16。三语、键盘/触控、减少动画及实际浏览器证据属于后续改动完成条件，不能只写声明或复用旧截图。

## 三语与关联闭环（后续改动强制）

- 任何新增或修改的用户可见内容必须同步中文、意大利语、英语，包括页面、字段、选项、状态、校验、错误、加载／空态、动态系统消息、标题、可访问名称及适用的打印和教程；不能只检查直接t调用。
- 译文只用于显示。客户自由原文、品牌型号／编号、自定义内容与未知历史保持原文；不得回写canonical选项、权限、金额／数量、签名、政策或销售快照。预设选项显示标签与保存值分开。
- 同一事实按docs/16同时核对新建、编辑、校验、保存、刷新、列表、详情、客户关联、历史及适用的签名／打印／教程；不把单页成功当闭环，不对无关业务机械扩展。
- 发布前通过check:i18n、类型／lint／相关业务和浏览器验证。三语缺漏、词条冲突、变量失配、排版遮挡不得用宽泛忽略中文、缩小字号、隐藏事实或放宽断言掩盖。正式与预览分支分别验收。
- 不适用项说明具体原因；未验证范围如实记录，不能只写规则便声称完成运行时闭环。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
