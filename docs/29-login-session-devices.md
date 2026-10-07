# 保持登录与登录设备管理

2026-10-06 实施，本地候选；生产迁移与发布尚未执行。

## 已确定产品行为

- 正式邮箱及 Google/Apple 登录共用“在此设备保持登录”，默认不勾选。勾选后跨浏览器重开保留；连续 30 天没有实际前台使用则重新登录。未勾选采用会话 Cookie，浏览器自己的会话恢复行为不能等同于可靠检测物理关闭。
- 打开/返回前台、导航及可信输入/点击上报活动，最多每分钟一次；后台同步、令牌刷新、只读会话检查和页面一直挂着不续期。过期会话不能通过活动恢复。
- `/account/settings` 管理自己的浏览器会话，可退出指定、当前、其他所有设备。一个浏览器会话包含多标签页；同一实物的不同浏览器分别显示，不使用硬件指纹猜测身份。
- 门店设置→员工设置中，仅当前有效老板可管理本店员工已访问本店的会话。撤销只阻止指定会话对本店的访问；其他门店与个人账号仍可用。重新登录创建新会话可恢复本店，仍受当前成员权限约束；停用员工继续用既有成员管理。
- 列表按 20 项分页，批量操作计数覆盖全部获授权会话；仅显示有限浏览器/系统、登录/实际使用时间、保持登录和当前设备标记。未知资料不补造，不展示 IP、令牌或跨店活动。

## 数据、安全与 Cookie

私有 `login_sessions` 保存项目会话、`store_login_sessions` 保存门店会话访问、`session_audit` 保存撤销审计。RLS 与受限 `chinatech_runtime`、固定搜索路径/撤销 PUBLIC 执行的窄函数配合；不授予直接 Auth 表读写权限。`live_user` 同时核对真实 Auth session、已验证邮箱、账号状态、项目撤销及 30 天期限；`member_access` 与 Realtime `sync_topic_access` 增加本店撤销检查。

`withDatabase` 在完整 serializable 事务中锁当前项目会话再鉴权。老板撤销锁目标父会话，个人撤销更新父会话；撤销提交后开始的新业务读写被拒绝，先前已提交事实保留。请求 ID/预期版本、重复回执、账号变化与门店范围由服务端核验。签名/销售/业务快照不受本功能修改。

认证 Cookie 仍为 HttpOnly / SameSite=Lax / 正式 Secure / 禁止缓存，分块刷新先合并完整集合再应用统一策略。策略签名绑定 session ID；正常认证刷新从数据库读取 remember，浏览器篡改/重放策略不能改变授权或保存方式。

为防止活动请求迟到覆盖新账号，`/api/auth/activity` 与其 proxy **均不写 Cookie**：显式校验 JWT 后只更新数据库活跃时间。活动请求允许跨普通导航完成，客户端丢弃已失效页面的响应。仅访问令牌过期返回 `SESSION_REFRESH_REQUIRED`，前台经普通、可取消的 `/api/auth/account/session` 刷新并核对有效会话后重试；撤销或闲置失效仍要求重新登录。

