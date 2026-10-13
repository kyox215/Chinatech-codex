# Smart Switch lab4 原版界面与通用无线控制器

用户要求在原 APK 基础修改，保持三星页面。lab3 把默认 Launcher 和 Main 收发入口切到自有 UI，未满足此要求；lab4 恢复原 Launcher、欢迎／权限、原首页卡片、来源／连接选择，通用无线流程沿用实际原布局、主题、图标及控件。连接、二维码、目录选择、发送确认、两端进度及完成结果由自主控制器绑定真实目录与保存事实。不发布空 MainDataModel 成功事件，不伪造三星系统权限。原资源与 JNI 原字节保留。

## 协议与恢复

CTSS5/6：TLS 固定证书／双方核对 → 旧机准备已授权目录 → 新机选择类别／分页单项 → 旧机确认 → 流式传输 → SAF 关闭写入、重新读取 SHA／长度 → 最终清单与回执。目录和选择绑定随机会话、整体目录摘要和选择摘要；重连自动沿用同一冻结选择，变更目录拒绝继续，已保存对象重读验证后跳过。没有总 10000 项或批准后两小时上限；10分钟配对、操作超时、5次自动重连保留。未完成对象整项重传，无块偏移或进程死亡后自动恢复配对。

原生前台服务、通知返回、角色与会话代际隔离；新会话不继承旧完成状态。API33+ OnBackInvokedDispatcher 与旧 API 返回处理统一实际取消确认；取消关闭本助手任务、socket、相机和自动热点。原系统手动热点由用户关闭。实际权限结果读取系统授权；旁路原机型判定不等于系统特权。

## 范围

授权媒体／SAF文件、标准 VCF 字段与头像、日历 ICS／原字段、可见 APP base+split 归档。完成保存不代表图库／通讯录导入或APP安装。账户登录、第三方私库、聊天、短信／通话、保险箱、完整系统设置与三星专用备份还原没有实现。USB／SD／PC 和专用 iOS 迁移未接入该无线控制器。原 JNI ARM32/ARM64，min26；HarmonyOS NEXT 无 APK 安装。

两机均用 lab4。并存包 com.sec.android.easyMover.chinatech 可更新本站 lab3并存；com.sec.android.easyMover 只更新本站 lab1/2/3，同独立实验签名。不能覆盖三星官方签名或与原三星、旧 lab、ChinaTech独立助手混协议。公开分发基于用户明确许可声明，未独立审阅三星许可文件。

## 本轮验证

冻结最终两 APK 各 42761166B，code377304135／name3.7.73.4-lab4；SHA并存6115198b29ec3b67be59459ffca86a47f9804ef49b8e2baabbf2a5dbcc635a20，原包名9f68089caf3c694beeefcf200348727892307a4d167db48e6eab7e2bf5c72ce0。v1/v2/v3签名、ZIP16KB对齐、原资源／JNI逐字节比较通过。

Android16/API36 ARM64 两台专用模拟器、合成资料：最终APK原选择页四项选三项、源端原确认、2162690B真实传输与持久保存（源8／收17检查）；通知实际返回与真实系统BACK取消9；冻结目录篡改拒绝、断线自动冻结选择／最终回执恢复46。未改的子系统证据复用：原7布局实际inflation15、目录DB5、真实系统LOHS QR3。证据 .local/smart-switch-original-ui/native-verification.json、accepted-pair.log、runtime/accepted-states.txt／accepted-fault.txt，原完成页最终截图实际目视。配对资料传输使用现有Wi-Fi；自动热点加入／光学二维码、HONOR Magic8 Pro BKQ-N49／MagicOS11和所有实体品牌／旧API／ARM32没有实机验收。

状态注入用于前一会话残留反例；不冒称前一真实迁移。故障测试实际 Android TLS／SAF，结束等待按测试时钟缩短；不是进程死亡恢复。Gallery恢复、撤权等旧子系统证据不得扩张为本轮实体权限撤销。初轮界面绑定／动画初始化／返回键失败和修复证据保留在本轮.local。

## 交付与网站

交付/SmartSwitch原版界面-lab4-20261009 含两APK、自主源码ZIP、三语README、校验清单和最终截图。scripts/smart-switch-original-ui 提供自主构建／补丁辅助，只依赖授权本地输入；源码ZIP不含私钥、完整三星smali、其他OEM代码或测试APK。网站候选在 .local/smartswitch-web-release/source，公开卡优先原界面lab4，旧APK原字节保留，ChinaTech独立0.3下载保持。CI／发布／正式站下载证据另记 published-verification.json；本段原生验证不等于已发布。
