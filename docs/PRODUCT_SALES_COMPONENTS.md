# 商品售卖组件与交易接线

状态：新销售 API 已接入的本地候选。实际 Astra/max 实施，业务源码冻结后由 Integration Lead 统一执行生产构建、浏览器验收与发布；本文件不证明已经上线。

## 已实施与复用

| 组件 | 责任与边界 |
| --- | --- |
| `InventoryProductListScreen` | 商品售卖单入口文案，默认紧凑列表，使用 sales/list 的同店批量投影、队列计数、分类/状态/品牌/库位和分页；明确 feature_disabled 时回退旧读取。 |
| `InventoryProductQueueComponents` | 手机卡片、平板双列、桌面六列表格；全部与手机/平板/电脑/游戏机筛选；兼容已有其他类别。 |
| `InventoryProductFormWorkspace` | 独立手机顺序与桌面三个顶级列；桌面不复用手机 Sheet 布局。 |
| `InventoryDeviceCatalogFields` | 复用现有目录选择、手动补充与选项逻辑；手机短字段成对，桌面首列按鼠标操作顺序。 |
| `InventoryProductCreateDialog` | 复用现有 Dialog/草稿关闭逻辑，首次焦点落容器，桌面工作区加宽。 |
| `InventoryProductIdentifierSection` | 复用原有标识输入、粘贴和完整页扫描边界；本切片不新增相机行为。 |
| `InventoryProductDetailWorkbench` | 紧凑 RepairOS 卡片与设备资料；完整文字弹窗查看；注入 SalesWorkspace，已登记销售的设备事实编辑关闭。 |
| `SalesDocumentSheet` | 售卖、单笔收款、保修三类凭证的无数据读取展示组件。 |
| `SalesDocumentPreview` | 单次语言、A5横向/A4横向整页、输出就绪及失败显示。 |
| `SalesDocumentPrintSheet` | 复用 PrintPortal；`canOutput=false` 时不挂打印内容。 |
| `buildSalesDocument` | 从已经授权的持久化快照构建文档；不是服务端交易或权限实现。 |

颜色沿用项目 token；控件复用 Button、Dialog、Popover、Sheet、项目数字输入与扫码组件。没有修改全局样式或 UI primitives。

## 保留的数据合同

- 录入继续复用真实 V2 intake、目录与 IMEI/SN 组件；空成本序列化为 undefined 并在 JSON 中省略，原 API 已允许省略，未写入伪造零成本。
- 既有录入字段、其他类别、预设保修选项及保存行为在本切片保持兼容；新销售合同的 24/12 月规则由新的文档模型表达，尚未替换录入中的历史字段。
- 新售卖独立于旧 lifecycle。新查询明确 feature_disabled 才可回退；401/403/网络/500不伪装兼容。旧无库存单元记录可读，无法交易；历史无新销售单的原状态保留。

## 文档输入与接线要求

`SalesDocumentSource` 接收商品与客户快照、整数分售价、按稳定 sequence 标识的付款明细、销售约定时间、交付时间、门店打印身份，以及独立的 `warrantyAgreement` 和可选 `coverage`。

`warrantyAgreement` 包含 `months:12|24`、`usedDevice`、`shorteningAgreed`、`termsVersion`。12个月要求二手事实及明确缩短同意。交付前可以显示已约定期限；实际覆盖 `coverage` 只在交付后存在。覆盖开始必须与交付一致，交付不能早于任何已记录正向付款。

`salesWarrantyEndDate` 按 Europe/Rome 交付日加月并夹紧月末，返回 `YYYY-MM-DD` 的合同日期；`coverage.endsOn` 不应误当 UTC 截止瞬间。当地午夜闰日及 DST 附近已有定向反例测试。

金额必须是安全的非负整数分，正向付款大于零，累计不超售价，付款 id 和 sequence 唯一。历史收款凭证只显示截至该筆的累计和待收，三语均不混入之后交付或保修时点。

SalesReceiptDialog 按需读取授权 wrapper；salesReceiptDocument 同时检查当前店铺归属、服务器输出门禁和历史快照。普通展示组件不自行读取资料。新开凭证使用服务端选择的默认语言，预览内可临时切换三语；设置页沿用原分组 CAS 保存默认语言，未修改语言时从请求省略，保持无新schema场景的旧设置兼容。历史卖方快照缺失须负责人核对原始单据，不能通过当前设置补写旧事实。打印按钮再次获取服务器门禁成功后才输出。

## 打印与视觉验收

Italiano 默认，可切 English/中文。仅实现并验证 A5 横向和 A4 横向整页；既有半页/双联纸张不在本次覆盖范围，未新增热敏纸。

三类 × 三语言 × 两纸张实际生成18份 PDF，每份一页；A5约595×420pt，A4约842×595pt。已将意大利语销售 A5、中文保修 A5 实际 PDF 渲染为 PNG 并查看，无裁切、乱码或文字重叠。

桌面1024/1280/1440和手机/平板390/430/768均有真实 React 列表、录入、品牌选择、详情与完整值截图，另有320边界。桌面选择器为一个外层模态 Dialog 加一个非模态锚定 Popover；两者均可能有 `role=dialog`，不可按角色数量误算为两个模态根。

本轮交易接线、列表、五项售前检查、打印语言、切店/撤权缓存已完成本地实现。当前接线的生产构建与六宽浏览器证据由最终 RC 唯一执行者补齐，旧视觉截图仅证明原展示切片。桌面同名 AppBar 与正文标题仍由最终视觉验收检查；手机底部确认/关闭保持44px。

## 新接线责任与可重现验证

- `sales/ui/sales-transaction-dialog.tsx`：复用手机号优先 CustomerIdentityLookup / 客户创建 API 与数字键盘；整数分、正向首款、24月默认、二手12月明确同意、收款留店/原子交付/单独交付。打开表单固定余额及CAS；未修改payload的失败重试沿用操作UUID，金额或输入改变才换UUID，pending锁防双点。
- `sales/ui/sales-inspection-dialog.tsx`：五项实际检测值分别编辑，复用V2 inspect；不自动pass、不把旧编辑当完整检测。另由用户明确触发既有transition标记待售。
- `sales/ui/sales-workspace.tsx`：服务器capabilities/allowed_actions控制动作、分笔余额快照、客户管理关联和三类凭证；已支付设备禁止编辑身份/规格，旧无unit只读。
- `sales/ui/sales-list-results.tsx`：复用批准商品卡片，桌面独立六列；精确三队列与all/已交付计数，其他历史状态保留。SQL筛选复用原分类别名、库位legacy_payload.location及排除buyback规则。
- 成功后仅失效当前店铺库存/销售/客户查询；sales query root纳入既有切店、权限变化及退出取消/清理。Realtime沿用已验证的新sales invalidation组。

本次SQL仅更新新候选list函数，其他财务/ACL/RLS/时间/占用函数不变。18条PG17筛选断言真实通过并ROLLBACK；两次前置失败分别是错误假定库位为列、合成seed默认computer。按真实字段与显式phone fixture修正，断言预期未放宽。

Node22相关10文件179项、缓存6项已通过；最后固定CAS/欠款pickup与历史状态显示另有增量测试。实际exit与最新命令见 `artifacts/product-sales-wired-20260907/HANDOFF.md`。

`tests/e2e/product-sales-wired.spec.ts` 对真实页面及API wrapper使用合成拦截，准备覆盖390/430/768/1024/1280/1440、三语、定金→尾款留店→交付→旧收款凭证。仅最终RC现有production服务可执行，不再启动并行Next。其结果须单独记录，不等同真实生产交易。
