# Mi Mover 原界面与跨品牌接收研究

2026-10-09 用户要求研究小米／红米换机助手，并让 OPPO、Motorola、Samsung 等品牌可选择“这是新机”。随后用户要求继续完成跨品牌传输并上架工具箱。当前 lab2 已接通自主公开 Android API 传输与恢复，正在完成精确 APK 与正式发布验收；lab1 入口实验记录作为历史保留。

## 依据与原限制

[小米商店](https://app.mi.com/details?id=com.miui.huanji)／[Google Play](https://play.google.com/store/apps/details?id=com.miui.huanji)的官方方向是旧 Android／iPhone 到新 Xiaomi 设备。[官方操作说明](https://www.mi.com/global/support/article/KA-06961/)介绍旧机发送、新机接收。品牌以外还受 Android 系统权限、网络接口、存储和还原权限限制。

项目既有第一方商店样本 4.5.7.5，包名 `com.miui.huanji`，versionCode 45705，minSdk 21／targetSdk 35，36,846,932 字节，SHA256 `2e2b845f44fc99249de19c7801d7ce6aa67e31f3372ba54dc4f6d20782e25752`；本轮重新核对原字节，不声称所有地区最新。下载链与签名记录见 `.local/smartswitch-universal/research-oem/analysis/download-provenance.json`。官方证书 pin 未独立取得，第一方下载链和签名自洽分别记录。

`MainActivity.h2()` 根据 `miui.os.huanji.Build.l0` 隐藏 receiver、卡间距并改变卡组高度；l0 由 MIUI 系统属性产生，并非 OPPO／Motorola／Samsung 名称列表。原版实际运行在本轮 Google Android 16 模拟器，只显示 Old。receiver listener 本身没有再次限制品牌，正常进入 `SelectOldDeviceActivity`；非 MIUI 原代码已跳过小米 BACKUP／备份密码检查。

## 实际改动

原 `classes2.dex` 保留长度和布局：偏移 1996484 的 `sget-boolean v2, Build.l0` 改为同长度 `const/16 v2, 1`。DEX 正文仅三字节变化，重算 SHA1／Adler32；9,165 类反汇编比较仅 `MainActivity.h2()` 一处指令变化。没有把全局系统身份改成小米，没有修改权限、存储或传输判断。

Manifest 取消 `android.uid.backup`，标识为 45706／4.5.7.5-ct-lab1、`Mi Mover · ChinaTech lab`。两份独立实验签名 APK：原包名版和 `com.miui.huanji.chinatech` 并存版。并存版逐属性重新分配 provider authority 和所有自声明权限；类名与 authority 复用同一字符串时也不会误改类名。除自主 Application 子类入口外，原 Activity／Service／Receiver／Provider 类名保留。

新增自主 `ExperimentApplication` 继承真实 `MainApplication`、先调用 super，再通过公开生命周期回调给受影响的首页／旧设备类型页补中／意显示和无障碍名称。原程序不提供意语，且原 context 会忽略未支持语言，因此 API33+ 读取实际 app locale；API21–23 保留 `config.locale` 路径。英语保留原展示。仅原 View 标签适配，不新建首页或替换原连接界面；原资源表、布局文件、图片、native library 和其他原 DEX 保持字节一致。新增 classes3 仅三项自主类，无编译 stub。

自主实现：[原界面标签适配](../android/mimover-entry/src/main/java/in/chinatech/mimover/ExperimentApplication.java)。构建／定位／最小补丁在 `.local/mimover-universal/`，交付 ZIP 只选自主脚本及接口声明，不包含完整原反编译源码或私钥。

## 当前验证与交付

[交付说明](../交付/MiMover新机入口开放实验版-20261009/README.md)与 `VERIFICATION.json`、`SHA256SUMS` 是精确版本依据；工作证据 `.local/mimover-universal/verification.json`。

- 两份 APK 签名 v1／v2／v3、16KB ZIP 对齐、原 payload 全项比较通过；这不是 native ELF 的16KB对齐证明。原2,932 payload只有 Manifest/classes2变化，另加自主classes3。
- 精确并存 APK 在一台本轮独立 Android 16／API36 ARM64、Google／非 MIUI 模拟器，与不同签名原版同时安装。最终 APK SHA `4a8b16b0f6a297c46e485cf1aea32fa90690131bd9c920f01ae785d01eae06d0`，36,855,174字节。
- 13 项中／英／意实际双角色可见可点、新机→原旧设备类型、返回、冷重开及意语无障碍检查通过；代表截图已目视。原包名实验版仅构建／静态验证，没有在真机或模拟器安装；未为实验卸载官方版。
- 原接收路径实际通过原授权弹窗与旧安卓安装引导进入 HostActivity。原引擎出现热点配置读取 SecurityException、Wi-Fi 切换被拒，页面显示 Creating hotspot。这个失败来自早期入口候选，最终只改语言 helper，原传输引擎字节完全相同；不称最终已传输。
- 本轮没有网站代码／部署／数据库写入，旧公开下载不替换。ARM32、旧API21、实体 OPPO／Motorola／Samsung／Xiaomi／Redmi 等手机未验证。

初次并存安装的 DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION 冲突已定向修复，失败记录保留。最初意语配置被原 context 回落英语，已修正实际 app locale 读取并重新运行三语交互；没有放宽语言断言。

## lab1 原引擎限制与后续方案（历史）

原 `HostActivity.n3()` 要关 Wi-Fi；普通 target35 APK 在 Android10+ 不能这样切换，[Android 文档](https://developer.android.com/reference/android/net/wifi/WifiManager#setWifiEnabled(boolean))明确限制。`NetworkUtils.o0()` 在非 MIUI API30+ 明确返回 false；MIUI路径调用系统 settings provider，旧版本走私有 tethering 反射。开放首页不会改变这些真实依赖。迁移到[公开 LOHS](https://developer.android.com/develop/connectivity/wifi/localonlyhotspot)必须同时适配异步回调、真实随机 SSID／密码、原状态机、发送端发现／配对／网络绑定与取消释放，不能伪造热点成功消息。

`PermissionUtil.o()` 的非 MIUI集合主要是旧机读取权限，接收写入权限与数据还原能力还需逐类适配。并存版深层还有原更新 FileProvider、状态 provider authority／UriMatcher 与受保护广播名称的硬编码；当前只证明安装／入口，并未把原迁移协议与完整并存工作流称为兼容。

lab1 的后续步骤为公开网络与两端配对、真实类别选择、公共存储／联系人／日历写入及回执恢复；lab2 实现见下述当前方案，原小米私有迁移协议没有被称为通用。系统设置、私有应用数据、聊天、登录与系统备份不能靠重签或品牌修改获得权限。当前APK也不能安装在 iOS 或 HarmonyOS NEXT；保留的 Apple 卡是旧设备来源选项，不是 iPhone 新机接收支持。


## 2026-10-09 lab2 当前实现

原首页新／旧、旧设备来源、Host／Guest、Scanner选择、Transfer进度与Finish布局仍为实际原资源。新机自主监听直接进原SelectOldDevice，再进入通用Host，避免普通重签APK依赖私有BackupManager；原触摸动画的缓存点击与生命周期重新设置由自主监听接管，不伪造全局MIUI身份。旧机进入通用Guest，Apple卡明确同版两台Android限制。原UI资源配自主控制器，不对厂商数据模型注入空成功事件。

自主引擎以冻结 ChinaTech0.4源码ZIP为输入，44类重新命名空间到in.chinatech.mimoverengine，使用公开LOHS/WifiNetworkSpecifier/Network与SAF。自动热点、手动系统热点、同Wi-Fi备用，二维码、TLS证书pin、双方确认、长度／流式SHA256、关闭与持久SAVED回执／最终FINISH都保留。重连重验已完成对象，未完成文件从头，最多5次自动重连，无字节偏移续传。

接收后按预选范围恢复媒体库、本地联系人、指定可写日历与base+split系统安装队列；导入去重、用户编辑副本保留、部分／失败／仅归档分开。安装继续／跳过重新使用原session/token/CAS门禁，旧回调不能复活。私有应用数据、登录、聊天、短信通话、密码／受保护空间和完整重复日历未实现。源文件与已接收原件不删、不静默覆盖已有资料。

原Scanner真实类别、批量与单项、分页以及忙碌禁用从TransferStore共享索引读。ACK数仅来自已核对SAVED哈希的dedup投影，准备／重连数字不能算已完成；新机类目来自接收对象，不能用空发送目录显示。保存／恢复分别显示，合法最终确认前不能跳成功页，取消／残留／权限与安装继续有明确入口。前台通知回原控制器，角色与公开权限待续操作保存在私有状态。

Manifest取消旧厂商服务／广播接收器／provider入口（AndroidX初始化保留），只声明必要公开读写／网络／前台服务／系统确认安装权限；没有短信／通话／厂商备份特权。资源表追加0x6e三语字符串包（201词条），保持原ID和全局字符串索引，并改正56处授权标签；真实AndroidResources/Theme避免包装器导致自定义drawable用系统classloader崩溃。此失败、勾选busy漏指纹等初轮证据保留。

精确候选：4.5.7.5-ct-lab2(45707)，com.miui.huanji.chinatech，min26/target35，37,764,668B，SHA4607f469cd156d19a0d24e19608302ece2abe8bab4cc464e037d3a6e845dab9b，本站lab1同证书1b71b70b…efc75。v2/v3、ZIP16KB与6/6 ARM64 ELF16KB检查通过；相对lab1保留2930原payload原字节，变化仅Manifest/resources.arsc/classes3（原classes2仅lab1已核验双卡补丁）。自主583类含隔离ZXing，不含compile stubs／测试组件。source ZIP不含密钥、闭源反编译内容或原厂APK。

当前证据：`.local/mimover-universal-next/`（artifact/static/resource与tests）、[自主模块](../android/mimover-universal/README.md)。Android16/API36 ARM64两独立AVD合成资料验证，不使用真实客户数据。237条SQLite缓存／分页与回执、PinnedTLS、3对象2162690B两机真实网络传输／SAF字节、最终确认故障恢复、真实媒体／联系人／日历、系统base+split确认／取消已分别运行。500ms故障等待、权限由AVD授权、provider间隙注入等属于测试条件，不冒称生产真实进程死亡。原三语触摸入口、121条勾选／3页／忙碌、准备／重试不冒ACK与最终状态已通过；最终4607两端同签名覆盖安装、原页实际网络传输与SAF字节、121条分页重建、进度可见和本轮恢复统计绑定80项复验通过；此前未变引擎证据复用，19组去重3160项不能全部称为最终APK实跑。手动回退22项通过；有效热点IP选择因LOHS失败未实跑。精确范围以交付VERIFICATION为准。

OPPO/Motorola/Samsung/Xiaomi/Redmi等物理手机、旧API/其他ABI、光学扫码／自动热点加入未验证；支持通用公开API与没有品牌白名单不等于所有手机实测。正式入口与生产下载SHA由本轮发布证明核验；网站上线不能代替真机数据迁移。原厂程序依赖保留，不承诺完整原包无任何网络访问。


本轮LOHS有附近设备权限后仍实际返回SYSTEM_2，未称热点生成成功；手动热点QR、同WiFi网络已分别测试，光学扫码/自动加入仍待真机。原Host连接方式补公开本机IP候选核对（只有热点存活但地址未知才可用），无猜网关；Guest/Scanner更多操作补系统手动加入后发送，沿用原公开Network验证与TLS/配对确认。Web实际28双浏览器三语四宽及无JavaScript键盘激活完整APK下载/SHA与Range通过，正式发布尚待CI和生产下载验收。


最终原页面闭环修正：Scanner/Progress使用原phone header实际子树、单个44dp返回；分页previous栈保存，第三页重建返回第二页。Progress原纯装饰黑盖移除，原百分比标题按状态20sp、计数16sp、类别20sp显示，实际列表/停止原View保持；sender类目仅选择项、receiver仅SAVED投影。原系统像素截图确认可见而非只getText。接收Finish/Details只把本轮ready+directory对应completion恢复统计作为当前结果；自动关闭/旧任务统计不匹配显示‘本次无对应恢复结果’。QR读取中/失败反馈回原Guest，输入码明确来自新机；原数据/恢复写入及安装CAS不改。

旧候选PR40的2ac23d完整CI37921809538成功，期间正式main新增Smart Switch lab4。MiMover发布必须融合最新main并以最终APK、最新CI和正式下载为证据，旧候选CI不冒称最终发布。物理品牌/光学扫码/自动加入范围仍保持待验。
