# Smart Switch 3.7.73.4-universal-lab3

| APK | Bytes | SHA256 |
| --- | ---: | --- |
| SmartSwitch-3.7.73.4-universal-coexist-lab3.apk | 42699726 | 38e2a5136cf38c5479a3f1f3cda33ab5ccd87c138eb754017da649530256ea31 |
| SmartSwitch-3.7.73.4-universal-lab3.apk | 42699726 | 9714e2571daeafaec5433bf993f4273c73076dfb8dbacfe4eb4e851ec8b3e62b |

## 中文

基于 Smart Switch 3.7.73.4 的独立签名实验修改版。通用本地通道嵌在三星 APK 内，打开 lab3 直接选择发送／接收；原三星页面的发送／接收入口也保留。无需另装 ChinaTech 助手。两端必须使用 lab3，并存版与更新包采用同一 CTSS3／CTSS4 协议，可以互通；不能与三星原版、lab1／lab2 或 ChinaTech 0.2 混用。

**验证状态：**Android 16 模拟器两端已通过 3 个对象、2162690 字节的局域网传输、严格 TLS 指纹核验、断线恢复及最终确认失败边界。Camera2 真实帧读取和随机二维码解码已在 Android 运行，尚不是实体手机对屏幕的光学扫码验收。模拟器自动 LocalOnlyHotspot 明确返回 SYSTEM_2，成功路径使用局域网及手动配置二维码。HONOR 等实体手机热点、摄像扫码、厂商限制和完整跨品牌资料恢复仍未验收；本版仍是 alpha 实验包。

### 选择安装包

- **推荐并存版**：`SmartSwitch-3.7.73.4-universal-coexist-lab3.apk`，包名 `com.sec.android.easyMover.chinatech`。与官方／预装 Samsung Smart Switch 并存，无需卸载或覆盖原版。
- **更新 lab1／lab2**：`SmartSwitch-3.7.73.4-universal-lab3.apk`，包名 `com.sec.android.easyMover`。可更新本站同实验签名的 lab1／lab2；不能覆盖三星官方签名包。装有官方包时选并存版。
- 两份发行包通道代码和资源一致，只通过独立包名、声明权限与 provider authorities 隔离安装身份；不同发行包不意味着不同传输协议。
- Android 8 或以上、ARM32／ARM64。HarmonyOS NEXT 不能安装此 APK，其他系统与权限仍需分别核对。
- 版本 `3.7.73.4-universal-lab3`，versionCode `377304132`。两份 APK 均为 42699726 字节；安装前核对本页摘要与 `SHA256SUMS-lab3.txt`。
- 签名证书 SHA256：`22e7f48efb1f168f67886a617b83af67885a233b6a1c6f16428f138f5b367dab`。沿用 lab1 本地实验签名，不是三星官方更新。

### 两机操作

1. 两机安装 lab3。旧机打开后选择“发送”，授权并扫描所需媒体、文件、联系人、日历或可见应用，按类别／逐项选择。
2. 新机选择“接收”，先由系统选择器授权本机保存位置，再创建本地热点并显示二维码。授权目录不是全部文件访问权限。
3. 自动热点被系统拒绝时，使用应用内系统热点设置引导，打开系统热点，填写真实 SSID 与 8–63 位 WPA2 密码生成二维码。不要填写猜测的名称或密码。这个系统热点需在传输后自行关闭；同一 Wi-Fi 的入口也会生成二维码。
4. 旧机用 APK 内置相机实时扫码，或从图库选清晰二维码图片。按系统提示加入新机热点；Android 8／9 需在 Wi-Fi 设置手动加入后返回。
5. 核对两端设备、本次资料及保存位置，两端分别批准后传输。逐项保存并重读校验；最终数量、字节和摘要核对并收到最终确认后，才能认定本次接收完成。
6. 断线最多自动重连 5 次。未完成对象整项重传；已完成对象从目标目录重读校验后跳过，不是字节断点续传。进程重启后需重新扫码批准；失权、内容改变或最终确认失败不能假报完成。
7. 接收后逐项检查文件。联系人／日历导入和应用安装另经系统确认，文件接收不等于导入／安装完成。结束会话释放应用热点；手动开的系统热点自行关闭。

### 资料与连接边界

