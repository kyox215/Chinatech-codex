# ChinaTech 助手 0.3：通用安卓迁移研究与实施

日期：2026-10-09。目标是让支持 APK 的主流 Android 手机可以双向迁移可公开读取的数据。此次完善的是自主 `in.chinatech.phoneassistant` 客户端；不修改其他品牌身份，不复用客户账号或上传手机内容。0.2、Smart Switch lab3 已冻结的交付保持原字节。

## 研究证据与借鉴

| 工具 | 本次采用的证据 | 借鉴和落实 | 不可推导的能力 |
| --- | --- | --- | --- |
| Samsung Smart Switch | 项目已有接收入口、二维码和系统权限审计；[官方资料范围](https://www.samsung.com/uk/apps/smart-switch/) | 旧/新机分角色、分类选择、接收与还原分别核对；复用本项目自有 lab3 桥中的公开连接实现 | 三星原生特权、全部APP内部数据库、非三星完整恢复 |
| HONOR Device Clone / Huawei Phone Clone | 10-08下载的代表APK、定向JADX输出，10-09重新校验原SHA；[荣耀官网](https://www.honor.com/global/tech/clone/)、[华为使用说明](https://consumer.huawei.com/en/support/content/en-us15915342/) | 真实SSID/密码、系统Wi-Fi连接确认、双方同客户端；不给二维码生成增加本机MAC前提 | 各品牌二维码/私有握手互通；新接收手机普遍开放；隐藏空间自动访问 |
| Xiaomi Mi Mover | 官方商店样本4.5.7.5；实际 `ConnectNetworkUtil` 输出；[官方说明](https://www.mi.com/global/support/article/KA-06961/) | NetworkCallback的单一所有者、重复申请前清理、明确旧/新角色 | MIUI系统设置provider、backup共享UID权限移植 |
| OPPO Clone Phone | 16.6.0公开镜像样本、P2P/Wi-Fi connector输出；[官方流程](https://www.oppo.com/en/newsroom/stories/transfer-old-data-to-new-device-with-clone-phone/) | 配网成功与传输服务端认证分开；自动失败时保留手动模式 | Oplus隐藏API或OPPO/OnePlus所有版本内部协议等价 |
| vivo EasyShare | 7.1.1.7_ex_gp镜像样本的LOHS/连接回调；[官方网站](https://easyshare.vivo.com/) | 在真实 `onStarted` 后读取公开热点reservation；停止时释放 | 厂商反射热点重载、高权限在通用包仍获授权 |
| LocalSend | [公开协议v2.2](https://github.com/localsend/protocol) | 局域网不依赖外部服务，发现失败需要备用入口；此次保留QR/同Wi-Fi，不把组播作为强制前提 | 本助手已与LocalSend互通；其文件分享等于通讯录/APP恢复 |
| Syncthing | [BEP官方协议](https://docs.syncthing.net/specs/bep-v1.html) | 内容摘要、持久任务状态、完整接收与最终核对；块级恢复列为后续独立协议升级 | 当前已具有Syncthing块级续传/双向目录同步 |

共复核既有7个APK样本（5厂商品牌家族、含1个仅安装引导器），不是本轮重新下载所有最新版本。小米与华为完整样本有第一方下载链；荣耀、OPPO、vivo完整样本来自镜像，签名自洽不等于第一方证书pin已独立认证。原反编译源留在 `.local/smartswitch-universal/research-oem/`，不打入交付、不复制闭源实现。当前逐包SHA与定向文件指纹：`.local/android-assistant-v3/research-verification.json`。

## 本轮实际实施

1. 将项目自主 lab3 桥连接逻辑接回独立 ChinaTech 包：收/发角色入口；公开自动热点、手动系统热点、同一Wi-Fi；Camera2实时扫码与图片码；实际DHCP/网关和返回Network的专属socket。发送端可显式选择已有Wi-Fi，避免厂商拒绝WifiNetworkSpecifier时反复申请。QR不要求本机MAC，不写死热点IP。
2. 原生AndroidKeyStore签名修复、限定临时TLS身份、严格pin/secret/双方核对；结束确认FINISH、重读进度心跳和完成回执恢复。采用CTSS3/4，与lab3自主桥共用线格式；旧ChinaTech0.2需要双端升级，不与原厂客户端混配。
3. 权限弹窗期间保存本次扫描选择；未知状态不开始扫描，重复回调不重放。联系人/日历私有导出在准备、逐对象及数据块发送时重新核验读取权限；手选VCF/ICS继续使用自己的SAF授权。发送快照保留真实类别。
4. 逐联系人读取系统标准VCF，保留系统实际提供的结构化字段、类型、地址、组织、备注、生日、头像等；固定缓冲与逐人暂存核对，失败计为部分覆盖，基础回退名为contacts-partial.vcf。系统未提供的字段不猜补。接收后打开系统联系人导入器，需核对目标账号、重复项和实际导入结果；没有虚报自动导入成功。
5. 新增明确确认的图库导入：从当前接收目录的已校验回执复制到MediaStore，关闭后重读字节数/SHA再公开。按内容hash/size/MIME建立独立端上账本。创建意图先记账，插入后补URI，重启核对唯一创建标识；公开状态另设publishing阶段。已公开/修改/未知副本保留、报待核对；只可清理实证仍未公开且属于本助手的失败项。收到文件与图库导入分开计数。原收到的文件不删除。
6. 修复批量选择期间单项取消看似生效但未落入发送清单的问题：忙碌时恢复真实选择，批量结束按数据库回读，缺失行/写失败不假报选择成功；实际界面点击与数据库一致性25项通过。
7. 本机能力说明、三语新状态和恢复说明。自主APK无JNI和厂商so，不限定ARM包；最低API26、目标37，仍需各API/设备实际测试。核心不需要GMS；API与公开接口决定行为，不按品牌名放行高权限。

图库旧Android8–9没有IS_PENDING保护，复制中项目可能在图库可见，失败后保留并要求核对；不自动删除曾公开副本。共享存储/provider可能裁去位置元数据；现版本未请求ACCESS_MEDIA_LOCATION，不承诺保留未获授权的GPS字段。图库使用独立ChinaTech相册目录，不恢复旧相册完整分组或编辑历史。多次扫描、目标删除/编辑、云同步可能产生新的业务对象；内容指纹只避免本助手同内容同MIME的重复图库复制，不合并个人已有图库。

## 兼容目标和平台边界

| 范围 | 方案 | 当前证明 |
| --- | --- | --- |
| Samsung / HONOR / Xiaomi、Redmi、POCO / OPPO、realme、OnePlus / vivo、iQOO | 相同ChinaTech两端、公开API、按权限范围扫描、网络回退 | 机制覆盖，品牌真机待验 |
| Pixel / Motorola / Sony / Nokia / ASUS / Nothing及其他标准Android | 同一公开接口、纯Java核心、多ABI可安装 | 无品牌白名单；真机待验 |
| Huawei EMUI / 提供Android APK运行时的HarmonyOS | 无GMS依赖，核对真实API和provider | 机制规划，HMS和地区版本真机待验 |
| 原生HarmonyOS NEXT无APK运行时 | 需独立HAP客户端和同一中立协议 | 本APK不适用 |
| Android 8–9 | 本地热点或系统手连；旧存储权限；图库发布降级 | min26构建成立；旧API真机未验 |
| Android 10–12L | 系统Wi-Fi申请、分区存储和SAF | 代码适配；实机未验 |
| Android 13–14 | 附近设备、分类媒体、通知和部分照片授权 | 代码适配；部分照片需真机验 |
| Android 15–16 | 真实设备通信FGS；网络/文件分开恢复 | 当前原生测试用Android16 ARM64模拟器 |
| Android 17 / target37 | 显式局域网授权；拒绝时停连接 | 已声明/请求并编译，API37运行未验 |

[Android公开热点](https://developer.android.com/develop/connectivity/wifi/localonlyhotspot)、[Wi-Fi请求](https://developer.android.com/develop/connectivity/wifi/wifi-bootstrap)、[MediaStore共享媒体](https://developer.android.com/training/data-storage/shared/media)、[局域网权限](https://developer.android.com/privacy-and-security/local-network-permission)决定普通APP可实现的范围。拒绝一类资料授权不阻止手选其他文件；已授权照片子集不叫整库。源权限撤销需要处理后重扫/重新配对，不能由缓存导出绕过。

私有APP数据/登录、微信WhatsApp聊天、SMS/MMS/通话记录、保险箱、工作空间、密码/2FA和安全硬件密钥仍通过各自官方迁移。APP当前传base与原设备已安装split的自定义归档，不能保证适配目标ABI/密度/语言，更不能视为已安装；目标商店重装/登录优先。日历重复规则原字段已归档，自动恢复尚未实现。

## 后续完善顺序与验收

1. 接收后的完整联系人直接导入：目标账号选择、稳定来源与内容映射、逐项回执和失败恢复；避免按姓名自动合并。这是独立数据写入模块，当前系统导入器仍显示结果待核对。
2. 应用安装：包名、签名、minSDK、ABI和全部必需split核对，PackageInstaller系统批准与真实结果；不兼容转商店，不补造APP私库。
3. 大视频块级恢复：版本化清单/块SHA、provider可seek探测、原子检查点与中断重读；当前只具有完成对象跳过，未完成对象从头传。
4. 原始相册目录/拍摄时间、选授予GPS保留、完整循环日历还原；保留原字节与未知值，云原件下载另行确认。
5. 实机矩阵优先HONOR BKQ-N49/MagicOS11↔Samsung，再Xiaomi↔OPPO、vivo↔无GMSHuawei、旧API26/28→新API34/37、ARM32→ARM64，并测双方向、拒权、部分照片、弱网、VPN/访客隔离、低空间、锁屏和进程死亡。

本轮验证入口：`scripts/android-assistant/build-v3.sh`、`test-v3.py`、`build-runtime-tests.py`、`run-runtime-tests.py`。原生测试均用独立APK、合成资料和项目专用AVD，没有客户手机/客户资料。最终结果在本轮VERIFICATION.json记录；本文件的机制矩阵不是全品牌认证证书。

最终冻结APK SHA256：`0326b05ad69263ef5ca787de4b7658180f3fdf9af7dbf36b03456f6afa420da2`。Android16/API36双ARM64模拟器216项通过（实际LOHS二维码生成、TLS、3文件2162690字节、SAF重读、最终回执、Camera2帧、角色/重建、勾选、MediaStore、ContactsProvider）；204 JVM检查、161键三语。两端自动加入热点、光学扫码、系统真撤权和真机全部待验；配对文件实测走现有Wi-Fi真实Network，不能把热点生成推为全自动热点传输已经验收。故障等待夹具缩为500ms，正式180s。图库阶段恢复为状态注入，未实施真实进程杀死。完整对象恢复已实现，字节偏移续传未实现。
