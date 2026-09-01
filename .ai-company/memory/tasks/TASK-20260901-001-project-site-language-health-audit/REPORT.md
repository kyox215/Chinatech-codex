# 项目、网站优化与语言完整性报告

审计时间：2026-09-01（Europe/Rome）
审计性质：只读；未登录生产、未使用客户数据、未修改业务代码、未提交、未推送、未部署。

## 执行结论

- **语言切换机制：已完成。** `zh-CN`、`it-IT`、`en` 的白名单、中文默认、SSR `html lang`、Cookie 持久化、即时切换、无刷新状态保持、键盘/焦点反馈和客户路由隔离均有实现与测试/生产证据。
- **全站翻译：未完成，当前为部分完成。** Shell、认证基础、Dashboard 快捷/优先区与 Orders Queue 已完成；Order Detail/New Order/Order Task、Customers、Inventory、Buyback、Settings、Messages、Finance、Toolkit、Memos 等深层员工流程仍有大量固定中文。
- **客户页面：** `/r` 固定意大利语符合当前合同；Kiosk 虽被强制为 `it-IT`，但标题/页头、错误与 ARIA 文案仍混有英语/中文，不能算完成。
- **当前稳定性：** 没有发现 P0。远端 `main`、本地业务基线和生产部署同为 `8e349b06...`，Vercel READY；公开生产浏览器检查无控制台、页面或请求错误。

## 语言完成度矩阵

| 范围 | 状态 | 证据与边界 |
|---|---|---|
| Locale resolver / Provider / Cookie / SSR / `html lang` | 已完成 | 三种合法值、非法值回退、无刷新切换和客户路由隔离已验证 |
| Typed catalog | 结构完成 | 每种语言 761 keys、空值 0、意/英 Han 0；不等于全站文案或母语质量已完成 |
| 全局 Shell、导航、命令面板、公开认证基础 | 已完成 | 生产公开页可切换；共享消费面已接入 |
| Dashboard 快捷/优先区、Orders Queue Release A | 已完成 | 冻结 16 个消费者直接 Han 0；16 文件/127 测试通过 |
| 深层员工业务流程 | 部分完成 | 13 个生产可达代表屏幕仍有 1,163 个候选；须逐功能分类与迁移 |
| `/r` 客户维修状态 | 已完成当前策略 | 固定意大利语、无切换器、不覆盖员工 Cookie |
| Kiosk | 未完成 | `it-IT` 壳层内混有 `Customer Kiosk` 和中文错误/ARIA/Zod 文案 |
| 打印、票据、保修、协议、通知、法律 | 独立内容线 | 不自动纳入员工三语；需要产品/内容/法律审批 |
| 客户名、设备、备注、自定义流程等动态数据 | 保留原文 | 这是业务数据边界，不是翻译缺陷 |

原始审计为 5,599 次 / 4,088 个唯一候选；该数字不能直接当缺陷数。至少 935 次来自已知旧路由/旧屏幕，其他还包含内部值、动态数据和规范标识。

## 优化清单

### P0

无已证实 P0。当前切换器、公开 SSR 和已交付 Release A 未发现生产失效。

### P1 — 建议优先执行

