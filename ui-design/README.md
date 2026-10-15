# ChinaTech UI 设计目录

此目录是项目已有 UI 的复用入口。运行实现仍由 `components/` 和 `app/globals.css` 维护，不复制第二套主题或组件代码。

## 维护流程

1. 读取 `PROJECT_MEMORY.md`、`AGENTS.md` 和 `docs/06-ui-components-and-styles.md`，在本目录查找组件、组合与状态。
2. 复用对应代码组件、语义类、token 和已确认业务布局；扩展只在原组件维护。
3. 缺失设计先在原 Figma 文件补组件/状态；记录节点、变体、token 和代码映射，再在本目录登记后使用。
4. 对真实页面检查默认、执行中、成功、失败/重试及适用的空态、离线、权限、冲突、未知结果。设计稿不证明接口或数据保存成功。
5. 补三语、键盘/触控、减少动画和正式编译 CSS 验证；记录实际证据和未验证边界。

原 Figma：`nhZ37YLOUVP8zpDBBGihhS`；项目原始视觉节点 `12373:155040`。已有高保真映射见 [组件目录](components.md)。业务内容、客户数据、权限、金额、签名与打印事实不由 Figma 生成。

## 修复候选：恢复呈现与列表状态槽（2026-10-16）

本轮沿已有 `NavigationLink`、`OperationRecoveryControls` 和语义token修正采购/客户状态槽、报价合计及正式历史标签；新增 `recovery-visibility.ts` 仅为恢复入口的技术辅助。局部隐藏后的全局接管保留原requestId、草稿和回执，商品未知结果继续锁输入但不假显示执行。入口与维护要求见[组件索引](components.md)和[候选规范](../docs/06-ui-components-and-styles.md)。

此登记属于待验候选，不覆盖2026-10-15正式基线、数量或历史验收；源CSS离线几何、实际React内存夹具、新正式构建、准确提交CI和最终发布各自取证。

## 当前增量：加载与通知（2026-10-15）

- 导航在现有图标槽替换等待标记；无图标的文字链接预留固定槽。真实 Next pending 驱动，页面和业务标题保留；取消额外 pending 外框。
- 内容顶部沿用 2px 紫色不定进度线。请求结束才收尾，未知提交没有正在请求时不持续转圈。
- 普通已确认成功使用统一紧凑 Toast，1.8 秒自动消失、点击提前关闭；占据自身布局空间，不悬浮遮挡内容。
- 错误、冲突、离线与结果待核对保留就地处理入口。通知消失只影响展示，不删除请求、回执或草稿。

新增状态页：[ChinaTech UI](https://www.figma.com/design/nhZ37YLOUVP8zpDBBGihhS?node-id=15167-209297)。`figma-state.json`保存18个变体、变量/字体和可编辑结构证据，`original-components.json`索引原按钮/输入/选择/分页/Tab/Card/表格；它们不是整份Figma文件导出。`previews/`保留设计图和实际DEMO截图，`catalog.tsx`直接使用实际共享组件。实际验收与限制见`verification.md`。

手机标题图标的真实DEMO截图也归档在`previews/mobile-toolbar-*`：两引擎、同型号新建/关联工单、空闲/真实导航等待共8张；保留原页面、标题、44px按钮及单圈。它们证明该场景的实际界面，不代表正式账号数据。
