# Windows 工具箱：检测候选与自动升级边界

## CMD 启动错误修复（2026-10-07）

用户报告文件校验失败后中文被 CMD 当作命令。重新下载原 preview.1 完整 ZIP，在指定 Office-Test-20261007 当前用户下实际启动成功并正确识别 ARM64；原截图那份包的哈希/解压位置尚未核验，不能把失败归因于架构或声称完全复现。preview.2 将 CMD 改为纯 ASCII、单次 UTF-16LE EncodedCommand，中文反馈由 PowerShell 解码；缺少 PowerShell 时 TYPE 多语文本。环境路径/签名/身份失败与文件完整性失败分开显示，保留同字节哈希、微软签名和身份检查，自动升级仍关闭。新增真实 Windows CMD 回归覆盖三语、437/936 代码页、中文/空格/!/&/括号/单引号路径、损坏/缺失入口、损坏清单及缺失 PowerShell；运行结果在交付记录补充。

2026-10-07。用户选择下载启动器、核对后确认一次，覆盖 Windows 7／8／8.1／10／11、Home／Pro 和部分不受官方支持的老电脑，接入 AveYo 与 nminhducit KMS 本地模拟，升级 Windows 11 Pro 并保留文件、应用与设置。

## 当前实施

**公开检测入口准备发布；执行／恢复驱动已接入，完整一键升级尚未开放。**

- 新增公开 `/toolbox/windows`、分类入口、三语说明、实际 ZIP 下载、源码与校验清单。SSR 核心内容和下载在关闭 JavaScript 时可用；实际旧版 IE／Edge／Chrome 未验。
- 包含三语 CMD、UTF-8 BOM／CRLF PowerShell、固定 release.xml 与 README。CMD 校验核心 SHA256，核心校验 release.xml。完整性／缺 PowerShell 提示三语；CMD 仅调整当前控制台 UTF-8 代码页，无持久配置修改。
- 只读识别 OS、原生架构、安装语言、空间、供电、待重启及部分加密／IFEO 冲突。路径仅为候选，不证明兼容；缺信息显示未知。加密／未知恢复条件保守停止，密钥不上网站。
- `inspection-only`、空 verifiedRoutes／media、编译关闭的执行门禁及构建器要求真实证据才允许开放升级。修改 XML 或 CLI 不能解锁。入口不请求 UAC、不下载第三方代码、不激活／转换／安装／重启、不设置绕过／任务、不上传设备信息。
- 已接入 workflow 驱动：受保护 ProgramData 目录、Admin／SYSTEM ACL、DPAPI 与 HMAC 检查点、固定同一字节启动／UAC／恢复 loader、同账号 InteractiveToken 任务、实际 DISM 版本核对、只接受 C1900210 的保留扫描、明确重启后核对及终态清理。未知激活／转换结果不重复写入。
- 构建器绑定源码和完整目标／阶段顺序／媒体／上游政策 SHA，要求每条路线真实 Windows 与独立审查报告；本轮只允许将来已验 Win10／11、同语言 x64 ISO 和 Setup 硬件扫描。7／8／8.1桥接、Home原生产品密钥流程及不支持硬件绕过仍未完成自动化验收。
- KMS 原始脚本不打包；执行候选核对固定原始 SHA 后变换成 Windows-only：关闭 Office／R2V／vNext，删除14处Office KMS写入及Office服务清理，变换SHA固定。已有Office／相关授权配置或Hook冲突会停止，已有有效Pro授权保留。中断后的Hook／IFEO／Defender残留尚无原生恢复证据，失败停止并保留诊断不能称安全回滚。

## 固定来源与限制

| 来源 | 固定版本 | 当前角色 |
| --- | --- | --- |
| AveYo/MediaCreationTool.bat | `2f1f304652175d1d8c9a3a2f8eff6bb0ff881b13` | MIT；仅引用，未执行 |
| nminhducit/KMS_VL_ALL_AIO / KMS5.2.cmd | `bb8988973d82a9b39d54516dbb35b1c338dba5f5` | 分发许可未明确；不镜像／打包／执行 |

完整 SHA256 在 release.json 与公开 checksums.json；实际下载的审查副本在 `.local/windows-toolbox/upstream/`，未包含于用户 ZIP。

AveYo 当前最高11_23H2；auto会写兼容性绕过，启动setupprep后退出不证明完成。目标26H2配置依据微软下载页，本轮已校验官方 en-US x64 26H2 ISO（SHA bd4307df…），WIM index6确认为Professional／10.0.26300.9457；没有Windows保留升级证据，不把媒体下载算安装完成。