- 授权照片／视频／音频原文件；部分照片授权仅扫描可见子集。
- 公共文件、所选文件和 SAF 授权文件夹；不绕过 Android/data、工作空间、保险箱或其他应用私有目录限制。同名原件保留，不静默覆盖。
- 基础联系人姓名、电话、邮箱 VCF。分组、头像及完整自定义字段恢复未验收。
- 非重复日历基础 ICS，以及含重复／例外／时区的原始字段归档。原始归档不等于实现重复日历还原；系统导入、账号同步和厂商待办另行处理。
- 可见普通应用的 base＋split APK ZIP；私有数据、账号登录、聊天、购买许可及完整应用还原没有解锁。安装仍需兼容性核对与系统确认。
- 短信、通话记录、保险箱、系统设置及厂商受保护内容没有通用恢复能力，应按官方迁移方法补做。
- 不设 10000 项总数或已批准会话 2 小时上限。单次连接／操作仍有超时，核验阶段 150 秒无进展会超时，最终确认窗口为 180 秒；这些不是整次传输时长上限。首次未批准配对、系统存储容量与权限边界仍有效。

公开 LocalOnlyHotspot 接口提供真实 SSID／PSK；手动配置使用用户核对的系统热点凭据。CTSS3／CTSS4 二维码含热点凭据、临时 secret 和 TLS 证书 pin。通道不依赖本机 MAC 或 LOCAL_MAC_ADDRESS；旧机连接和发送绑定专属 Wi-Fi Network，先核验 TLS pin／secret，再由双端批准。

二维码只供两部手机使用，不贴到网站、公开截图或客服消息。图库／云目录可能由对应应用保存或同步；优先选择本机目录。通道自身不向网站上传资料或配对凭据，测试日志不保存真实客户资料。

旧 lab1／lab2／ChinaTech 0.2 APK、原 README 和 SHA 清单保留原字节。ChinaTech 0.2 已发现原生 TLS 连接缺陷，旧包未包含修复，仅保留参考，建议使用本版 lab3。旧包不能作为本版或完整迁移的成功证据。

## Italiano

Modifica sperimentale di Smart Switch 3.7.73.4 con firma indipendente. Il canale locale universale è integrato nell’APK Samsung: all’apertura di lab3 scegli Invio/Ricezione; anche gli ingressi della pagina Samsung originale restano collegati. Non serve l’assistente ChinaTech separato. Entrambi i telefoni devono usare lab3. Versione affiancabile e aggiornamento usano lo stesso protocollo CTSS3/CTSS4 e sono interoperabili; non si abbinano a Smart Switch Samsung originale, lab1/lab2 o ChinaTech 0.2.

**Stato della verifica:** due emulatori Android 16 hanno trasferito 3 oggetti/2162690 byte sulla LAN, con verifica rigorosa dell’impronta TLS, recupero dopo disconnessione e controlli sui fallimenti della conferma finale. Lettura di frame Camera2 reali e decodifica di QR casuali sono state eseguite su Android; questo non verifica ancora la scansione ottica dello schermo con un telefono fisico. LocalOnlyHotspot automatico dell’emulatore ha restituito SYSTEM_2; il percorso riuscito usa LAN e QR configurato manualmente. Hotspot e fotocamera di telefoni reali come HONOR, restrizioni dei produttori e ripristino completo tra marche restano da verificare. È ancora un APK alpha sperimentale.

### Quale APK installare

- **Affiancabile consigliato:** `SmartSwitch-3.7.73.4-universal-coexist-lab3.apk`, pacchetto `com.sec.android.easyMover.chinatech`. Convive con Smart Switch Samsung ufficiale/preinstallato, senza disinstallarlo o sostituirlo.
- **Aggiornamento lab1/lab2:** `SmartSwitch-3.7.73.4-universal-lab3.apk`, pacchetto `com.sec.android.easyMover`. Aggiorna lab1/lab2 di questo sito con la stessa firma sperimentale, non gli APK firmati Samsung. Con la versione ufficiale installata scegli l’affiancabile.
- Codice del canale e risorse coincidono; nome del pacchetto, permessi dichiarati e authorities dei provider separano l’identità di installazione. Le due edizioni usano lo stesso protocollo.
- Android 8 o successivo, ARM32/ARM64. HarmonyOS NEXT non installa questo APK; altri sistemi e permessi richiedono verifiche separate.
- Versione `3.7.73.4-universal-lab3`, versionCode `377304132`. Ogni APK ha 42699726 byte; confronta digest qui e `SHA256SUMS-lab3.txt` prima di installare.
- SHA256 del certificato: `22e7f48efb1f168f67886a617b83af67885a233b6a1c6f16428f138f5b367dab`. È la firma sperimentale locale di lab1, non un aggiornamento ufficiale Samsung.

### Procedura sui due telefoni

