# 移动端文字与布局溢出排查报告

任务：`TASK-20260904-001-mobile-overflow-audit-fix`
日期：2026-09-04
范围：只限移动端文本/布局；已随后续发布任务提交、推送并部署。

## 结论

首页 320px 意大利语界面存在一个已复现并修复的问题：三列快捷入口中的长标题保持 `nowrap`，但没有宽度约束或裁切，导致“Nuovo ordine rapido”和“Cerca ordine con scansione”越出各自卡片并互相覆盖。页面本身没有产生横向滚动，因此原有仅检查文档宽度的测试没有发现它。

修复后，意大利语和英语在 320px、375px 共 4 个组合中，三个快捷入口标题都保持单行、在各自卡片内省略，页面宽度等于视口宽度。未修改翻译文案、业务逻辑、权限、数据模型或桌面样式。

## 排查清单

| 页面族 | 路由 | 语言/视口 | 结果 | 处理 |
|---|---|---|---|---|
| 首页概览与快捷入口 | `/` | `it-IT`、`en`；320、375 | 发现并修复快捷入口标题越界 | 三个标题增加可收缩宽度和单行省略；补充真实语言几何测试 |
| 工单列表与详情 | `/orders`、`/orders/ord_1` | `it-IT`、`en`；320、375 | 通过；无页面横向溢出或控件内文字逃逸 | 无源码修改 |
| 客户与库存列表 | `/customers`、`/inventory` | `it-IT`、`en`；320、375 | 通过；无页面横向溢出或控件内文字逃逸 | 无源码修改 |
| 消息 | `/messages` | `it-IT`、`en`；320、375 | 首轮页面级检查通过，但独立 QA 复现英语 `Cust.` 圆形步骤徽标内部文字越界；已修复 | 移动端状态导航切换为已有 underline 变体；正常、加载、错误三态一致；补 4 个真实语言几何回归 |
| 设置 | `/settings` | `it-IT`、`en`；320、375 | 通过；无页面横向溢出、视口外文字或控件内文字逃逸 | 无源码修改 |

初始批次检查 20 个页面/语言/视口组合；2026-09-04 后续授权再补查消息与设置的 8 个组合。累计 28 个组合。

## 后续补充审计 — 2026-09-04

- 用户确认继续后，仅打开原报告中未覆盖的消息与设置两组。
- `/messages` 和 `/settings` 在 `it-IT`、`en` 的 320px、375px 共 8 个组合中，首轮页面级几何检查均满足 `documentWidth === innerWidth`，且没有视口外元素。
- 独立 QA 进一步检查控件内部尺寸后复现英语 `Cust.` 圆形步骤徽标文字逃逸：320px 时步骤容器 `clientWidth=290`、`scrollWidth=320`，320/375px 时徽标 `clientWidth=22`、`scrollWidth=28`。该缺陷不会扩大文档宽度，因此首轮通用检查未捕获。
- `/messages` 已使用现有移动端 underline 导航替换会压缩文字的圆形步骤徽标；意大利语/英语 × 320/375 的 4 个回归用例均通过。`/settings` 无需源码修改。
- 两个优先组完成后按停止规则不再扩展第三组页面。首页既有实现与回归结果保持有效，没有重复全量 QA。

## 修改内容

- `src/features/dashboard/components/dashboard-quick-start.tsx`：仅给三个移动端快捷标题增加 `w-full min-w-0 truncate`，保留单行标题和完整可访问名称。
- `tests/e2e/dashboard-quick-start.spec.ts`：新增意大利语/英语 320px、375px 的标题-卡片包含关系与省略样式断言；保留长意大利语交接内容用例，并让它真正使用意大利语界面。
- `src/features/messages/screens/messages-screen.tsx`：只在消息页的正常、加载和错误三态启用已有 `chipsVariant="underline"`，避免窄屏圆形徽标压缩/文字逃逸；桌面不变。
- `tests/e2e/visual-overflow.spec.ts`：新增消息页意大利语/英语 320px、375px 的 underline 导航、内部包含关系和页面宽度断言。

## 验证结果

- Scoped ESLint：通过。
- `npm run typecheck`：通过。
- `npx vitest run src/features/dashboard/components/dashboard-quick-start.test.tsx`：1 个文件、5 个测试通过。
- Playwright Chromium，单 worker、无重试：5/5 通过；覆盖 `it-IT`/`en` × 320/375 及长意大利语交接卡片。
- 代表页只读 Chromium 几何审计：16/16 组合通过；未发现 offscreen 或 escaped text。
- Messages i18n Vitest：1 个文件、49/49 通过。
- Messages Playwright Chromium，单 worker、无重试：4/4 通过；覆盖 `it-IT`/`en` × 320/375，确认不再渲染压缩的 stepper、underline 导航内容留在容器内且页面无横向溢出。
- `git diff --check`：通过（最终关闭前再次确认）。

## 视觉证据

- 修复前：`screenshots/TASK-20260904-001-mobile-overflow-audit-fix/dashboard-before-it-IT-320.png`
- 修复后：`screenshots/TASK-20260904-001-mobile-overflow-audit-fix/dashboard-after-it-IT-320.png`

截图使用本地 mock/合成数据；未包含凭据或真实客户敏感数据。

Messages 修复遵循本轮显式的有界截图策略，没有新增手工截图循环；其视觉行为由上述 4 个真实 Chromium 几何回归提供。首页修复继续使用本节列出的前后对比截图。

## 剩余风险与后续项

- 本轮是有界代表性排查，不是所有路由、所有动态状态的穷举审计。
- 消息与设置页面族已补查；消息页徽标逃逸已修复，设置页无变更。仍未对所有动态弹窗、失败分支和所有网站路由做穷举审计。
- 登记但不在本轮扩围的 P2/P3：消息分区长说明仍采用既有截断；模板选中态可补充更明确的 ARIA；设置零权限态可补充更明确的空状态语义；设置页尚未形成长期浏览器矩阵。
- 未运行 WebKit、视频、trace 或截图循环，符合本轮验证预算。
- 发布结果：候选已通过独立 QA/Release、Node 22、本地与 hosted exact-SHA 门禁；应用提交 `e0ea10189e6eea56fcf0905256cd597394c9295f` 已普通推送到 `main`，Vercel production deployment `dpl_8AeSm9zBkJeCTgxeYTA1fofdks6C` READY 并绑定两个正式域名。
