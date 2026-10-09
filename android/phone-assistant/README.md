# ChinaTech 手机助手 0.3.0-alpha

Android 8及以上的自主跨品牌测试版，两台手机均安装此版。可覆盖本站ChinaTech0.2（同包名/同候选证书），原扫描数据库路径保留；首次打开重新选择收/发角色。旧0.2配对码需重新生成。保留旧手机原件。签名仍是项目候选证书，不是厂商预装身份；没有Google服务依赖或JNI架构白名单。

1. 旧机选择发送，扫描授权资料，按类别/分页勾选；手选文件/目录亦可。不设10000总项或批准后的2小时上限。
2. 新机选择接收，授权本地保存目录，创建自动热点和二维码；旧机实时扫码，按系统确认加入。Android8/9在系统Wi-Fi设置加入。
3. 自动热点被拒绝时，在新机开启系统WPA2热点并填写真实SSID/密码生成码，或让两机接入同一Wi-Fi。旧机自动连接被拒绝时，可选“已手动连接Wi-Fi，发送所选资料”。不要在网页输入配对码。
4. 两端核对并批准，等待文件关闭、重读SHA256和最终回执。已完成对象在同任务/同目录重新核验后跳过，未完成对象从头传；5次自动重连后需处理问题，没有字节偏移续传。
5. 接收后可明确确认导入照片/视频到Pictures/ChinaTech或Movies/ChinaTech；独立账本核对重复副本和未完成创建，公开/修改/未知副本不删除。已收文件保留。
6. 通讯录用系统标准VCF，保留其实际提供的多卡/字段/头像；失败时标部分和基础回退。系统通讯录导入需另核对目标账号、重复项及实际结果。APP是base+原设备split归档，未实现安装；重复日历原字段保留，未实现完整恢复。

验证：Android16 ARM64两台专用模拟器216检查（3文件2162690字节、实际自动热点QR、TLS、SAF重读、最终回执恢复、Camera2帧、页面重建、实际MediaStore与ContactsProvider）；204 JVM检查含10017清单、多卡流式与固定内存、取消/权限策略；另25项实际选择界面/数据库一致性检查包含在216项原生检查内。照片光学扫码、HONOR BKQ-N49/MagicOS11及其他品牌/旧API/ARM32/x86真机、锁屏持续运行未验。权限拒绝的发送保护用Context策略注入，不是实际系统撤权测试；最终回执等待测试缩时500ms，生产180s。

边界：系统提供者可能隐去GPS位置；不恢复完整相册分组/系统显示日期或APP内部数据/登录、聊天、短信通话、密码、保险箱、工作空间、安全密钥。Android8/9图库写入需存储写权限，部分副本可能在复制中可见。原生HarmonyOS NEXT无APK运行时不适用。拒绝/部分授权/未完成范围不得称全机迁移。先用少量可删除的测试资料核对新机，再传个人资料。未取得全品牌认证。

## Italiano

ChinaTech 0.3.0-alpha autonomo per Android8+. Installa questa versione su entrambi, scegli Invio sul vecchio e Ricezione sul nuovo. Scansiona/seleziona dati autorizzati; scegli cartella locale, crea hotspot e scansiona QR live. In alternativa usa hotspot WPA2 di sistema con SSID/password reali oppure stessa Wi-Fi e invio dopo connessione manuale. Conferma su entrambi.

Trasferimento cifrato, originali conservati, SHA256 riletto e ricevuta finale. Nessun limite totale di file o durata approvata; 5 riconnessioni, incompleti da zero. Importazione Galleria separata con journal; copie pubbliche/modificate conservate. VCF di sistema mantiene campi/foto effettivi e più schede, ripiego parziale segnalato; importazione rubrica da confermare. Archivi APK base/split non significano installazione. Chat, dati privati, SMS/chiamate, password e spazi protetti richiedono migrazioni proprie. API/telefoni reali delle marche non certificati; HarmonyOS NEXT senza APK escluso. Android16 ARM64 emulato:216 controlli; JVM:204. Non è prova su telefoni fisici. Le autorizzazioni/media cloud/provider possono limitare originali e metadati.

## English

Standalone ChinaTech0.3.0-alpha for Android8+. Install on both phones. Scan/select authorized data on the old sender; choose a local folder on the new receiver, create its hotspot and scan live. Use a manually enabled WPA2 hotspot with real credentials or the same Wi-Fi if automatic setup is rejected. Confirm both phones.

Encrypted transfer, originals kept, reread SHA256 and final receipt. No total selected-file count or approved-session duration cap;5 auto reconnects, incomplete objects restart. Explicit Gallery import has a separate journal; published/edited copies stay. System vCard preserves fields/photos and multiple cards actually supplied, with partial fallback reported. Confirm Contacts import/account/duplicates separately. Base/split APK archives are not installation. Private app data/logins/chats/SMS/calls/passwords/protected spaces need their own migration. Physical brands/older APIs remain unverified; native HarmonyOS NEXT without APK is unsupported. Android16 ARM64 emulators passed216 checks;204 JVM checks passed. These are not physical-device certification. Providers can restrict source bytes and location metadata.


开发/验证：项目内官方JDK/SDK与固定ZXing依赖，运行 `scripts/android-assistant/build-v3.sh`、`test-native.sh`；运行时独立合成测试APK由 `build-runtime-tests.py` 构建，`run-runtime-tests.py` 与 `run-native-modes.py` 仅针对项目专用AVD。测试APK不发布。证据位于 `.local/android-assistant-v3/`，并非仓库/源码ZIP自带可复用的实机证明。
