# Smart Switch 接收入口实验版 lab1 / Esperimento / Experiment

## 中文

这是基于3.7.73.4制作的本地实验修改版，**不是三星官方更新，也不是已经验证的完整跨品牌换机工具**。原样本来自与查询时Galaxy Store列示版本一致的公开镜像；原签名自洽，但未取得第一方商店二进制作独立比对。

修改仅限普通启动时主界面的双按钮选择，使非三星手机可尝试“发送／接收”入口；特殊launch_mode 20保持原行为。真实品牌识别、系统权限、签名检查、配套服务及其他限制均保持原规则。无线／有线协议和热点角色也未改；没有强制新机创建热点。APP名称、图标和翻译沿原包。

APK：`SmartSwitch-3.7.73.4-receiver-entry-lab1.apk`，41,708,257字节。支持包结构标示为Android 6.0+、ARM32/ARM64；实际设备兼容性未验证。实验签名不同于三星，**不能覆盖官方或系统预装版本**。建议使用尚未安装官方版的备用手机，不以卸载原版或清空资料作为测试准备。

测试步骤：

1. 把APK复制到备用手机，用文件管理器打开，按系统提示处理安装来源。若系统拒绝，记录非敏感错误，先停止。
2. 首先确认能否启动、是否出现发送／接收按钮、接收是否进入来源设备选择；这些步骤尚未实测。
3. 首轮只用合成照片、普通测试文件和测试联系人，逐类确认对端连接、传输和目标实际可用结果。
4. 记录两端品牌／型号／安卓版本、所用原版或实验版本、网络方式与失败步骤。不要把文件接收成功等同联系人／日历／APP已经恢复。

已验证DEX局部修改、资源／Manifest保留、v1/v2/v3签名及对齐。未验证Android安装／启动、真实热点、非三星接收、资料恢复、配套服务或跨品牌兼容；没有迁移客户资料、发布或升级ChinaTech 0.2客户端。

`VERIFICATION.json`记录实际检查；`SHA256SUMS.txt`校验交付文件；`patch-tools.zip`只含自主补丁工具与记录，不含完整三星源码、原APK或私钥。重现需同哈希原包及记录中的项目工具，不是手机安装程序。

## Italiano

Questa modifica locale sperimentale si basa sulla versione 3.7.73.4. **Non è un aggiornamento ufficiale Samsung né uno strumento completo di migrazione tra marchi già verificato.** Il campione proviene da un mirror pubblico e corrisponde alla versione mostrata nel Galaxy Store durante la ricerca. La firma originale è coerente, ma non è stato ottenuto un APK direttamente dallo store per un confronto indipendente.

La sola modifica riguarda la scelta dei due pulsanti nella schermata iniziale normale, per provare Invio/Ricezione su dispositivi non Samsung. La modalità speciale launch_mode 20 resta invariata. Identificazione reale del marchio, autorizzazioni, controlli della firma, servizi ausiliari e altre limitazioni rimangono originali. Non cambiano protocolli wireless/via cavo o ruoli hotspot; il nuovo telefono non viene forzato a creare un hotspot. Nome, icona e traduzioni restano quelli del pacchetto originale.

APK: `SmartSwitch-3.7.73.4-receiver-entry-lab1.apk`, 41.708.257 byte. I metadati indicano Android 6.0+ e ARM32/ARM64; la compatibilità reale non è stata verificata. La firma sperimentale è diversa: **non può aggiornare la versione ufficiale o preinstallata**. Usare preferibilmente un telefono di prova senza Smart Switch ufficiale, senza disinstallare l'originale o cancellare dati per preparare il test.

1. Copiare l'APK sul telefono di prova e aprirlo con il gestore file, seguendo le richieste del sistema sull'origine dell'installazione. Se viene bloccato, annotare l'errore senza dati personali e fermarsi.
2. Verificare prima avvio, pulsanti Invio/Ricezione e accesso alla scelta del dispositivo sorgente. Questi passaggi non sono stati provati.
3. Usare inizialmente solo foto, file e contatti sintetici; controllare connessione, trasferimento e reale disponibilità dei dati sul destinatario per ogni categoria.
4. Annotare marca/modello/versione Android di entrambi, versione ufficiale o sperimentale, connessione e punto di errore. Un file ricevuto non prova il ripristino di contatti, calendario o app.

Verificati: modifica locale DEX, conservazione di risorse/Manifest, firme v1/v2/v3 e allineamento. Non verificati: installazione/avvio Android, hotspot reale, ricezione non Samsung, ripristino, servizi ausiliari e compatibilità tra marchi. Nessuna migrazione di dati di clienti o modifica del client ChinaTech 0.2. La disponibilità sul sito non dimostra che la migrazione sui telefoni sia stata verificata.

`VERIFICATION.json` contiene le verifiche; `SHA256SUMS.txt` contiene gli hash; `patch-tools.zip` include solo strumenti e registri della modifica, senza sorgenti Samsung completi, APK originale o chiavi private. La riproduzione richiede il campione con lo stesso hash e gli strumenti indicati; lo ZIP non è un'app per il telefono.

## English

This local experimental modification is based on 3.7.73.4. **It is not an official Samsung update or a verified complete cross-brand migration tool.** The sample came from a public mirror matching the Galaxy Store version observed during research. Its original signature is self-consistent; no first-party store binary was obtained for independent comparison.

The only modification changes the normal home-screen two-button selector, allowing an attempt at Send/Receive on non-Samsung phones. Special launch_mode 20 remains unchanged. Real manufacturer detection, permissions, signature checks, companion services and other restrictions retain their original rules. Wireless/cable protocols and hotspot roles are unchanged; this does not force the new phone to create a hotspot. App name, icon and translations remain original.

APK: `SmartSwitch-3.7.73.4-receiver-entry-lab1.apk`, 41,708,257 bytes. Package metadata specifies Android 6.0+ and ARM32/ARM64; actual device compatibility is unverified. The independent experimental signature **cannot update an official or preinstalled version**. Prefer a spare phone without official Smart Switch; do not uninstall the original or erase data as test preparation.

1. Copy the APK to the spare phone and open it using a file manager, following system prompts about the installation source. If installation is blocked, record a non-sensitive error and stop.
2. First check launch, Send/Receive buttons and entry to the source-device selection screen. These steps have not been tested.
3. Initially use only synthetic photos, ordinary test files and test contacts. Check connection, transfer and usable destination results separately for each category.
4. Record both brands/models/Android versions, official or experimental app versions, connection and failure stage. Receiving a file does not prove contacts, calendars or apps were restored.

Verified: local DEX change, preserved resources/Manifest, v1/v2/v3 signatures and alignment. Unverified: Android installation/launch, actual hotspot, non-Samsung reception, restoration, companion services and cross-brand compatibility. No customer data migration or ChinaTech 0.2 client update occurred. Website availability does not verify Android migration.

`VERIFICATION.json` records checks; `SHA256SUMS.txt` lists hashes; `patch-tools.zip` contains only our patch tools and records, without complete Samsung sources, original APK or private keys. Reproduction requires the matching original sample and recorded tools; the ZIP is not a phone application.
