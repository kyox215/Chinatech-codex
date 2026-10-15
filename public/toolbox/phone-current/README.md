# ChinaTech Phone Assistant 0.5.0-test

Release ID: `phone-assistant-0.5.0` · Android 8+ · Package: `in.chinatech.phoneassistant`

## 中文

两台手机安装同一版本，先保持联网。新手机选择本机接收目录并生成准备码；旧手机选择已授权资料，扫描准备码，冻结清单并生成回应码；新手机扫描回应码，取得双方任务许可后再开启热点或使用同一 Wi-Fi；旧手机扫描最终码并按系统提示连接。只接受新版协议，旧配对码需要更新。

文件内容和完整清单仅在两台手机之间传输，网站接收任务身份及计划、结果摘要。中断后从任务记录恢复原计划与目标，已保存对象重新核验，不完整文件重新传输。接收端持久保存完成回执后，发送端收到最终确认才报告完成；接收完成后的监听只向原配对设备回放原回执。安全取消与完成分别记录，离线结果保留待回报。

本版已在两个 Android 16 隔离模拟器的现有 Wi-Fi 上，通过真实网站准入、三次二维码信息交换和实际发送／接收引擎测试：零字节及65537字节合成文件逐字节传输、目标文件 SHA256 和回执核对、双端持久完成、网站结果回报，以及结束接收后保持完成状态。独立运行还核验了 Android Keystore 设备证明、AES 加密日志重开、双向 TLS 正反例、SQLite 加法升级、角色许可与旧码拒绝；接收端故障测试核验了错误清单拒绝、最终确认丢失后仅回放回执，以及恢复原目标目录。不同测试覆盖有重叠，不代表品牌真机通过数量。

这些证据不证明物理品牌手机、其他 Android 版本、厂商权限／省电行为、自动热点、光学相机扫码或 Android 系统更新安装界面已经验收。二维码图像解码与模拟器信息交换通过，不等于真机拍摄扫描通过。更新包会核对网站签名、完整长度／SHA256、包名、发行身份、递增版本和原证书，再交给系统权限与安装提示；用户仍须确认。受保护应用私有资料、聊天记录及系统数据不在本工具权限内，图库和通讯录导入需另行确认。

## Italiano

Installa la stessa versione su entrambi i telefoni e mantienili prima online. Il nuovo telefono sceglie una cartella locale e mostra il codice iniziale; il vecchio seleziona dati autorizzati, scansiona il codice e mostra la risposta con l’elenco congelato; il nuovo scansiona la risposta e ottiene le autorizzazioni prima di attivare hotspot o usare la stessa Wi-Fi. Il vecchio scansiona il codice finale e segue le richieste del sistema. Non è previsto ripiego sul vecchio protocollo.

File ed elenco completo passano solo fra i telefoni; il sito riceve identità e hash di piano/esito. Il ripristino mantiene piano e destinazione originali, riverifica gli oggetti salvati e ritrasmette quelli incompleti. Il mittente dichiara completato solo dopo la conferma finale della ricevuta persistente del destinatario. Dopo il completamento, il destinatario può soltanto ripetere la stessa ricevuta al dispositivo originale. Annullamento e successo sono distinti; gli esiti offline restano in attesa.

Questa versione ha superato un flusso reale su due emulatori Android 16 isolati con Wi-Fi esistente: autorizzazione del sito, scambio dei tre codici, entrambi i motori, file sintetici vuoto e da 65537 byte, SHA256 dei file salvati, ricevute, completamento persistente, invio degli esiti al sito e chiusura senza trasformare il successo in annullamento. Verifiche separate coprono Keystore, riapertura del registro AES, TLS reciproco positivo/negativo, aggiornamento SQLite additivo, autorizzazioni dei ruoli e rifiuto dei vecchi codici. I guasti del destinatario includono elenco errato, perdita della conferma finale con sola ripetizione della ricevuta e ripristino della destinazione originale. Le coperture si sovrappongono e non sono un conteggio di marche fisiche verificate.

Restano da verificare dispositivi fisici, altre versioni Android, permessi e risparmio energetico OEM, hotspot automatico, scansione ottica e interfaccia di installazione degli aggiornamenti Android. Decodifica di immagini QR e scambio su emulatori non dimostrano la scansione con una fotocamera fisica. L’aggiornamento controlla firma del sito, lunghezza/SHA256, pacchetto, release, versione crescente e certificato originale prima delle richieste del sistema; l’utente conferma l’installazione. Dati privati protetti, chat e dati di sistema sono esclusi. Importazione in galleria e contatti richiede conferma separata.

## English

Install the same version on both phones and keep both online first. The new phone chooses a local destination and shows setup QR; the old phone selects authorized data, scans setup QR and shows a response with a frozen manifest; the new phone scans the response and obtains both task permissions before enabling hotspot or using the same Wi-Fi. The old phone scans final QR and follows system connection prompts. There is no downgrade to the old protocol.

Files and the full manifest move only between the phones; the website receives task identity and plan/result digests. Recovery retains the original plan and destination, rechecks saved objects and retransmits incomplete files. The sender reports completion only after the receiver has persisted its final receipt and returned acknowledgement. A completed receiver can only replay that original receipt to its original paired peer. Cancellation and success are separate; offline outcomes remain pending.

This version passed a real flow on two isolated Android 16 emulators using existing Wi-Fi: normal website admission, all three code exchanges, both production transfer engines, empty and 65537-byte synthetic files, saved-file SHA256 and receipts, durable completion on both sides, website outcome reporting, and safe completion close. Separate runs verified Keystore device proofs, AES journal reopening, positive/negative mutual TLS, additive SQLite upgrades, role permissions and refusal of old codes. Receiver fault tests covered a wrong manifest, discarded final acknowledgement followed by receipt-only recovery, and restoration of the original destination. Suites overlap; they are not a count of verified physical brands.

Physical brands, other Android versions, OEM permission/power behavior, automatic hotspot, optical camera scanning and Android system update installation UI remain unverified. QR image decoding and emulator code exchange do not prove physical camera acceptance. Updates check website signature, full bytes/SHA256, package, release identity, increasing version and original signing certificate before normal system permission/install prompts; the user confirms installation. Protected private app data, chats and system data are outside this tool’s permission. Gallery and contact imports require separate confirmation.
