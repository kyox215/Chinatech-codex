# Mi Mover 跨品牌传输实验版

版本：4.5.7.5-ct-lab2（45707） · Android 8+ · com.miui.huanji.chinatech

## 中文

独立签名实验并存版，保留小米换机原页面，使用自主公开 Android API 传输和恢复。两端均能选择“新”或“旧”，没有小米／红米品牌门槛；OPPO、Motorola、Samsung、Xiaomi 等实体手机及旧 Android/其他ABI仍待逐机核验。它不代表小米官方更新，不能覆盖官方签名包，可与官方版同时安装。本站 lab1 可同签名覆盖更新；传输时先停止任务再两端更新，不卸载以免丢失状态。两部安卓手机须安装此同版 lab2；不能与官方 Mi Mover、Samsung 或 ChinaTech 独立助手混配。iPhone 和 HarmonyOS NEXT 不能安装此 APK。

1. 新机打开原“新”入口，选择“小米”或“安卓”旧设备来源（两者进入同一通用通道）。按需要选择收到后的恢复范围，也可先取消，仅保存原文件。
2. 选择本地接收目录。Android 确认目录授权与附近 Wi-Fi 权限后可创建本地热点。连接方式可选自动热点、已在系统启用的 WPA2 手动热点或两机已连接的同一 Wi-Fi；手机系统拒绝自动模式时使用备用方式。
3. 旧机打开原“旧”入口，选择资料；授权扫描媒体、文件夹、通讯录、日历或应用包。仅勾选的内容会发送。部分图库、失败、未扫描和残留记录单独显示；数量按文件计算，通讯录导出为VCF，日历为ICS/原字段，应用为base+split包。
4. 旧机扫描新机二维码（内置相机或本地二维码图片），或输入新机临时配对码。按 Android 提示连接 Wi-Fi，然后在两机核对同一确认码并允许本次传输。
5. 完成以接收端成功写入、关闭、持久回执及两端最终确认判断。保存和恢复数量分别显示。按预选范围复制照片／视频／音乐到媒体库、添加本地联系人、导入指定可写日历；已有数据保留，应用安装仍须逐项 Android 确认，可继续或跳过当前安装。
6. 中断时保留原机资料与已成功文件。同会话最多5次自动重连；停止或退出后重新配对，同任务／同目录核验已完成对象并跳过，未完成文件从头发送，没有字节偏移续传。残留删除未确认时如实保留记录，去原目录核对。恢复结果有部分／失败／仅存档时按提示补授权再继续。

范围：授权照片、视频、音乐、文件、系统能导出的VCF字段／头像、普通非重复ICS及原字段、可见应用base+split包。应用私有数据、登录、聊天、短信、通话、密码、工作空间和完整重复日历不能自动恢复；已归档 APK 不等于已安装，已保存文件不等于已完整恢复。转移文件内容使用本地加密连接；系统文件提供器可自行联网或同步，应选本地目录。原程序界面及依赖仍保留，此版本不承诺整个原厂程序无网络访问。二维码／配对码含临时网络凭据，不发送给他人，不公开截图。

验证条件：Android 16/API36 ARM64 两台专用模拟器，合成资料；模拟器桥接网络并非实体两机自动热点加入证明。实体品牌、光学扫码、旧API及其他ABI、真实进程死亡仍待验。请先用可复制的测试资料核对目标手机支持的分类。

## Italiano

APK sperimentale con firma indipendente, installabile insieme a Mi Mover ufficiale. Conserva le schermate originali; il motore autonomo usa API Android pubbliche. Android 8+, nessuna lista di marche per scegliere Nuovo/Vecchio. Usa lo stesso lab2 su entrambi i telefoni; non abbinarlo a Mi Mover ufficiale, Samsung o all’assistente ChinaTech autonomo. Non installabile su iPhone o HarmonyOS NEXT. I telefoni fisici e le vecchie API/altre ABI restano da verificare.

