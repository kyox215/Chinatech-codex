# Smart Switch 3.7.73.4 · ChinaTech lab4

## 中文

本版修正 lab3 使用自有默认界面的做法。应用图标仍进入三星原 Launcher、欢迎／权限、首页与系统／连接选择；无线连接、远端资料选择、发送确认、进度和结果沿用原 APK 页面资源，由通用局域网控制器提供真实数据。不是三星官方签名更新，也不获得三星系统特权。

两部手机都安装 lab4。推荐并存版 com.sec.android.easyMover.chinatech 可更新本站 lab3 并存版，并与官方版共存；原包名 com.sec.android.easyMover 仅用于更新本站 lab1／lab2／lab3，不能覆盖官方签名版本。不能与原三星、旧实验版或 ChinaTech 独立助手混用。

1. 新机选择原首页“在此手机上接收”与“Galaxy／Android”，授权本机保存目录。按需授予附近设备／本地网络权限，生成热点二维码。
2. 旧机选发送，使用原扫码框、图库二维码或粘贴码。两端核对确认码，批准本次连接。
3. 扫描旧机已授权资料并准备目录，新机按类别或逐项选择。旧机核对实际项目／大小后确认发送。大量资料的目录核验需要时间，可取消。
4. 等待所选文件逐项保存、重新读取和 SHA256 校验及最终回执；完成页只报告真实保存／确认结果。图库与系统通讯录导入另外核对。

自动热点被拒绝时使用“连接选项”：同一 Wi-Fi 或系统手动热点。自动加入失败时，手动连接系统 Wi-Fi，再在旧机选择“已手动连接 Wi-Fi，继续”。Android 8／9 使用系统手动加入。系统热点由用户关闭。重新扫描会重建本助手目录，不删除原手机资料。配对码包含热点密码和临时凭据，仅供两机；不用网页粘贴。

不设 10000 项总数或已批准会话 2 小时上限；初次配对码有效 10 分钟，单次操作有超时，自动重连最多 5 次。相同会话的目录／选择冻结；改变的目录不能沿用已批准选择。已保存对象重新读取核验后跳过，未完成对象从头重传。没有块级续传或进程死亡后自动恢复原配对。

可传授权照片／视频／音频、系统所选文件、系统标准 VCF 字段与头像、日历 ICS／原始字段、可见 APP 的 base＋split ZIP。APP 归档不等于安装／私有数据恢复。登录、聊天数据库、支付凭据、保险箱、短信／通话、完整系统设置及三星专用备份还原未实现。USB／SD／PC 与 iOS 专用迁移不属于本通用无线控制器。HarmonyOS NEXT 不能安装 APK；原包 JNI 仅 ARM32／ARM64。

验收范围以 VERIFICATION-lab4.json 为准：Android 16／API36 ARM64 两台独立模拟器、合成数据；原界面真实勾选四项中的三项，传输 2,162,690 字节并校验；目录篡改拒绝、丢失最终回执恢复、通知、取消、原页面资源与实际系统热点 QR。传输走既有 Wi-Fi，热点自动加入／光学扫描未验证。无 HONOR Magic8 Pro／MagicOS11 或其它品牌真机结果；不宣称全品牌已完成恢复。前次失败保留在项目 .local/smart-switch-original-ui。

本公开分发依据用户已明确确认的三星修改及公开分发许可声明；没有独立审阅许可文件。源码包只含自主桥接／控制器与编译接口，不含私钥、完整三星反编译源码或其他 OEM 代码。

## Italiano

lab4 ripristina l’interfaccia Samsung originale al posto dell’avvio personalizzato di lab3. Launcher, introduzione, permessi, schermata iniziale e scelta di sorgente/connessione restano originali. Connessione wireless, catalogo, selezione, conferma, avanzamento e risultati usano risorse originali con un controller LAN universale. Firma sperimentale indipendente; nessun privilegio di sistema Samsung.

Entrambi i telefoni devono usare lab4. Il pacchetto affiancabile com.sec.android.easyMover.chinatech aggiorna lab3 affiancabile e convive con l’originale; quello com.sec.android.easyMover aggiorna solo lab1/lab2/lab3 di questo sito. Non sostituisce APK firmati Samsung e non si abbina all’originale, a vecchie lab o all’assistente ChinaTech autonomo.

Sul nuovo telefono scegli Ricevi e Galaxy/Android, autorizza una cartella locale e genera il QR dell’hotspot. Il vecchio legge il QR, verifica il codice su entrambi e scansiona i dati autorizzati. Il nuovo seleziona categorie o elementi; il vecchio conferma l’invio. Attendi salvataggio, rilettura, SHA256 e ricevuta finale. Verifica separatamente importazione in Galleria/Contatti e installazione delle app.

Se Android rifiuta l’hotspot o il collegamento automatico, usa Opzioni di connessione: stessa Wi-Fi, hotspot manuale o collegamento Wi-Fi manuale seguito da Continua sul vecchio telefono. Android 8/9 richiede collegamento manuale. Chiudi personalmente l’hotspot di sistema. Il QR contiene password e credenziali temporanee; non incollarlo nel sito.