KMS原版 `/m /w`仍写临时授权DLL、IFEO和Defender排除，清理可能影响已有Office hook。候选已去除明确Office分支并加入快照前检／后检；不能仅凭/w或合成断言保证Office无影响，中断恢复尚需真实Windows验收。已有有效授权应保留；激活不是Pro转换，也不是有效或永久许可证；升级后需实际核验目标授权。

## 必须完成的后续工作

本轮在项目内建立全新可丢弃测试环境；未启动用户原有暂停虚拟机。Docker x64仿真两次因全局内存退出，正在准备本机独立QEMU；尚无实际Windows升级证据。以下未完成项不是仅等待打开开关：

1. 建立按OS／版本／架构／安装语言的媒体与真实路径。7 SP1／8.1核验10中间阶段，8先核验8.1，Home单独验证实际Pro转换。x86、跨架构、N→非N或不能保留应用停止。
2. 实现完整媒体读取、受保护工作目录、版本转换／桥接、激活冲突前检及中断恢复；每阶段先由实际Setup确认保留文件和应用，不假改EditionID、不改成清空安装。
3. 实现确认后自动重启／续跑驱动及防篡改状态；续跑重新核对实际系统、身份和哈希，失败保留诊断与Windows.old。未知结果不重复执行激活／转换。
4. 硬件绕过只覆盖已验证可绕过项，不能忽略运行能力、驱动／应用／数据保留阻塞；加密恢复条件在本机核验，不上传秘密。
5. 可回滚Windows环境逐路径验证样本文件SHA、应用启动、设置、Office授权保持、安装中断／重启／回滚。每条路线证据绑定源码、媒体、语言、硬件及独立审查；Mac parser不能代替Windows／PS2验收。
6. 只有有完整驱动和相应Windows证据的路线才能构建verified包。通过项目门禁后核对最新正式main再发布，不能混入根目录其他任务。

## 当前真实验证

- Node全量384项通过；Windows专项6项不跳过，实际macOS PowerShell7.6.6 parser覆盖核心与三个loader，61个架构、路线、加密、供电、空间、保留退出码、文件缺失／篡改和门禁反例断言通过。
- ZIP／源码／下载响应／清单逐字节SHA一致，生成源fingerprints约束重建。不会动态执行main分支或分发第三方脚本。
- Windows页面Chromium／WebKit三语四宽度28项通过，含实际下载、无JS、刷新／导航、44px目标和无横溢；桌面中文和手机意大利语截图已查看。不是实际旧Windows浏览器或实体手机证据。
- 独立复核修正CMD反斜线、三语提示、ARM64仿真识别及IFEO提示，无新阻断；执行门禁保持关闭。
- 严格TS、i18n与正式模式构建通过；lint零错误、一个既有导航warning。Office回归因另一任务新页面／测试与隔离副本不同步，原失败证据保留；同步页面及明确教程依赖后原断言全部通过，最终34项（Windows28＋Office6）双浏览器通过，未修改Office源码或测试。
- 无Windows安装／激活／转换，无部署、推送、生产业务／认证写入或外部消息发送。所有证据位于 `.local/windows-toolbox/`。
- 最终生产构建在隔离本地3151复核：双浏览器HTML显示的ZIP哈希、实际包、6文件及清单完全一致，0 JS错误。1440×1000匿名Chromium单样本DCL31.7ms、load52.4ms、10资源／314011B，首次加载不请求ZIP；无弱网，不是线上或旧Windows性能保证。本任务3151服务已停止，其他服务未动。

## 2026-10-07 执行驱动集成验证

Mac真实PowerShell77 launcher／126 workflow断言、8专项Node通过；包括源码／政策漂移、媒体／身份／版本不符、HMAC篡改、只读verifying恢复、第二resume未取得锁不得清理active任务。原生低权限文件／DPAPI／task反例已写但尚未Windows运行；不能当实际Windows证据。独立专项复核确认当前inspection公开可达路径无未修复阻断，已修复未取得锁仍清理恢复任务的P1及报告未绑定完整政策的缺口。

最新main167b766隔离候选保留登录设备上线功能；386项Node、3365三语键、严格TS、lint0错误1既有warning、正式Supabase-mode构建及34匿名双浏览器（Windows28／Office6）通过。下载制品需要最终构建HTML／ZIP／文件hash复核后发布；无生产业务／认证写入，无Windows安装／激活／版本转换。证据仅本项目`.local/windows-toolbox/`。
