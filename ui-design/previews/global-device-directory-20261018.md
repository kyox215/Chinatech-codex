# 全局基础设备目录 · 2026-10-18

用户批准完整计划并要求实施、最终上线。本候选从 main5df50ad4106e74379a4397c9cb424801229689a5 独立分支 `fix/global-device-directory` 实施；此记录不提前宣告应用发布或远程 CI 通过。

基础品牌型号以公共、只读、无 Auth／门店范围的版本快照读取。仅公开既有 `CatalogPickerModel` 12字段：id、category、brand、family、name、releasedAt、year、network、platform、modelCodes、aliases、status。私有源 catalog、成员、工单、价格、供应商、客户、历史、自定义不在投影中；历史原文由调用方原 owner 本地合并。私有管理 `catalogScope`、授权、apply／rollback、幂等回执及原 RLS 保持。

复用 Figma 原文件 nhZ37YLOUVP8zpDBBGihhS 的手机品牌15322:210106、型号浏览210151、主动搜索／手填210197、错误／重试210262及原Input5103:498／Buttons12001:63570；全部是原 `DeviceCatalogControl`／`SearchCombobox`、windowing、系列、元信息与 feedback，未改CSS／主题。背景更新失败在同一 footer 使用三语消息保留缓存候选，不新增视觉控件。新建维修继续 button 默认不唤输入、主动搜索才键盘、显式确认／取消保原值；其他桌面和既有档案编辑契约保留。

公开接口：`GET /api/device-directory/manifest`、`GET /api/device-directory/<version>/package` 和 `GET /api/device-directory/<version>/<category-brandhash>`。manifest 为格式1／revision／version／分片数量与SHA；package 包含 exact manifest text 与 exact shard text。首用实测56片／3476型号，SQL fixture 未压缩 shard918183B、package1078144B，因此冷启动采用2GET而不是56片并发3的19轮；后续按 hash 增量、并发最多3。完整 schema／12字段／全量数量／SHA／64MiB总量通过才切换，禁止3000截断。固定版本一年immutable；manifest客户端5分钟TTL、CDN60秒无SWR，通过合格focus／online／visible／打开控件检查，无轮询。下一次合格事件可能再有至多60秒edge缓存，不承诺休眠期间5分钟更新。管理成功／重试force reload且与当前读合并。

新表 versions／shards／pointer 位于原 private schema，runtime仅SELECT；两个SECURITY DEFINER函数无直接runtime／anon／authenticated EXEC、空search_path、全限定名、无动态SQL。control revision真变更的trigger同事务生成完整快照、最后移动pointer；旧版保留，故障回滚source／revision／version／pointer，noop不建版本。根独立核迁移后旧58relations／37fn／98policies／18triggers及3476行、control、1店1成员保持；生产revision1版本a0d810201d3100b48e5052ea3b875ac94fa876a477018216e775f7b1e4ecfbaa、56片，迁移已应用但应用未部署。本实施者未执行生产数据库操作。

实际验证（本轮本机 Node24）：

