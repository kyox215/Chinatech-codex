# 组件与组合索引

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
| 表头 / 列表 / 分页 | 领域列表、`components/list-pagination.tsx` | 原 `12327:116172` / `116173` / `116270`；旧结果保留及计数同步 |
| 标题 / 侧栏 | `components/page-title.tsx` / `dashboard/app-shell.tsx` | 原侧栏 `12327:116271`；手机标题排菜单/返回/操作44px；单个操作及`module-heading__actions--icons`纯图标组同排，长状态在标题内换行，多文字操作保留独立工具栏；隐藏文字必须排除导航图标槽及可访问消息；不增加全局顶栏 |
| 分组 / 页内 Tab | `repairs/repair-detail-workspace.tsx` 及领域分组 | 原 Tab `12327:116162`；同记录切换保留草稿，不制造导航等待 |
| 读取 / 错误 / 权限 | `components/page-recovery.tsx` 与共享读取状态 | 真实标题框架保留；首次局部等待、失败就地重试、无权限隔离 |
| 保存 / 恢复 | `components/use-operation-receipt.tsx` | 原 requestId/版本/回执；失败留输入、未知需核对、禁止假成功 |
| 照片 / 查看 | `repairs/intake-photos.tsx` / `repairs/repair-photo-registry.tsx`（含 PhotoViewer） | 现有真实读图、失败重试；专用登记和不可变历史；占位不代替照片 |
| 成功通知 / 下载提示 | 统一 Toast（本轮新增） | 本轮原 Figma 中补齐；1.8秒/点击关闭；下载只表示已发起 |
| 公开首页 | `components/home/` | 保留现有营销布局、品牌、教程；公共控件遵循同一组件目录 |
| 工具箱 | `components/toolbox/` | 保留当前已发布工具状态、下载/媒体/许可；不恢复已退休资产 |
| 工作台 / 详情 | `components/dashboard/` 及领域组件 | 现有桌面/手机两套结构；工单设计详 `docs/37-repair-detail-redesign-plan.md` |

此表为项目全部现有组件类别的复用索引，不声称每页每状态与 Figma 逐像素相同。自定义业务组合由对应模块所有；新设计必须补齐具体 Figma 节点与代码入口后登记。
