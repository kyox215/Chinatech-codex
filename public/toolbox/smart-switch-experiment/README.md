# Smart Switch lab2 — 接收连接回退 / Recupero connessione / Receiver recovery

## 中文

基于 Smart Switch 3.7.73.4 的独立签名实验修改版。lab2 保留 lab1 的发送／接收入口，增加二维码等待截止和系统 Wi-Fi 设置回退；不是三星官方更新，不是已经验证的全品牌完整迁移工具。

**荣耀现场**：用户 HONOR Magic8 Pro（BKQ-N49）、MagicOS 11，在接收页二维码持续加载。源码确认常规 QR 依赖本机 P2P 地址；普通重签应用可能只得到 Android 隐藏后的占位 MAC，原校验拒绝它后没有页面结束反馈。另一处原手动设置按钮只支持三星私有 action。未取得该手机日志，不把机制分析当作唯一根因的运行证明。

**lab2 行为**：仅非三星接收端仍在前台、尚未连接且 QR 未生成时等待 15 秒，随后调用原完整手动直连流程，并显示原因。二维码成功、已连接、离开页面或退后台会取消等待；恢复前台重新计时。三星接收与发送端不自动切换。手动下一步在非三星上打开通用 Wi-Fi 设置；三星保留专用入口并在失败时回退。系统不支持直连时明确提示使用 ChinaTech 助手。

**这不是补出一个可扫码二维码**：不填假 MAC、不关闭地址校验、不改变无线／有线协议、不增加或授予系统权限。手动页出现、系统设置打开、两端配对、资料收到与目标恢复是不同结果，后续阶段仍待真机核验。

安装与复验：

1. 下载 `SmartSwitch-3.7.73.4-receiver-recovery-lab2.apk`。Android 6.0+，仅 ARM32／ARM64。Android 中基础版本名称仍显示 3.7.73.4，数字构建号为 **377304131**；文件名与网页标示 lab2。
2. 之前从本站安装 lab1 的手机可尝试直接覆盖升级：两包实验签名一致，lab2 构建号增加。不需要卸载、清除应用资料或删除手机资料。若系统拒绝更新，保留现有数据并记录错误。
3. 独立实验签名不能覆盖三星官方或系统预装同包应用；不要求卸载官方版作为测试准备。
4. 新机选择接收，保持页面前台。若 QR 不出现，15 秒后应切换手动直连页。点下一步打开 Wi-Fi 设置，寻找系统的 Wi-Fi Direct／直连选项；普通 Wi-Fi 网络列表不代表已经 P2P 连接。
5. 另一台手机按原 Smart Switch 手动连接流程操作，核对设备名称与系统确认。首轮只用测试照片／文件／联系人，检查对端握手、目标数量和真实可用结果。
6. 如果本系统没有直连菜单或无法配对，在**两台手机**安装本站独立的 ChinaTech Phone Assistant，使用新机热点或同一路由器。ChinaTech 与 Smart Switch 的二维码／传输协议不同，不能一端使用一个。

兼容范围：HONOR／Samsung／Xiaomi、Redmi、POCO／OPPO、OnePlus、realme／vivo、iQOO／Pixel、Motorola、Lenovo／Nothing、Sony、ASUS、Nokia、HMD／ZTE、nubia、Meizu、Sharp、TCL、TECNO、Infinix、itel及其他 Android OEM 按相同公开接口条件审核；这是机制覆盖，不是逐系列实测认证。华为必须先确认 Android APK 兼容；原生 HarmonyOS NEXT 不由本 APK 支持。未来 Android、x86、工作资料／双开／保险箱另行核验。

Android 13+ 要实际允许附近设备，旧版发现可能要求位置开关；Android 17／target37 要实际允许局域网访问。普通权限不等于 LOCAL_MAC_ADDRESS、BACKUP、INSTALL_PACKAGES、WRITE_SECURE_SETTINGS 等系统身份。联系人／日历目标账号、媒体部分授权、应用 split／ABI／安装器、短信角色、厂商 provider 与聊天私库分别核对；不能因为接收按钮可见就宣称全部资料可还原。

实验签名证书 SHA256：`22e7f48efb1f168f67886a617b83af67885a233b6a1c6f16428f138f5b367dab`。文件大小和 SHA256 见网页与 `SHA256SUMS.txt`。lab1 原文件保留，不用它的旧校验值验证 lab2。

实际验证限于源码／纯策略回归、DEX／包结构、签名和网站下载。尚未在这台荣耀或所有品牌手机上验证 lab2 安装、配对、传输、锁屏、系统导入与完整恢复。没有客户资料迁移或系统权限修改。

