# ChinaTech Phone Assistant 0.5.1-test

Release: `phone-assistant-0.5.1` · Version code: `6` · Android 8+ · Package: `in.chinatech.phoneassistant`

## 中文

两台手机安装同一版本，先保持联网。新手机选择本机接收目录并生成准备码；旧手机选择已授权资料、扫描准备码，冻结清单并生成回应码；新手机扫描回应码取得双方任务许可，再开启热点或使用同一 Wi-Fi；旧手机扫描最终码并按系统提示连接。旧协议需要更新。

文件与完整清单只在两台手机间传输，网站接收任务身份及计划、结果摘要。中断后从任务记录恢复原计划和目标，重验已保存对象并重传不完整文件。发送端收到接收端持久回执的最终确认才报告完成；完成后的接收端只向原配对设备回放原回执。安全取消与完成分别记录，离线结果保留待回报。

0.5.1 补齐“网站已建立任务、本地尚未保存许可”的记录恢复：先核对原实例、任务、TLS 身份和冻结范围，再取回原许可；保留旧0.5任务的版本、job、请求和 nonce。网站暂停或版本前进时，已有任务仍按原许可恢复；服务器不存在的任务在暂停时不会被重新创建，也不会误报完成。

当前0.5.1已在两个 Android 16 隔离模拟器验证：真实网站准入、三次二维码信息交换、实际发送／接收引擎、零字节和65537字节合成文件、目标 SHA256 与回执、双端持久完成、网站结果回报和安全结束。另验了旧0.5两角色缺失本地许可的原任务恢复，以及当前版本暂停时 NOT_FOUND 拒绝新建并保留非终态记录。旧0.5的名义流程、TLS／SQLite和故障测试仅作历史证据，未与新版结果合并计为独立总数。

物理品牌手机、其他 Android 版本、厂商权限／省电行为、自动热点、光学相机扫码及 Android 系统更新安装界面仍待验收。模拟器使用现有 Wi-Fi；二维码图像解码不等于真机拍摄验证。更新包核对网站签名、完整长度／SHA256、包名、发行身份、递增版本及原证书后，交给系统提示并由用户确认。受保护应用私有资料、聊天和系统数据不在本工具权限内；图库和通讯录导入需另行确认。

## Italiano

Installa la stessa versione su entrambi i telefoni e mantienili prima online. Il nuovo sceglie una cartella locale e mostra il codice iniziale; il vecchio seleziona dati autorizzati, scansiona il codice e mostra una risposta con l’elenco congelato; il nuovo verifica la risposta e ottiene le autorizzazioni prima di attivare hotspot o usare la stessa Wi-Fi. Il vecchio scansiona il codice finale e segue le richieste del sistema. Il vecchio protocollo richiede aggiornamento.

File ed elenco completo restano fra i telefoni; il sito riceve identità e hash di piano/esito. Il ripristino conserva piano e destinazione originali, riverifica gli oggetti salvati e ritrasmette quelli incompleti. Il mittente dichiara completato solo dopo la conferma finale della ricevuta persistente del destinatario. Una ricezione completata ripete soltanto la ricevuta originale al dispositivo abbinato. Annullamento e successo sono distinti; gli esiti offline restano in attesa.

La 0.5.1 completa il ripristino dal registro quando il sito ha creato l’attività ma l’autorizzazione non è ancora salvata localmente: controlla prima istanza, attività, identità TLS e ambito originali, poi recupera la stessa autorizzazione. Le attività 0.5 conservano versione, job, richiesta e nonce. Sospensione o nuova versione non trasformano il ripristino in una nuova attività; un job inesistente non viene creato durante la sospensione né dichiarato completato.

La versione 0.5.1 è stata verificata su due emulatori Android 16 isolati: sito reale, tre codici, entrambi i motori, file sintetici vuoto e da 65537 byte, SHA256 e ricevute, completamento persistente, esiti al sito e chiusura sicura. Sono stati verificati anche i due ruoli 0.5 con autorizzazione locale mancante e il rifiuto NOT_FOUND della versione corrente sospesa, mantenendo il registro non terminale. I precedenti test 0.5 di flusso nominale, TLS/SQLite e guasti restano storici; non sono sommati come scenari indipendenti della nuova versione.

Restano da verificare marche fisiche, altre versioni Android, permessi e risparmio energetico OEM, hotspot automatico, scansione ottica e schermate di installazione degli aggiornamenti Android. Gli emulatori usano Wi-Fi esistente; decodificare un’immagine QR non prova la fotocamera fisica. L’aggiornamento controlla firma del sito, lunghezza/SHA256, pacchetto, release, versione crescente e certificato prima delle richieste del sistema; l’utente conferma. Dati privati protetti, chat e dati di sistema sono esclusi. Importazioni in galleria e contatti richiedono conferma separata.

## English

Install the same version on both phones and keep both online first. The new phone chooses a local destination and shows setup QR; the old phone selects authorized data, scans setup QR and shows a response with the frozen manifest; the new phone scans the response and obtains both permissions before enabling hotspot or using the same Wi-Fi. The old phone scans final QR and follows system prompts. The old protocol requires an update.

Files and the full manifest move only between the phones; the website receives task identity and plan/result digests. Recovery retains the original plan and destination, rechecks saved objects and retransmits incomplete files. The sender reports completion only after the receiver has persisted its receipt and returned final acknowledgement. A completed receiver only replays that original receipt to its paired peer. Cancellation and success are separate; offline outcomes remain pending.

Version 0.5.1 completes record recovery when the website has created a task but its permit has not yet been saved locally. It checks the original instance, job, TLS identity and frozen scope before fetching the original permit. Existing 0.5 tasks retain their version, job, request and nonce. Pause or a newer release does not turn recovery into a new task; a nonexistent job is not created while paused or falsely reported complete.

The current 0.5.1 build passed on two isolated Android 16 emulators: real website admission, all three code exchanges, both production engines, empty and 65537-byte synthetic files, saved-file SHA256 and receipts, durable completion, website outcomes and safe close. Separate runs covered both original 0.5 roles with a missing local permit, plus a current-version NOT_FOUND task remaining blocked and nonterminal while paused. Earlier 0.5 nominal-flow, TLS/SQLite and fault results remain historical; they are not summed as independent new-version scenarios.

Physical brands, other Android versions, OEM permission/power behavior, automatic hotspot, optical camera scanning and Android system update installation UI remain unverified. The emulators used existing Wi-Fi; QR image decoding does not prove physical camera acceptance. Updates check website signature, full bytes/SHA256, package, release identity, increasing version and original certificate before normal system prompts; the user confirms installation. Protected private app data, chats and system data are outside this tool’s permission. Gallery and contact imports require separate confirmation.