1. Installa lab3 su entrambi. Sul vecchio scegli Invio, autorizza e scansiona media, file, contatti, calendario o app visibili, poi scegli categorie o elementi.
2. Sul nuovo scegli Ricezione, autorizza una destinazione locale con il selettore di sistema, poi crea l’hotspot e mostra il QR. L’autorizzazione della cartella non concede accesso a tutti i file.
3. Se il sistema rifiuta l’hotspot automatico, usa la guida nell’app alle impostazioni dell’hotspot di sistema, attivalo e inserisci SSID reale e password WPA2 di 8–63 caratteri per creare il QR. Non indovinare i valori. Spegni manualmente questo hotspot dopo il trasferimento. Anche Stesso Wi-Fi nell’app genera il QR.
4. Sul vecchio scansiona in tempo reale con la fotocamera integrata o scegli un’immagine nitida dalla galleria. Conferma il collegamento; Android 8/9 richiede di collegarsi manualmente nelle impostazioni Wi-Fi e tornare all’app.
5. Verifica dispositivi, dati e destinazione, poi approva separatamente su entrambi. Ogni oggetto viene salvato e riletto; solo controlli finali di numero, byte e digest con conferma finale stabiliscono il completamento della ricezione.
6. Fino a 5 riconnessioni automatiche. Gli oggetti incompleti ripartono da zero; quelli completati vengono riletti, verificati e saltati. Non è una ripresa a livello di byte. Dopo il riavvio del processo serve un nuovo QR e una nuova approvazione. Permessi persi, contenuti cambiati o conferma finale fallita non risultano completati.
7. Controlla i file ricevuti. Importazione di contatti/calendario e installazione delle app richiedono conferma separata del sistema. Chiudi la sessione per rilasciare l’hotspot dell’app; spegni manualmente quello di sistema.

### Dati e connessione

- Originali autorizzati di foto/video/audio. L’accesso parziale alle foto espone solo il sottoinsieme selezionato.
- File pubblici/scelti e cartelle SAF autorizzate. Nessun aggiramento di Android/data, profili di lavoro, casseforti o directory private. Nessuna sovrascrittura silenziosa degli originali omonimi.
- VCF di base con nomi, telefoni ed email; ripristino di gruppi, foto e tutti i campi personalizzati non verificato.
- ICS di base per eventi non ricorrenti e archivio dei campi originali con ricorrenze/eccezioni/fusi orari. L’archivio non ripristina le ricorrenze; importazione, sincronizzazione e attività proprietarie richiedono procedure separate.
- ZIP di APK base+split per app ordinarie visibili. Dati privati, accessi, chat, licenze acquistate e ripristino completo non vengono sbloccati. Installazione richiede compatibilità e conferma del sistema.
- SMS, chiamate, casseforti, impostazioni e contenuti protetti non hanno ripristino generico. Usa le procedure ufficiali.
- Nessun limite totale di 10000 elementi o di 2 ore per una sessione approvata. Connessioni/operazioni singole hanno timeout; la verifica scade dopo 150 secondi senza progressi e la conferma finale ha una finestra di 180 secondi. Non sono limiti della durata totale. Scadenza del primo abbinamento non approvato, capacità e permessi restano vincolanti.

LocalOnlyHotspot pubblico fornisce SSID/PSK reali; la configurazione manuale usa credenziali dell’hotspot verificate dall’utente. Il QR CTSS3/CTSS4 contiene credenziali, secret temporaneo e pin del certificato TLS. Nessuna dipendenza dal MAC locale o da LOCAL_MAC_ADDRESS. Il vecchio telefono usa il Network Wi-Fi dedicato; pin TLS/secret sono verificati prima dell’approvazione bilaterale.

Usa il QR solo sui due telefoni, senza pubblicarlo sul sito, in schermate o messaggi. Galleria/cartelle cloud possono salvare o sincronizzare; preferisci una destinazione locale. Il canale non carica dati o credenziali sul sito e i log di prova non devono contenere dati reali dei clienti.

APK lab1/lab2/ChinaTech 0.2, README e SHA precedenti mantengono i byte originali. ChinaTech 0.2 ha un difetto TLS nativo noto e il vecchio APK non contiene la correzione: resta come riferimento, preferisci lab3. I vecchi APK non provano il successo di lab3 o di una migrazione completa.

## English

An independently signed experimental modification of Smart Switch 3.7.73.4. Its universal local channel is embedded in the Samsung APK: choose Send/Receive when opening lab3; the original Samsung page’s buttons remain hooked too. No separate ChinaTech assistant is required. Both phones must use lab3. Side-by-side and update editions share CTSS3/CTSS4 and can pair; they cannot pair with original Samsung Smart Switch, lab1/lab2 or ChinaTech 0.2.