## Italiano

Modifica sperimentale di Smart Switch 3.7.73.4 con firma indipendente. lab2 conserva i pulsanti Invio/Ricezione di lab1 e aggiunge un'attesa limitata del QR e un accesso alternativo alle impostazioni Wi-Fi. Non è un aggiornamento ufficiale Samsung né una migrazione completa tra tutti i marchi già verificata.

Il problema segnalato riguarda HONOR Magic8 Pro (BKQ-N49), MagicOS 11: QR in caricamento continuo. Il codice richiede l'indirizzo P2P locale; Android può restituire un MAC anonimizzato a un'app rifirmata. L'originale lo rifiuta senza terminare chiaramente l'attesa. Il pulsante manuale usa inoltre un'azione privata Samsung. Non sono disponibili i log del telefono: il meccanismo non prova l'unica causa reale.

Solo su destinatari non Samsung, con pagina in primo piano, nessuna connessione e QR non generato, lab2 attende 15 secondi, poi esegue il flusso manuale originale completo e mostra il motivo. QR riuscito, connessione, cambio pagina o pausa annullano l'attesa; tornando in primo piano parte una nuova attesa. Mittenti e ricevitori Samsung non passano automaticamente alla modalità manuale. Il pulsante successivo apre il Wi-Fi generico sui non Samsung; su Samsung mantiene l'azione originale e ripiega sul Wi-Fi se fallisce. Se Wi-Fi Direct non è disponibile, viene indicato l'assistente ChinaTech.

Non viene creato un QR fittizio: nessun MAC inventato, controllo disabilitato, protocollo cambiato o nuovo privilegio di sistema. Pagina manuale, impostazioni aperte, abbinamento, ricezione e ripristino sono risultati distinti. Le fasi sui telefoni richiedono ancora verifica.

1. Scarica `SmartSwitch-3.7.73.4-receiver-recovery-lab2.apk`: Android 6.0+, ARM32/ARM64. Android mostra ancora la versione base 3.7.73.4; il codice build è **377304131**, file e sito indicano lab2.
2. Se hai lab1 di questo sito, prova l'aggiornamento diretto: stessa firma sperimentale e build superiore. Non serve disinstallare, cancellare dati dell'app o dati del telefono. Se rifiutato, conserva i dati e annota l'errore.
3. Questa firma non può aggiornare Smart Switch ufficiale o preinstallato. Non disinstallare l'originale per preparare la prova.
4. Scegli Ricezione e mantieni la pagina visibile. Dopo 15 secondi senza QR deve comparire il flusso manuale. Apri il Wi-Fi e cerca Wi-Fi Direct nelle opzioni del sistema; il normale elenco Wi-Fi non prova una connessione P2P.
5. Sul secondo telefono usa il flusso manuale originale e controlla nome e consenso. Inizia con foto, file e contatti sintetici, verificando collegamento e dati realmente utilizzabili.
6. Se manca Wi-Fi Direct o l'abbinamento fallisce, installa ChinaTech Phone Assistant su **entrambi** e usa hotspot del nuovo telefono o lo stesso router. QR e protocolli ChinaTech/Smart Switch non sono interoperabili.

Copertura dell'analisi: HONOR; Samsung; Xiaomi/Redmi/POCO; OPPO/OnePlus/realme; vivo/iQOO; Pixel/Motorola/Lenovo; Nothing/Sony/ASUS/Nokia/HMD; ZTE/nubia/Meizu/Sharp/TCL/TECNO/Infinix/itel e altri OEM Android. È un'analisi dei meccanismi comuni, non una certificazione di ogni modello. Huawei richiede compatibilità APK Android; HarmonyOS NEXT nativo è escluso. Versioni future, x86, profili aziendali, clonazione app e spazi sicuri richiedono verifiche specifiche.

Android 13+ richiede consenso Dispositivi nelle vicinanze; versioni precedenti possono richiedere posizione attiva. Android 17/target37 richiede accesso alla rete locale. Il consenso ordinario non concede LOCAL_MAC_ADDRESS, BACKUP, INSTALL_PACKAGES o WRITE_SECURE_SETTINGS. Contatti/calendari, accesso parziale ai media, split/ABI/installazione, SMS, provider OEM e dati privati delle app vanno controllati separatamente.

