# RepairDesk 员工界面多语言声明

Last verified: 2026-08-31
Owner: RepairDesk Frontend / Integration Lead
Audience: Product, frontend, QA, support, security and release

## 1. 支持范围

员工界面严格支持三个 locale：

| Locale  | 切换器自称 | 用途                         |
| ------- | ---------- | ---------------------------- |
| `zh-CN` | 中文       | 无偏好或非法偏好的确定性默认 |
| `it-IT` | Italiano   | 意大利语员工界面             |
| `en`    | English    | 英语员工界面                 |

语言选择不修改 URL、账号、店铺、权限、查询 key 或业务 API 载荷。客户姓名、备注、型号、工单号、原始状态码和用户输入保持原文。

## 2. 权威实现

- `src/shared/i18n/locales.ts`：locale allowlist、默认值和 Cookie 合同。
- `src/shared/i18n/messages.ts`：以中文 key 集为类型基准的中/意/英字典。其他语言缺 key 时 TypeScript 必须失败。
- `src/shared/i18n/server.ts`：服务端 Cookie 解析。
- `src/shared/i18n/locale-provider.tsx`：客户端即时切换、`html lang` 同步和可访问性公告。
- `src/shared/i18n/format.ts`：已实现并测试数字、EUR、日期、时间和相对时间的共享 formatter，业务时区固定为 `Europe/Rome`。存量深层页面仍有自有 `Intl`/`toLocale*` 实现，须随后续领域翻译逐功能迁移；不得把 formatter 存在声称为存量 UI 已全量接入。
- `src/components/language-switcher.tsx`：唯一共享切换器。

Root Layout 在服务端读取 Cookie，以同一 locale 设置 `<html lang>` 和 `LocaleProvider` 初始值，避免首屏闪烁和 hydration 分歧。这会使 App Router 页面进入按请求动态渲染，是无 URL 语言前缀方案的已接受成本。

## 3. Cookie 和失败语义

Cookie 名为 `repairdesk_locale`，值必须精确等于三个 locale 之一。其合同为 `Path=/; Max-Age=31536000; SameSite=Lax`，HTTPS 附加 `Secure`，且不保存身份或业务数据。

- 缺失、损坏、大小写变体或未知值回退 `zh-CN`。
- 切换只更新内存 locale、`html lang/data-locale` 和 Cookie；禁止 reload、导航、`router.refresh()` 或以 locale 作为路由树 key。
- Cookie 被浏览器拒绝时，当前会话仍保留已选语言，并通过 `role="status"` 公告未持久化；不建立 localStorage 第二权威源。

## 4. 产品语言边界

员工 UI locale 与以下业务概念严格分离：

- Kiosk 和客户沟通字段中的 `it | zh | en`；
- `/r` 客户查询页的意大利语客户体验；
- 维修单、票据、保修和法律文案等固定意大利语客户打印合同。

因此客户路由不显示员工语言切换器；`/r` 与 `/kiosk` 的当前服务端请求会固定使用 `it-IT` 文档语言，但不回写或覆盖浏览器中的员工 locale Cookie。切换员工界面不能改变客户语言、打印文档或保修条款。

## 5. 当前 Release A 覆盖和翻译工作流

共享 catalog 已覆盖语言切换、Root/metadata/manifest/offline 恢复、Shell 导航与命令、公开认证/邀请/开通流程，以及顶层入口与状态。本次 Release A 冻结并实际接入 Dashboard 快捷/优先区与 `/orders` Orders Queue 的 UI-owned 文案、ARIA、加载/空态/搜索反馈、错误/权限/离线/后台刷新反馈和列表日期/相对时间。在切换器可达的正常路径上，切换语言保持 URL、搜索、非默认筛选、页码、选中项和滚动，不 reload 或 remount。

本批未覆盖 New Order、Order Detail、Customers、Inventory、Buyback、打印/通知/票据/保修/协议/法律文案，以及动态店铺、客户、设备、维修项目、供应商和备注数据；这些保持原文并进入 Release B+ 路线图。Orders 与 Dashboard 上的扫码触发器已本地化，但打开后的 `OrderQrScannerSheet` / `ScanSearchSheet` 正文属扫码业务边界，是 Release A 的显式登记例外，不应宣称已翻译。移动筛选层为 modal，打开时外部语言切换器不可达；本批不改变该 focus-trap 合同。深层表单、弹窗、领域文案和存量格式化必须按功能继续迁移，不得用“语言切换器存在”或“共享 formatter 存在”代替完整翻译声明。审计候选数量也不等于缺陷数量，见 `docs/I18N_UNTRANSLATED_UI_AUDIT.md`。

新增或修改用户可见文案时：

1. 先在中文 catalog 定义语义 key 和参数，再同步意大利语、英语。
2. 禁止拼接句子；用 `{name}` 形式插值，并在三种语言测试参数一致性。
3. 原始数据、内部错误码、搜索归一化及稳定排序 locale 不可机械替换。
4. 运行 `node scripts/audit-i18n-ui-text.mjs --summary` 生成待处理清单；该清单是审计输入，不是单独的 PASS/FAIL 门禁。

## 6. Offline、Service Worker 和缓存

应用导航保持 network-first。Service Worker 不得缓存按 Cookie 本地化的应用 HTML，避免不同语言或用户共用错误首屏。静态 offline fallback 自行严格解析同一 Cookie，且每次修改必须提升 SW cache 版本。

## 7. 验证与回滚

最小验证包含：

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
node node_modules/vitest/vitest.mjs run
node node_modules/next/dist/bin/next build
node node_modules/@playwright/test/cli.js test tests/e2e/i18n-language-switcher.spec.ts
```

E2E 必须覆盖非法 Cookie 回退、SSR `html lang`、切换后草稿/对话框/URL 不丢失、Cookie 持久化、键盘/`menuitemradio`/`aria-live`、以及长意大利语在手机和桌面无横向溢出。

回滚时优先恢复上一个已验证的 Vercel `READY` deployment，然后通过正常 forward-revert commit 恢复代码；禁止 force push。旧版本会忽略非敏感 locale Cookie，不需要清除认证或业务数据。

## 8. 文档影响矩阵

| 读者        | 权威信息                                             | 本次结果                                            |
| ----------- | ---------------------------------------------------- | --------------------------------------------------- |
| 产品/支持   | 支持语言、回退、客户语言边界                         | 本声明                                              |
| 开发        | locale/Cookie/catalog/formatter 合同                 | 本声明与 `src/shared/i18n/*`                        |
| QA          | SSR、状态保持、a11y、响应式和 offline 矩阵           | 本声明与 `tests/e2e/i18n-language-switcher.spec.ts` |
| Security    | 严格 allowlist、非敏感 Cookie、无 auth/API/data 影响 | 本声明                                              |
| Release/SRE | 动态渲染成本、SW 缓存、回滚                          | 本声明                                              |