1. Sul nuovo telefono scegli Nuovo, quindi Xiaomi o Android; entrambi aprono lo stesso canale. Scegli le categorie da ripristinare o annulla per conservare solo i file ricevuti.
2. Autorizza una cartella locale di destinazione. Scegli hotspot automatico, hotspot WPA2 già attivato nelle impostazioni, oppure la stessa Wi-Fi su entrambi.
3. Sul vecchio telefono scegli Vecchio e seleziona i dati autorizzati. Scansione di media/cartelle, VCF, ICS e pacchetti base+split; vengono inviati solo gli elementi selezionati. Ambiti parziali, errori e residui sono mostrati separatamente.
4. Scansiona il QR del nuovo telefono con fotocamera/immagine locale, oppure inserisci il codice temporaneo. Conferma la connessione Android e confronta lo stesso codice su entrambi prima di approvare.
5. Il completamento richiede scrittura, chiusura, ricevute persistenti e conferma finale su entrambi. Ripristino separato di media, contatti locali e calendario scrivibile; le app richiedono conferma Android, con azioni Continua/Salta.
6. Dopo interruzione conserva gli originali. Fino a5 riconnessioni automatiche; dopo stop/uscita abbina di nuovo. I file completati vengono verificati e saltati, quelli incompleti ripartono da zero. Nessuna ripresa a byte. Per errori/parti archiviate controlla permessi, spazio e risultati prima di continuare.

Non ripristina dati privati, accessi, chat, SMS, chiamate, password, spazi protetti o ricorrenze complete. APK archiviato non significa app installata. Collegamento locale cifrato; i provider di file possono sincronizzare autonomamente e le dipendenze originali restano. Proteggi QR/credenziali. Verifiche su due emulatori Android16 ARM64 con dati sintetici e rete collegata tramite bridge; non certificano hotspot/scansione ottica/telefoni reali.

## English

Independently signed experimental APK that installs alongside official Mi Mover. Original layouts with an independently implemented public Android API engine. Android8+, no brand allowlist for New/Old. Install the same lab2 on both Android phones; do not pair it with official Mi Mover, Samsung or the standalone ChinaTech assistant. iPhone/HarmonyOS NEXT cannot install it. Physical brands, older APIs and other ABIs remain unverified.

1. On the new phone choose New, then Xiaomi or Android; both open the universal channel. Choose restore categories or cancel to save received originals only.
2. Authorize a local destination folder. Choose an automatic hotspot, a WPA2 hotspot already enabled in system settings, or the same Wi-Fi on both phones.
3. On the old phone choose Old, authorize and select media/folders, VCF, ICS and visible base+split app packages. Only selected objects are sent; partial scans, errors and residuals are separate.
4. Scan the new phone QR with the built-in camera/local image, or enter its temporary code. Approve Android’s connection request and compare the same verification code on both phones before approval.
5. Completion requires successful writes, closes, durable receipts and final confirmation on both sides. Media/local contacts/writable-calendar restoration is separate; each new app still requires Android installation approval, with Continue/Skip actions.
6. Keep originals after interruption. Up to5 automatic reconnects; after stop/exit pair again. Completed objects are checked and skipped, incomplete files restart from the beginning. No byte-offset resume. Review permissions, storage and partial/failed/archived-only results before continuing restoration.

Private data, logins, chats, SMS, calls, passwords, protected spaces and full recurring calendars are unsupported. An archived APK is not an installed app. File contents use an encrypted local connection; file providers may sync independently and original dependencies remain. Keep QR/credentials private. Verification uses two Android16 ARM64 emulators, synthetic data and bridged networking; this does not certify physical-phone hotspot joining, optical scanning or all brands.
## SHA-256 / Integrità / Integrity

APK (37,764,668 bytes): `4607f469cd156d19a0d24e19608302ece2abe8bab4cc464e037d3a6e845dab9b`

Signer certificate SHA-256: `1b71b70be3bb58e2db847aa71029ca2c071e467c60f5babef62a841eb00efc75`
