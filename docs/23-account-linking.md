# 账号设置与第三方身份绑定

2026-10-03，用户要求 Apple 登录接口、个人账号邮箱/Google/Apple 关联，以及可选国际区号的手机绑定。

## 入口与行为

- `/login`、`/register` 共用 `SocialSignIn`，Google 与 Apple 使用服务端 POST、PKCE 和固定 `/auth/callback`。保留已上线 Google 客户端与登录回调；服务未配置时明确报错。
- 侧栏账号菜单和 `/account/pending` 都可进入 `/account/settings`。个人账号页独立于门店业务快照，已验证但无门店成员的用户也可管理自身身份。
- 登录邮箱为 Supabase 的唯一主邮箱，申请更换后显示待确认地址。必须按新旧邮箱邮件完成确认，确认前原邮箱有效；设置/重置密码复用现有找回密码流程。
- Google/Apple 采用 `linkIdentity` 关联当前账号；不新建门店成员，不更换用户 ID，不合并已属于其他账号的身份。本次没有解绑入口。
- 手机区号复用 `SelectControl`，34 个常用区号＋其他区号；号码按 E.164 校验，保留本地号码前导 0。短信请求→待验证号码→`phone_change` OTP→服务端重新读取已验证结果，才显示已绑定。

## 权限与一致性

所有账号写入验证同源、字段白名单、`getUser`、claims 身份与真实数据库会话。`X-CT-Account-ID` 仅比较预期身份，不能决定要修改的用户；跨标签换号时旧表单被拒绝，界面重新读取并按身份清除草稿。页面不保存邮箱/手机/验证码到 localStorage。

OAuth/邮件关联凭证为一小时 HttpOnly/Secure/SameSite 签名 cookie，绑定用户、发起会话、操作类型、目标及随机 nonce。固定 `/auth/account/callback`，无任意 `next`。先检查原会话，交换产生的 cookie 暂存，核验同一用户后才提交。手机号 OTP 也暂存新会话并核验身份和号码。接口不返回令牌、完整用户元数据或其他账号资料。

正式 `chinatech_v2_account_created` 已监听 `email` 和 `email_confirmed_at`，主邮箱更新自动同步 v2 账号投影，并保留用户 ID、成员权限与禁用状态。云只读确认与仓库迁移一致，本次无需云迁移。本地旧触发器仅在隔离 55422 对齐了已有正式定义。

## 正式服务状态

- 用户本轮明确确认后，ChinaTech_date 的 **Allow manual linking 已开启**，刷新控制台复核保存成功。匿名登录仍关闭，邮箱验证与 Secure email change 保持开启。
- Google 登录服务已配置，本次沿用。Apple 和 Phone provider 保持关闭，未创建虚假客户端或验证码成功状态。
- Apple Web OAuth 还需用户的 Apple Developer Team ID、启用 Sign in with Apple 的 App ID、Services ID、签名 Key ID 和安全保管的 `.p8`。Supabase 回调域名 `xluzcoduqsdvjoouqhkc.supabase.co`，回调 URL `https://xluzcoduqsdvjoouqhkc.supabase.co/auth/v1/callback`。客户端 secret 应由签名 key 生成并保存于 Supabase provider；按官方要求最多每六个月轮换。隐藏邮箱还需配置邮件转发来源。
- 短信服务还需实际服务商配置（例如 Twilio）与验证码交付验证。本次未向真实用户发短信或测试邮件。
- 现有 `https://www.chinatech.in/**`、`https://chinatech.in/**` Supabase redirect allowlist 已覆盖新的账号回调，无需扩大范围。

官方依据：[身份关联](https://supabase.com/docs/guides/auth/auth-identity-linking)、[Apple 登录](https://supabase.com/docs/guides/auth/social-login/auth-apple)、[更新账号](https://supabase.com/docs/reference/javascript/auth-updateuser)、[验证 OTP](https://supabase.com/docs/reference/javascript/auth-verifyotp)。

## 验证证据

- 19 项账号权限/安全/真实 SDK PKCE 定向测试；其中供应商设置和手机号短信验证使用隔离 mock，不代表真实 Apple 授权或短信送达。
- 7 组真实本地 Supabase/捕获邮件集成：待授权账号、跨源与旧标签身份拒绝、双邮箱第一封待确认/第二封生效、原身份与 v2 镜像一致、成员数不变、回调重放拒绝和新邮箱登录。
- Chrome 实际页面：账号设置及登录/注册在 1440、1024、390、375 无横向溢出；手机输入 16px，主要按钮44px以上。实点 Apple 未配置反馈、待授权入口、区号及自定义区号、原邮箱重复提交、刷新保留号码。截图与检查见 `.local/ui-proof/account-bindings/`。
- 新账号 GET 不加载维修/整机业务快照。本地 Node 24、Next dev 3117、隔离 Supabase、无门店成员，10 次暖样本345B、P50 52.66ms、最大59.36ms；不能作为线上或弱网性能承诺。
- 发布候选仅合入本轮28个路径，基于正式main，不包含工作区并行维修/性能修改。预览及正式构建、严格TS与249项单元通过；lint 0错误、1条原有backend/client.ts内部导航警告。
- 已发布 main `52b7f67747f1cecaae2a3b2a45d012464e3af0c8`，Vercel `dpl_YqDjsvFDFWqmjhqTuuTBj9CnaXTg` READY/production，`www.chinatech.in` 与 `chinatech.in` 均指向该部署。CI `37075940272` 全部成功，包括 Chromium/WebKit 控件回归与正式构建。
- 线上14项接口检查通过：Google固定项目/回调/PKCE，Apple未配置503，同源与匿名会话拒绝，账号回调安全固定落点。真实Chrome已登录会话确认Google已关联、邮箱已验证及侧栏账号入口；未修改真实账号数据。证据 `.local/account-bindings/online-verification.json` 与 `.local/ui-proof/account-bindings/live-checks.json`。

未完成验证：真实 Apple 授权、真实短信交付、实体 iPhone 和 Windows；外部凭据/服务启用后需继续验收。

## 2026-10-06 保持登录与设备管理（本地候选）

正式登录新增默认不勾选的保持登录，邮箱与已配置 OAuth 共用选择。账号绑定和手机号确认产生新会话时，在身份核验后登记会话并保留原保存方式；密码恢复不继承普通登录意图，完成后清除策略。个人账号设置增加独立设备区域，待门店授权用户仍可管理自己。完整权限、30天闲置、迟到响应与迁移方案见[登录设备29](29-login-session-devices.md)。生产尚未发布。

2026-10-07 修复：绑定产生新会话前，使用已验证原会话 identity 在完整实时权限事务内读取 ledger.remember；缺行或失败拒绝，不使用缺失、无关或重放 Cookie。账号表单/设备按账号和会话隔离，两个组件使用不同 key 前缀；详情与实际当前证据见 docs29。

## 2026-10-07 登录会话发布

本次登录勾选、活动追踪、个人/员工设备复用既有控件、三语和权限边界；用途/nonce隔离、原会话政策继承、账号+会话清草稿/确认、两个身份header、Cookie退出清理与窄范围幂等竞争处理共用正式后端。迁移先兼容、验证应用后严格启用，保留共享Auth及已提交业务；完整产品/迁移/当前验收见[登录设备29](29-login-session-devices.md)。