**Verification status:** two Android 16 emulators transferred 3 objects/2162690 bytes on a LAN, with strict TLS fingerprint verification, disconnection recovery and final-confirmation failure checks. Real Camera2 frames and random QR decoding ran on Android; this does not yet prove a physical phone optically scans another screen. The emulator’s automatic LocalOnlyHotspot returned SYSTEM_2; successful paths used LAN and manually configured QR codes. Physical HONOR and other phones’ hotspots/cameras, vendor restrictions and complete cross-brand restoration remain unverified. This remains an alpha experiment.

### Choose an APK

- **Recommended side-by-side:** `SmartSwitch-3.7.73.4-universal-coexist-lab3.apk`, package `com.sec.android.easyMover.chinatech`. Installs alongside official/preinstalled Samsung Smart Switch without uninstalling or replacing it.
- **Update lab1/lab2:** `SmartSwitch-3.7.73.4-universal-lab3.apk`, package `com.sec.android.easyMover`. Updates this site’s lab1/lab2 with the same experimental signer, not Samsung-signed APKs. Choose side-by-side when the official app is installed.
- Channel code and resources match; package name, declared permissions and provider authorities isolate installation identities. The two editions share the same transfer protocol.
- Android 8 or later, ARM32/ARM64. HarmonyOS NEXT cannot install this APK; other systems and permissions need separate checks.
- Version `3.7.73.4-universal-lab3`, versionCode `377304132`. Each APK is 42699726 bytes; compare the digests above and `SHA256SUMS-lab3.txt` before installing.
- Signing-certificate SHA256: `22e7f48efb1f168f67886a617b83af67885a233b6a1c6f16428f138f5b367dab`. This is lab1’s local experimental signer, not an official Samsung update.

### Two-phone procedure

1. Install lab3 on both. On the old phone choose Send, authorize and scan needed media, files, contacts, calendar or visible apps, then choose categories or individual items.
2. On the new phone choose Receive, authorize a local destination with the system picker, then create the hotspot and QR. Folder authorization does not grant all-files access.
3. If the system denies the automatic hotspot, use the app’s system-hotspot settings guide, enable it and enter the real SSID and 8–63-character WPA2 password to generate the QR. Do not guess credentials. Turn this hotspot off manually after transfer. Same Wi-Fi in the app generates a QR too.
4. On the old phone scan live with the embedded camera or choose a clear gallery image. Approve joining the hotspot; Android 8/9 requires joining manually in Wi-Fi settings and returning to the app.
5. Check devices, selected data and destination, then approve separately on both. Each object is saved and reread; final count, byte and digest checks plus final confirmation establish completed receipt.
6. Up to 5 automatic reconnects. Incomplete objects restart in full; completed objects are reread, verified and skipped. This is not byte-level resume. After process restart, scan and approve again. Lost permissions, changed content or failed final confirmation cannot be reported as complete.
7. Inspect received files. Contact/calendar import and app installation require separate system confirmation. End the session to release the app hotspot; manually turn off any system hotspot you enabled.

### Data and connection boundaries

- Authorized original photos/videos/audio. Partial photo authorization exposes only the selected subset.
- Public/selected files and SAF-authorized folders. No bypass of Android/data, work profiles, vaults or private directories. Existing same-name originals are not silently overwritten.
- Basic name/phone/email VCF. Group, photo and full custom-field restoration remain unverified.
- Basic ICS for non-recurring events and raw archives with recurrence/exception/time-zone fields. Archives do not restore recurring calendars; system import, account sync and vendor tasks need separate handling.
- Base+split APK ZIPs for ordinary visible apps. Private data, account sessions, chats, purchased licenses and complete restoration are not unlocked. Installation requires compatibility checks and system approval.
- SMS, call logs, vaults, settings and protected content have no generic restoration. Use official procedures.
- No 10000-item total limit or 2-hour limit on an approved session. Individual connections/operations have timeouts; verification times out after 150 seconds without progress and final confirmation has a 180-second window. These are not total transfer-duration limits. Initial unapproved pairing expiry, capacity and permissions remain.

The public LocalOnlyHotspot API supplies real SSID/PSK; manual configuration uses user-verified system-hotspot credentials. CTSS3/CTSS4 QR codes contain credentials, a temporary secret and TLS certificate pin. No dependency on the local MAC or LOCAL_MAC_ADDRESS. The old phone uses the dedicated Wi-Fi Network; TLS pin/secret are verified before approval on both phones.

Use the QR only on these two phones, without posting it on the website, screenshots or support messages. Gallery/cloud folders may save or synchronize; prefer a local destination. The channel does not upload data or credentials to the website; test logs must not contain real customer data.

Previous lab1/lab2/ChinaTech 0.2 APKs, README and SHA lists retain their original bytes. ChinaTech 0.2 has a known native TLS defect and its old APK does not include the fix: it remains for reference, with lab3 recommended. Older APKs do not prove lab3 or complete migration success.