Nessun limite totale di 10000 elementi o di due ore dopo approvazione; il primo QR dura 10 minuti, le operazioni hanno timeout e i tentativi automatici sono al massimo 5. Scelta e catalogo sono congelati per la sessione; modifiche vengono rifiutate. Gli oggetti salvati sono riverificati e saltati; quelli incompleti ripartono da zero. Nessuna ripresa a blocchi o ripresa automatica della coppia dopo morte del processo.

Supporta media/file autorizzati, VCF standard e foto dei contatti, ICS/campi grezzi del calendario e archivi base+split delle app visibili. Archiviare un’app non ripristina installazione, dati privati o accesso. Chat, credenziali, casseforti, SMS/chiamate, impostazioni complete e backup Samsung proprietari non sono implementati. USB/SD/PC e migrazione iOS dedicata non appartengono al controller universale. HarmonyOS NEXT non installa APK; JNI originale solo ARM32/ARM64.

Verifica: due emulatori Android 16/API36 ARM64 e dati sintetici; interfaccia originale, 3 oggetti selezionati su 4, 2.162.690 byte verificati, rifiuto del catalogo modificato, recupero della ricevuta, notifica, annullamento e QR dell’hotspot reale del sistema. Il trasferimento usa Wi-Fi esistente. Collegamento automatico, scansione ottica e telefoni reali HONOR/altre marche non verificati. Vedi VERIFICATION-lab4.json. Non è una certificazione per tutte le marche.

Distribuzione basata sulla dichiarazione esplicita dell’utente di autorizzazione Samsung alla modifica e distribuzione; documento di licenza non esaminato indipendentemente. Il sorgente pubblicato contiene solo codice autonomo e interfacce di compilazione, senza chiavi private, sorgenti Samsung decompilati completi o codice di altri OEM.

## English

lab4 restores Samsung’s original interface instead of lab3’s custom default UI. The original launcher, introduction, permissions, start and source/connection selection remain. Wireless pairing, catalog selection, source consent, progress and results use original APK resources with a universal LAN controller. It is independently signed and gains no Samsung system privileges.

Both phones need lab4. The side-by-side package com.sec.android.easyMover.chinatech updates this site’s side-by-side lab3 and coexists with the original. The original-package edition updates only this site’s lab1/lab2/lab3. It cannot replace Samsung-signed APKs or pair with original Samsung, older labs or the standalone ChinaTech assistant.

On the new phone choose Receive and Galaxy/Android, authorize a local folder and generate a hotspot QR. The old phone reads it, verifies the code on both phones and scans authorized data. The new phone selects categories or items; the old phone confirms sending. Wait for saving, rereading, SHA256 checks and the final receipt. Check Gallery/Contacts import and app installation separately.

If Android rejects hotspot creation or joining, use Connection options: the same Wi-Fi, a manual system hotspot, or join Wi-Fi manually and Continue on the old phone. Android 8/9 joins manually. Close the system hotspot yourself. QR codes contain passwords and temporary credentials; do not paste them into the website.

No total 10000-item or approved-session two-hour cap. Initial pairing codes last 10 minutes; operations have timeouts and automatic recovery has at most five retries. Session catalog and choice are frozen; changes are rejected. Saved objects are reread and skipped; unfinished objects restart. There is no byte-offset resume or automatic pairing recovery after process death.

Supports authorized media/files, standard VCF fields/contact photos, calendar ICS/raw fields and visible apps’ base+split archives. App archival does not restore installation, private data or login. Chat, credentials, vaults, SMS/calls, complete settings and Samsung-specific backups are not implemented. USB/SD/PC and dedicated iOS migration are outside the universal wireless controller. HarmonyOS NEXT cannot install APKs; original JNI is ARM32/ARM64 only.

Verification uses two Android16/API36 ARM64 emulators and synthetic data: original UI, three of four selected objects, 2,162,690 verified bytes, changed-catalog rejection, final-receipt recovery, notification, cancellation and actual system-hotspot QR generation. Data transfer used existing Wi-Fi. Automatic hotspot joining, optical scanning and physical HONOR/other brands remain unverified. See VERIFICATION-lab4.json; this is not all-brand certification.

Public distribution relies on the user’s explicit statement of Samsung permission to modify and distribute; the license document was not independently reviewed. Published source includes only first-party code and compile interfaces, with no private keys, complete Samsung decompiled source or other OEM code.

## 安装包校验 / Verifica APK / APK verification

SHA256 · 42,761,166 bytes per APK

- SmartSwitch-3.7.73.4-original-ui-coexist-lab4.apk
  `6115198b29ec3b67be59459ffca86a47f9804ef49b8e2baabbf2a5dbcc635a20`
- SmartSwitch-3.7.73.4-original-ui-lab4.apk
  `9f68089caf3c694beeefcf200348727892307a4d167db48e6eab7e2bf5c72ce0`