Certificato SHA256: `22e7f48efb1f168f67886a617b83af67885a233b6a1c6f16428f138f5b367dab`. Dimensione e hash file sul sito e in `SHA256SUMS.txt`. lab1 resta conservato; i suoi hash non verificano lab2. Verificate soltanto sorgenti/politica JVM, struttura DEX/APK, firma e download. Installazione lab2, abbinamento e migrazione su questo HONOR e tutte le marche non sono stati verificati. Nessun trasferimento di dati clienti o modifica dei privilegi di sistema.

## English

An independently signed experimental modification of Smart Switch 3.7.73.4. lab2 retains lab1's Send/Receive entry and adds a bounded QR wait and Wi-Fi settings recovery. It is not an official Samsung update or a verified complete migration tool for every brand.

The reported device is HONOR Magic8 Pro (BKQ-N49), MagicOS 11, with QR loading indefinitely. Source requires the local P2P address; Android may return an anonymized MAC to a re-signed app. The original rejects it without clearly ending the wait. Its manual settings button also uses a Samsung-private action. Device logs are unavailable; this mechanism is not proof of the sole on-device cause.

On non-Samsung receivers only, while the QR page is foreground, disconnected and without a generated QR, lab2 waits 15 seconds then invokes the complete original manual flow and shows the reason. QR success, connection, leaving the page or pausing cancels the wait; resuming starts a new wait. Senders and Samsung receivers do not automatically switch. The next button opens generic Wi-Fi settings on non-Samsung devices; Samsung retains its original action with generic fallback on failure. Unsupported Wi-Fi Direct points to the ChinaTech assistant.

No fake QR is produced: no fabricated MAC, disabled address validation, changed protocol or new system privilege. Manual UI, settings opening, pairing, receiving and restoration are separate outcomes. Phone behavior still needs verification.

1. Download `SmartSwitch-3.7.73.4-receiver-recovery-lab2.apk`: Android 6.0+, ARM32/ARM64. Android still displays base version 3.7.73.4; build code is **377304131**. The file and website identify lab2.
2. If this site's lab1 is installed, try an in-place update: same experimental signer and higher build code. Uninstalling, clearing app data or erasing phone data is unnecessary. Preserve data and record any rejected-update error.
3. This signer cannot update official or system-preinstalled Smart Switch. Uninstalling the official app is not required as test preparation.
4. Choose Receive and keep the page foreground. After 15 seconds without QR, it should switch to the manual flow. Open Wi-Fi settings and find the system's Wi-Fi Direct option; a normal Wi-Fi list does not prove P2P connection.
5. Follow the original manual flow on the other phone and check peer name and consent. Begin with synthetic photos, files and contacts, checking the connection and actual usable destination data.
6. If Wi-Fi Direct is absent or pairing fails, install ChinaTech Phone Assistant on **both** phones and use the new phone's hotspot or the same router. ChinaTech and Smart Switch QR codes/protocols are not interoperable.

Mechanism review covers HONOR; Samsung; Xiaomi/Redmi/POCO; OPPO/OnePlus/realme; vivo/iQOO; Pixel/Motorola/Lenovo; Nothing/Sony/ASUS/Nokia/HMD; ZTE/nubia/Meizu/Sharp/TCL/TECNO/Infinix/itel and other Android OEMs. This is common-mechanism coverage, not certification of every model. Huawei requires Android APK compatibility; native HarmonyOS NEXT is excluded. Future Android, x86, work profiles, app clones and secure spaces need separate checks.

Android 13+ requires actual Nearby devices consent; older discovery may require location mode. Android 17/target37 requires local-network permission. Ordinary permission dialogs do not grant LOCAL_MAC_ADDRESS, BACKUP, INSTALL_PACKAGES or WRITE_SECURE_SETTINGS. Contact/calendar accounts, partial media access, app splits/ABI/installers, SMS roles, OEM providers and private app data require separate checks.

Signer SHA256: `22e7f48efb1f168f67886a617b83af67885a233b6a1c6f16428f138f5b367dab`. File size/hash are on the website and in `SHA256SUMS.txt`. lab1 is preserved; its hashes do not verify lab2. Verification covers source/JVM policy, DEX/APK structure, signing and downloads only. lab2 installation, pairing and migration on this HONOR or all brands remain unverified. No customer migration or system-privilege modification occurred.

## Official platform references / 平台依据 / Riferimenti

- [Wi-Fi Direct](https://developer.android.com/develop/connectivity/wifi/wifip2p)
- [P2P device information and MAC privacy](https://developer.android.com/reference/android/net/wifi/p2p/WifiP2pManager)
- [Android local-network permission](https://developer.android.com/privacy-and-security/local-network-permission)
- [Samsung supported transfer direction](https://www.samsung.com/us/support/answer/ANS10001344/)
