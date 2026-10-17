# 组件与组合索引

接机单三语疏朗版复用`lib/repair-receipt-template.ts`／`repair-print-layout.ts`／`print-language.ts`和服务端渲染器。客户／设备／交接仍读领域投影，稳定key定位标签和值；预览与操作沿`IntakeReceipt`／`ReceiptPdfPreview`及原B反馈，不复制公共控件。设计参考、布局边界及实际验证见[本轮记录](previews/receipt-spacing-20261017.md)。

| 组件类别 | 唯一实现 / 复用入口 | 设计来源与状态 |
| --- | --- | --- |
| 品牌 | `components/brand.tsx` | 现有 ChinaTech 品牌与语义 token；导航反馈复用图标槽 |
| 按钮 / 图标按钮 | `app/globals.css` `.button` / `.icon-button` | Figma `12327:116159` / `12327:116158`；44px 手机适配；默认/按下/焦点/禁用/等待 |
| 导航 | `components/navigation-link.tsx` | 原按钮及侧栏 `12327:116271`；最新真实导航实例控制单圈及内容细线 |
| 文本 / 多行输入 | `components/input-control.tsx` 的 `InputControl` / `TextareaControl` | 原 Card `12373:157599`；默认/聚焦/错误/填写/只读/禁用/提交 |
| 选择 / 搜索候选 | `select-control.tsx` / `search-combobox.tsx` | 原搜索 `12327:116166`；加载/无结果/失败/键盘/手填 |
| 多选 / 单选 | `multi-choice.tsx` / `single-choice.tsx` | 现有 token 与组件；选择是同步反馈，不造异步等待 |
| 设备目录 / 识码 | `catalog/device-catalog-control.tsx` / `identifier-field.tsx` | 复用候选和公共输入；不推断设备事实；原目录用户决定保留 |
| 面板 / 表单 / 弹窗 | `app/globals.css` 既有语义类与原生 dialog | 原 Card `12373:157599`；焦点恢复/取消/保存/错误/冲突 |
| 表头 / 列表 / 追加 | 领域列表、`components/list-pagination.tsx` | 原 `12327:116172` / `116173` / `116270`；[触底追加候选](previews/infinite-lists-20261017.md)维护原按钮与容器；旧结果保留及计数同步 |
| 标题 / 侧栏 | `components/page-title.tsx` / `dashboard/app-shell.tsx` | 原侧栏 `12327:116271`；手机标题排菜单/返回/操作44px；单个操作及`module-heading__actions--icons`纯图标组同排，长状态在标题内换行，多文字操作保留独立工具栏；隐藏文字必须排除导航图标槽及可访问消息；不增加全局顶栏 |
| 分组 / 页内 Tab | `repairs/repair-detail-workspace.tsx` 及领域分组 | 原 Tab `12327:116162`；同记录切换保留草稿，不制造导航等待 |
| 读取 / 错误 / 权限 | `components/page-recovery.tsx` 与共享读取状态 | 真实标题框架保留；首次局部等待、失败就地重试、无权限隔离 |
| 保存 / 恢复 | `components/use-operation-receipt.tsx` | 原 requestId/版本/回执；失败留输入、未知需核对、禁止假成功 |
| 恢复呈现辅助（2026-10-16候选） | `components/recovery-visibility.ts`，由 `RecoveryPresentationProvider` 唯一使用 | 技术辅助入口；按真实呈现条件分配局部/全局恢复入口，保留原草稿与回执；不新增设计控件或Figma变体。详docs/06候选规范，正式交互/发布状态另验 |
| 照片 / 查看 | `repairs/intake-photos.tsx` / `repairs/repair-photo-registry.tsx`（含 PhotoViewer） | 现有真实读图、失败重试；专用登记和不可变历史；占位不代替照片 |
| 成功通知 / 下载提示 | 统一 Toast（本轮新增） | 本轮原 Figma 中补齐；1.8秒/点击关闭；下载只表示已发起 |
| 公开首页 | `components/home/` | 保留现有营销布局、品牌、教程；公共控件遵循同一组件目录 |
| 工具箱 | `components/toolbox/` | 保留当前已发布工具状态、下载/媒体/许可；不恢复已退休资产 |
| 工作台 / 详情 | `components/dashboard/` 及领域组件 | 现有桌面/手机两套结构；工单设计详 `docs/37-repair-detail-redesign-plan.md` |

此表为项目全部现有组件类别的复用索引，不声称每页每状态与 Figma 逐像素相同。自定义业务组合由对应模块所有；新设计必须补齐具体 Figma 节点与代码入口后登记。

2026-10-17性能候选新增非视觉辅助：`WindowedListRows`管理已授权摘要的测量/窗口/焦点，`BackendPageFrame`/`BackendPageData`提供按页SSR资料；实际列表、输入、导航与反馈继续使用本表唯一组件，不新增主题或Figma变体。接口与实际客户验收范围见docs/06“性能候选的实际客户读取与渲染”；其他模块的兼容读取仍明确保留，未发布。

采购候选继续复用本表原列表/按钮/输入/候选/弹窗语言：唯一模块内`ProcurementListBody`与`SupplierBatchView`分别接旧事实和有界API，不维护第二套模板。`WindowedListRows.scrollRoot/anchorSelector`只控制滚动/定位，`SearchCombobox.loadingLabel`保留原目录默认。共同横向视口、真实groupFirst、低频候选与实际检查范围见docs/06“性能候选的采购摘要与批量读取”；正式baseline保持原绑定，未部署。

2026-10-17 多门店发布候选：新增 [MyStores / JoinStore / StoreManagement](previews/multistore-pilot-20261017.md)，原 Figma 15181:209494；复用 AccountBrand、AppShell、InputControl、SelectControl、MultiChoice、NavigationLink 与 B 反馈。发布源从正式 main 独立整合，仅纳本轮多店与容量，保留正式分页和 PDF 模板；本地 Supabase 生产构建、双引擎三语四宽与真实邀请审批均通过，发布状态以最终控制面绑定为准。

2026-10-17 多门店与正式打印组合验收：`repairReceiptHtml` 的空项目／未报价合计复用既有 `text-amounts` 变体，不新增样式或控件；三语真实PDF、零值／正常金额27mm及超容量拒绝见 [本轮记录](previews/multistore-pilot-20261017.md)。

未发布性能候选兼容维护：`RepairListBody.partsChips` 只恢复已授权 legacy 全文的可访问描述，正式 DTO 仍有界；`RepairIntakeForm` 同步候选与正式异步读取各沿原更新入口，`RetailScannerResults` 只为真实空结果补原生状态语义。无新增组件/主题/token/Figma视觉变体，实际回归范围见docs/06“未发布性能候选的兼容列表回归”。

客户设备未发布性能候选：原设备卡片／details／记录行继续唯一展示；`CustomerDeviceGrid`、`useCustomerDevicePage` 与 `CustomerDeviceOriginal` 仅负责受限窗口、按需完整原文及身份代际隔离。复用 InputControl、NavigationLink、ReadFailure、ListPagination 和 WindowedListRows，无新主题、控件外观或 Figma 变体；精确两域入口与嵌套键盘／语义返回位置见 docs/06“客户设备读取”。