实现采用 Supabase SSR 的 400 天持久 Cookie **保留期限**，与服务器的 30 天**授权闲置期限**分开。这是对原规划“活动后重写所有 Cookie”的技术调整，避免跨账号晚响应，也避免活跃用户因旧 Cookie 截止日提前退出；绝不把 400 天当作可访问期限。有效性以服务器实际会话记录为准。[Supabase 会话机制](https://supabase.com/docs/guides/auth/sessions)

## 接口

- `POST /api/auth/login` 和 Google/Apple 发起接口接受 `remember?: boolean`，缺省 false；OAuth 使用十分钟签名意图，绑定 oauth-login 用途与回调随机 nonce，仅 /auth/callback 可继承；/auth/confirm 注册和恢复始终临时登录，注册开始清除残留意图。
- `GET /api/auth/account/sessions?offset=0` → accountId、sessionId、devices、actionableCount、nextOffset。
- `POST /api/auth/account/sessions/revoke` → requestId、scope(one/others)，单项附 sessionId/revision；`X-CT-Account-ID` 与 `X-CT-Session-ID` 均须匹配当前已验证身份。
- `GET /api/backend/staff/sessions?memberId=...&offset=0` 使用当前门店会员 ID，仅老板可读。
- `POST /api/backend/staff/sessions/revoke` → requestId、memberId、scope(one/all)，单项附 sessionId/revision；两个身份 header 与当前门店及老板身份事务内重核。
- `POST /api/auth/activity` → `{store?:boolean}`，无 Cookie 写入；没有客户端时间或用户 ID 参数。
- `GET /api/auth/account/session` → 当前 accountId/sessionId，用于访问令牌恢复；只核对、不更新闲置时钟。

## 迁移与发布门禁

迁移文件为 `20261007131534_login_devices.sql`，通过 CLI 创建。迁移先补录已有 v2 账号 Auth sessions（remember=true、旧设备信息未知、活跃基线为迁移时刻），`login_session_controls.enabled` 初始 false。切换窗口的缺记录旧会话可受限补录，存在的撤销/过期记录始终不覆盖。

接入应用并通过验证后，由迁移管理员执行 `select chinatech_v2_private.enable_login_session_controls()`，补齐切换窗口记录后开启严格模式。函数不授予客户端或 runtime。严格模式下，只有新的受验证登录流程可登记会话，单独取得 Auth session 而没有项目登记不能访问。

发布须核对当前 main、当前项目数据库、迁移历史、当次授权及项目 CI 门禁；先迁移兼容结构，再应用部署及核验，再启用严格模式。回退版本须保留撤销与门店检查，不能用旧实现绕过已撤销状态。共享 Auth 全局超时/单设备设置不修改，旧系统会话/数据不删除。

## 验证证据与限制

本地命令：`npm test`、`npm run typecheck`、`npm run lint`、`npm run check:i18n`、正式 Supabase-mode build；`npm run test:login-devices` 需要项目独立本地 55421/55422 与独立应用端口，创建并精确清理合成账号/门店；可用 LOGIN_DEVICES_ORIGIN=http://localhost:3139 指定，默认 3117。

会话证据 `.local/login-devices/integration.json` / integration.log；浏览器证据 browser.json 与 screenshots；单元/lint/build 日志位于 `.local/login-devices-*.log`。合成过期访问令牌 envelope 使用真实 refresh token 验证恢复，不冒称等待真实一小时；浏览器重开采用新 context 导入持久 Cookie，不冒称实体设备重启。

未执行生产迁移/发布、真实 Google/Apple 外部授权、实体手机或跨物理设备、完整云端浏览器 CI；已有真实账号和业务数据未写入。

最终本地验收：359单元通过，14组真实本地会话/浏览器通过，strict TS/check:i18n（3197键）/正式build通过，lint零错误且保留一条原有导航warning。双浏览器在实际账号菜单与门店/员工设置入口点击，并覆盖前台受控过期hint→真实刷新→继续登录；没有放宽权限、Cookie或零JS错误断言。8次本地设备列表GET样本P50 57.42ms、最大94.59ms，仅作该隔离本地条件的记录。

交付时全量门禁状态（2026-10-06历史）：本任务38项认证/会话定向单元与14组集成/双浏览器验收通过，合成账号/门店计数均0，严格门禁启用。较早的完整359单元、类型/三语/lint/build曾通过；随后工作区商品模块出现新的未完成修改，最新全量单元为358/359（静态三语门禁失败），最新check:i18n为50条商品相关词条/包装问题，typecheck为4处商品模块错误（缺retail-checkout、IdentifierKind和规格控件props不匹配）。未回滚或修补这些非本任务改动；当前工作区不可据此发布。日志.local/login-devices-unit.log、login-devices-i18n-final.log、login-devices-scoped.log和cleanup.json分别保留对应证据。

## 2026-10-07 闭环修复与当前验收

复核确认的四处缺口已实施修复：注册 PKCE 不再借用未完成 OAuth 的保持登录；邮箱/第三方/手机绑定从实时有效原会话 ledger 读取 remember，不回退到浏览器策略；账号表单与个人设备组件按账号+会话分别使用唯一 key，个人/门店设备在 focus/online 重读、关闭旧确认、丢弃旧响应；设备写入须匹配账号与会话两个 header。同账号重新登录也拒绝旧页操作，旧草稿不跨会话显示。

项目撤销事务已提交或会话已失效时，第三方 signOut 返回错误/抛错不撤销项目退出结果，仍清本机 Auth 整块、所有已知 chunks、PKCE verifier 与登录策略并返回成功；项目撤销未确认时返回失败且保留重试边界。当前设备退出共用清理规则。同范围未知网络结果保留原 requestId，身份变化清除；session_audit 该 PK 的并发 23505 仅触发完整权限事务重试，随后读取并核对已有回执，其他唯一冲突不泛化重试。

运行时回归发现同层 React key 冲突造成重复表单，已分成 forms:/devices: 前缀，并强制验证邮箱输入始终只有一个。新会话仅使用账号设置不会生成本店访问事实；浏览器门店撤销反例先真实进入工作台并核对门店活动，再从账号菜单返回设置。

OAuth redirectTo 仍限定当前可信 origin 与 /auth/callback，新增 ?intent=<nonce>；发布时核对当前项目 redirect allowlist 覆盖此路径与查询。历史 docs23 的域名 ** 配置仅作指针，不代替发布时检查。参见[Supabase redirect 配置](https://supabase.com/docs/guides/auth/redirect-urls)。当前未改变生产外部配置。

本次日志为 .local/login-session-fix-{tests,typecheck,lint,build,integration,dev}.log，独立源码副本 .local/login-session-fix-validation/，使用 3139，未占用或停止其他任务的 3117。较早359项与商品未完成门禁记录均为历史；本次实际结果见 PROJECT_MEMORY 与 docs04 的2026-10-07记录。源码/本地正式服务证据不能作为生产迁移、发布、真实外部 OAuth 或实体多设备证据。

2026-10-07最终结果：376全量、31认证定向、16真实本地API+双浏览器组通过；TS、check:i18n3289键、正式后台生产构建通过，lint0错误/1既有导航warning。实际Chromium/WebKit三语四宽、单一表单、跨标签换账号与同账号新session、旧scope409、断网后原requestId重试、真实门店访问再撤销、持久Cookie新context恢复通过，四张当前截图已查看。9个API设备GET样本P50 54.39ms、最大63.72ms，非生产性能。合成账号/门店0且strictEnabled=true，清理/源码15文件与构建副本一致证据为fix-cleanup.json/fix-verification.json。所有前述未验证的外部/实体/云CI与生产发布限制继续保留。

收尾：本轮3139服务已停止且无监听，其他任务3117保持；合成资料清理验证已完成，独立副本与证据保留。

本次发布已安装兼容生产迁移 20261007131534，四表 FORCE RLS、匿名/客户端零新增DML与内部执行授权、runtime不能enable、缺记录0、enabled=false已核对。源SQL与原CLI候选20261006205638字节一致，仅按工具实际生产version对齐文件名。严格启用须在新应用上线核验后执行。

发布前补充反例：老板以UUID最前会话撤销自己的全部本店会话，原循环先撤销actor导致后续权限拒绝并503完整回滚。现先稳定序锁定全部父会话/校验版本，再先更改其他会话、actor最后；当前本店访问撤销回执让界面返回待授权，个人账号仍可用。独立本地三会话反例200、版本各+1、唯一审计1、门店403/个人200并精确清理通过，长期API/双浏览器增加此例。