- 新单元11／11：3476全量／56片、严格白名单／SHA／计数、storage首读loading、忽略abort／stalled body总截止与迟到不收、后台保旧／限频／合并、增量并发3与原子切换、2→1倒退／同revision冲突、force合并、失败retry、IDB超时abort／写序列／跨tab旧写保护和memory降级。
- 全部 npm test 600项：599通过，1项明确 PowerShell runtime unavailable，不能证明Windows执行。typecheck／i18n通过；lint0错误，1条原有 `lib/backend/client.ts:55 window.location.assign` warning，本轮不改该文件。
- 本地实际Postgres：127.0.0.1:55422/postgres；在单个BEGIN／ROLLBACK内应用迁移和3476fixture，12字段完整parser＋SHA、私有marker排除；runtime匿名只读成功、source RLS仍空、写与直接函数／anon-auth直读拒绝；noop／旧版保留／disable与restore发布；注入shard失败原子回滚。原空catalog／control revision／新表不存在恢复。postgres已有ADMIN但SET=false，测试仅事务内授SET随后随事务回滚。脚本 `tests/device-directory.sql.mjs`，不重置库、不启动DB。
- 实际 React 浏览器：24／24，Chromium与WebKit；既有三语×1440／1024／390／375、windowing／44px／16px、品牌与型号／系列／代码别名／手填／取消／旧档案编辑／签名失效。各层30组可信原生事件绘制p95：Chromium品牌60.7ms、系列32.6、型号33.3；WebKit品牌约33ms、系列／型号约32–33ms，0目录GET。实际满足用户100ms目标；旧测试硬断言仍200ms，不能称已新设100ms门禁。
- 原生IndexedDB／冷10秒／retry／匿名无cookie-scope请求：6／6，两引擎。缓存reload无需目录GET、完整3476就绪；此项是目录cache，不是表单正式草稿恢复。
- 原UI反馈CI39076452532仅有waitForURL30s失败，artifact服务器三次destination200无具体错误。本机原脚本与改后均Cr／WK通过，未复现根因。仅维护测试：先等gated RSC实际交付和真实导航，再移除route；delivery同样30秒有界，保留waitForURL/load断言并新增currentURL／response／requestfailed失败诊断，没有产品NavigationLink变更，不声称已证明CI故障原因。
- 实际Next production runtime3198（公开packaged reference数据）HTTP成功：manifest／package／shard全量3476、Cache-Control／CDN头、伪cookie／authorization／scope／query不影响body、无Set-Cookie／Vary Cookie、未知版本404no-store。不是正式DB实连成功，也未测Vercel edge HIT。
- 最终Supabase-mode生产构建成功，BUILD_ID `prYXQzkbrLWpiiGrMMPWN`；next-env与原Git完全相同。正式CSS16契约／11assets，两顺序双引擎通过，无CSS修改。实际formal runtime3199使用既有loopback，迁移测试回滚后无snapshot schema，返回及时503/no-store／无Set-Cookie，证明不走seed fallback；不能将该负例当全量正式API200。

成功图 `.local/device-directory/previews/preview-webkit-375-apple-iphone16.png` 是真实375WebKit／preview合成资料，Apple与iPhone16已选、focus button无editable／spinner；已目视。根另在本机Chrome375通过演示登录→新建→Apple→型号默认面板→主动搜索→iPhone16确认独审。

限制：未使用正式用户登录、未创建生产订单，实体iPhone软键盘／正式私有草稿恢复／跨设备业务刷新／弱网压力／Vercel CDN命中仍未验。原preview `useDeviceDraft` 只在formal snapshot才建scope，本机preview刷新为空为既有明确限制。尝试productionUI preview-session因原NODE_ENV保护404的RED保留，没有绕登录保护或假报全production UI。初次候选本机交付时远程CI尚未开始，本地绿不代替发布绑定或CI门禁；后续CI与定向修订见下节。根负责最终独审／生产发布与回填。

## CI 语言用例的手机断言适配

PR39115068830与push39115032965均实际结束为771通过／1失败；唯一失败是WebKit手机 `i18n.spec.ts:147` 对真实button调用 `toHaveValue`（Not an input element），根独立CI AX已见品牌Apple／型号iPhone16／SN保留。不是产品值丢失证据。源码owner先以原测试复现同一RED并保存本机trace／原日志，再仅适配同用例的品牌与型号两处断言：沿既有 `expectCatalogValue`，桌面input仍验value、手机button验canonical data-value并额外验可见文字；增加最终保存／刷新后brand=Apple与model=iPhone16断言。原客户自由原文、语言切换草稿、SN、canonical类别／优先级／故障／服务、签署阅读语言、保存与详情刷新、90秒timeout全部保留，未改产品／workflow／CI门禁。

修后定向Chromium／WebKit两项完整闭环2／2通过（7.5秒），目标文件ESLint及typecheck通过。原RED与修后JSON／trace位于 `.local/device-directory/i18n-original-red-*` 与 `i18n-adapted-*`。13个runtime SHA保持原freeze，正式构建无变化；仅测试与本记录修订，完整新CI仍待根push后实际运行，不把定向绿冒全CI通过。
