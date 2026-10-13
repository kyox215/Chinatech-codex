> 历史拒绝方案：用户已明确只解原版限制，本lab2自有引擎已撤下，不作为原版补丁使用。当前方案见../mimover-original。

# Mi Mover 跨品牌传输 lab2

本模块保留 Mi Mover 4.5.7.5 原首页、设备来源、连接、资料选择、进度与结果布局；传输与恢复使用自主公开 Android API 引擎。支持 Android 8 及以上两端选择新机／旧机，没有厂商品牌白名单。两端必须使用同版 lab2，不能与官方 Mi Mover 或本站其他传输通道混配。

实际范围：授权媒体与 SAF 文件／目录、系统可导出的通讯录 VCF、普通 ICS 与原字段、可见应用 base+split 包。接收并关闭文件后保存逐文件回执；成功结束再按预选范围恢复媒体库、本地联系人与指定可写日历，应用由 Android 确认安装。失败、部分、仅存档与已存在分别记录。没有应用私库、账号登录、聊天、短信、通话、受保护空间或完整重复日历迁移。

连接支持公开本地热点、手动系统热点与同一 Wi-Fi；二维码携带临时凭据，核对双方确认码后才读取所选文件内容。保持权限、TLS pin、长度／流式 SHA256、关闭与持久回执检查。普通新文件不再整文件重读；中断后的已有文件恢复仍核验。没有字节偏移续传。

源模块包括自主引擎、资源与原布局 ID 适配器、compile-only 接口声明、许可证；声明不打入 APK。没有私钥或闭源反编译源码。原资源表保留原 ID／全局字符串索引，追加0x6e三语包及修正权限标签；原布局、图片和 native 以及原 DEX 保留（classes2 仅历史双卡入口补丁）。旧厂商服务／接收器／provider 禁用，新的自有服务接回真实原页面。

验证与限制以 [兼容研究](../../docs/mimover-universal-compatibility.md) 和精确交付 VERIFICATION 为准。模拟器、协议和网站下载不证明 OPPO、Motorola、Samsung、Xiaomi 等真机兼容。

## Italiano

Il modulo conserva i layout originali Mi Mover e usa un motore autonomo tramite API Android pubbliche. Android 8+, stesso lab2 su entrambi i telefoni, scelta nuovo/vecchio senza lista di marche. Trasferisce solo dati autorizzati; ripristino di media, contatti locali e calendario scrivibile, installazioni con conferma Android. Dati privati, accessi, chat, SMS, chiamate e ricorrenze complete non supportati. Hotspot automatico/manuale o stessa Wi-Fi, TLS e conferma su entrambi i telefoni. I test su emulatori non certificano telefoni reali.

## English

This module keeps original Mi Mover layouts and uses an independently implemented public Android API engine. Android 8+, the same lab2 on both phones, new/old roles without a brand allowlist. Only authorized data is transferred; restoration covers media, local contacts and a writable calendar, with Android-confirmed app installation. Private data, logins, chats, SMS, calls and full recurring calendars are unsupported. Automatic/manual hotspot or the same Wi-Fi, pinned TLS and approval on both phones. Emulator tests do not certify physical phones.

## 重建输入

`python3 android/mimover-universal/scripts/build.py` 使用本项目隔离工具链（JDK21、Android API37/build-tools16）、已冻结并存lab1 APK与项目私有签名目录。构建脚本只包含自主转换/打包逻辑；基线APK、Android工具链、证书/密码和全部本地证据不在源码ZIP内。`HostR` 是该精确4.5.7.5资源ID映射，不能盲目套用于其他厂商版本。先提供同SHA基线再重建，脚本会拒绝不同输入；自行签名的APK不能覆盖本站签名版本。