| 顺序 | 优化项 | 影响 | 建议完成标准 |
|---:|---|---|---|
| 1 | Kiosk 统一为意大利语 | 客户可见混合语言与辅助技术标签不一致 | metadata、页头、错误、ARIA、Zod/模型 fallback 全部同语；公开 390/768/1440 浏览器验证 |
| 2 | 把 i18n E2E 变成真实 PR 门禁 | 当前主要 Playwright job 仅手动触发，存在“假绿” | shared i18n/layout/providers/auth 路径触发；Chromium+WebKit；环境缺失不得静默算通过；同步文档命令 |
| 3 | 分批完成深层员工页面翻译 | 高价值业务流程仍中英意混用 | Scanner/Camera 与 Orders 深层优先，再 Customers/Inventory/Buyback，最后 Settings/Support；每批清零可达固定文案并测错误/空/权限状态 |
| 4 | 处理 8 个生产依赖告警 | 6 high、2 moderate，涉及 Next/PostCSS 与 ExcelJS 间接链 | 先做可达性/兼容性审查，再升级、全门禁、Preview 与回滚；无 critical，不应盲目 `audit fix` |
| 5 | 对齐 Node 运行时 | CI 22.12、Vercel 24，容易出现环境差异 | 明确唯一受支持主版本并让 `.nvmrc`、engines、CI、Vercel 一致 |
| 6 | 拆分超大核心模块 | Order Detail 6,081 行、repository 4,158 行、router 4,111 行/180 cases，翻译或功能修改易回归 | 按 feature adapter/handler/tab 拆分，先补行为测试，保持 API/权限不变 |
| 7 | 增加错误边界与请求关联 | 缺少 app/global error boundary、instrumentation 和结构化关联，生产故障难定位 | PII-safe error boundary、correlation ID、关键 API/页面指标与告警；先 Preview 验证 |
| 8 | 停止仓库证据文件继续膨胀 | tracked 约 247 MiB，根截图约 143 MiB，`.git` 约 542 MiB | 新截图/构建证据转 CI artifact/对象存储；制定保留期；历史改写另行审批 |
| 9 | 统一公开页面安全/索引头 | `/r` 保护完整，`/login`/`kiosk` 不一致，`robots.txt` 404 | 逐路由定义 CSP/XFO/nosniff/referrer/noindex；兼容 Kiosk 相机/设备能力后再上线 |
| 10 | 修正认证失败体验 | 部分错误只用 Toast；注册完成页可能忽略 query error | 字段 `aria-invalid`/`aria-describedby`、焦点首错、明确失败/重试/安全返回状态 |

### P2 — 纳入后续治理

| 优化项 | 建议 |
|---|---|
| 旧路由/旧屏幕与审计噪声 | 先证明不可达，再删除；扩展审计器覆盖 `.ts` 与运行时文案 |
| 404 与 metadata 细节 | 本地化 404；切换后同步 `document.title`；修复 `/r` 品牌重复标题 |
| 移动端语言入口 | AuthShell 预留固定入口空间，避免 390px 标题潜在碰撞；提高员工移动抽屉中的入口可发现性 |
| Feature 边界 | 对 242 个跨 feature 深导入与循环依赖增量建立公开 API 和 lint 约束 |
| 质量治理 | 加风险导向 coverage threshold、Knip/agent rule 门禁、关键页面 Story；修正 E2E 截图证据目录 |
| 性能测量 | 先以 RUM/route chunk 证据评估 135KB catalog 静态导入，再决定是否按 locale 动态拆分 |
| 术语与内容审批 | 建立意大利语术语表、母语复核记录，以及客户/打印/法律内容审批流程 |

## 建议路线

1. **第 1 批：客户与门禁。** Kiosk 语言一致性、自动 i18n 双引擎 CI、审计器 `.ts` 覆盖、404/metadata 小修。
2. **第 2 批：业务价值。** Scanner/Camera + Orders 深层，再做 Customers/Inventory/Buyback；每批独立测试、截图、Preview 与回滚。
3. **并行工程治理。** 依赖/Node 对齐、超大模块拆分、错误边界/可观测性、证据保留策略；不要与大范围翻译混成一个发布。

## 验证与限制

- 当前 `HEAD`、`origin/main`、远端 main 和生产 Git SHA 均为 `8e349b06f9e44883eb3348b434f96ad3f0d409d3`；生产部署 `dpl_AP6Y4eDmFgukeS4boDjDtqsNEJY3` 为 READY。
- Node 22.12 定向回归：16 files / 127 tests 通过。公开 Chromium：390/768/1440 无横向溢出，切换不改 URL，非法 `en-US` 回退中文，无 console/page/request error。
- 本轮没有生产员工账号，因此没有读取真实 Dashboard/Orders 数据或重跑登录后真实数据流。相关结论基于当前源码/单测、未变化的 Release A 受控 Chromium/WebKit 证据和公开生产 SSR；不等同于生产全站登录巡检。
- 自动化和字典结构不能替代意大利语母语审校。
