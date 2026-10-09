# Mi Mover 原版新机入口解限

版本4.5.7.5，versionCode45708，com.miui.huanji；原包min21/target35。独立实验签名，不是小米官方更新。

## 中文

此版从原版APK制作，只开放非MIUI手机首页的新机卡片。保留原界面、原语言、原资料分类、原传输协议与原恢复代码；没有新增页面、分类或自有引擎。DEX正文仅MainActivity.h2的3字节变化，另更新DEX校验；Manifest只去系统sharedUID并递增版本号，其他2930条目原字节保留，没有classes3。

未安装官方Mi Mover的安卓手机可安装此原包名实验APK。已安装官方签名版时不能覆盖；请保留官方版和原资料，不为试验卸载它。此包与前一错误lab2不是同一个包名；lab2已撤下，此版没有它的传输或恢复实现。

打开原首页，点击New/新，进入原版旧设备来源选择；Old/旧保留原权限说明和流程。原版提供的Xiaomi、Android和Apple选项没有被改写。原语言保持；此App没有新增意语翻译。修改证明见MINIMAL-PATCH.json。

验证仅非MIUI Android16/API36 ARM64独立模拟器的原新/旧入口、来源选项、返回与重开。没有验证OPPO/Motorola/Samsung等实体手机或完整原协议迁移；Android5最低版本是原Manifest声明，不代表旧版本实测。原热点、安装、短信及私库还原仍依赖系统/厂商权限；没有改变这些权限，也没有伪造MIUI身份或完成状态。只解入口不等于完整跨品牌收发已可用。

## Italiano

Patch sperimentale dell’APK originale: apre soltanto l’accesso Nuovo sui telefoni senza MIUI. Mantiene interfaccia, lingue, categorie, protocollo e ripristino originali; nessun nuovo motore o pagina. Cambia3 byte del ramo iniziale e le checksum DEX; il manifest rimuove lo sharedUID di sistema e aumenta versionCode. Nessun classes3.

Firma indipendente, pacchetto originale: non aggiorna l’app firmata Xiaomi. Conserva l’app ufficiale e i dati; non disinstallarla per provare questa patch. Il precedente lab2 è stato ritirato e il suo motore non è incluso. New apre la selezione originale Xiaomi/Android/Apple; Old conserva la guida ai permessi. Le lingue dell’app restano quelle originali, senza nuova traduzione italiana.

Verificati solo gli accessi e la navigazione su un emulatore Android16 ARM64. Telefoni reali OPPO/Motorola/Samsung, vecchie versioni e migrazione completa non verificati. Android5 è il minimo dichiarato dal manifest originale. Hotspot, installazione, SMS e dati privati continuano a dipendere da permessi di sistema/produttore. Nessuna falsa identità MIUI o stato di completamento.

## English

An experimental patch of the original APK: only opens the New-phone entry on non-MIUI phones. Original interface, languages, data categories, transfer protocol and restoration implementation are retained. No new engine or page. Changes3 bytes of the home-screen branch and DEX checksums; the manifest removes the system shared UID and increments versionCode. No classes3.

Independently signed, original package name: it cannot update Xiaomi’s officially signed app. Keep the official app and originals; do not uninstall it to test this patch. The rejected lab2 has been withdrawn and its engine is not included. New opens the original Xiaomi/Android/Apple source selection; Old retains its permission guide. App languages remain original, without an added Italian translation.

Only entry and navigation were verified on a non-MIUI Android16 ARM64 emulator. Physical OPPO/Motorola/Samsung phones, older Android versions and full migration are unverified. Android5 is the original manifest’s declared minimum. Original hotspot, installation, SMS and private-data restoration still depend on system/vendor permissions. No spoofed MIUI identity or invented completion states.

## Integrity

APK SHA-256: `593998e7b3769cc0f33e300183ab78943700996fcece1d0432b4d1a9d23fee1f`

Signer SHA-256: `1b71b70be3bb58e2db847aa71029ca2c071e467c60f5babef62a841eb00efc75`
