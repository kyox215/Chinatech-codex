from pathlib import Path
import hashlib,json,shutil
r=Path(__file__).resolve().parents[2];p=r/'.local/android-phone-gate/native-proof';v=json.loads((p/'apk-verification.json').read_text());apk=r/'.local/android-phone-gate/delivery/ChinaTech-Phone-Assistant.apk';out=r/'public/toolbox/phone-current';out.mkdir(parents=True,exist_ok=True)
assert v['releaseId']=='phone-assistant-0.5.1' and hashlib.sha256(apk.read_bytes()).hexdigest()==v['apkSha256']
shutil.copyfile(apk,out/'ChinaTech-Phone-Assistant.apk')
readme='''# ChinaTech Phone Assistant 0.5.1-test

中文：Android 8及以上测试版，沿用原包名与签名证书。两机先联网：新机选本机接收目录并生成准备码；旧机选择资料后扫码，冻结清单并出回应码；新机扫描回应码取得接收许可后才启热点；旧机扫描最终码连接。旧版协议不回退。

文件和清单仅在两机交换，网站仅接收任务身份与摘要。中断后从记录恢复原计划与目标；已完成接收端只回放原回执。安全取消与完成分别记录，离线结果待补报。更新核验签名、完整长度/SHA256、包名、发行ID、递增版本和原证书后进入系统安装提示。品牌真机、热点及系统安装仍需分别验收，不承诺受保护应用私有资料迁移。

Italiano: Build di test per Android 8+, stesso pacchetto e certificato. Entrambi i telefoni prima online: il nuovo sceglie una cartella locale e mostra il codice iniziale; il vecchio sceglie i dati, lo scansiona e mostra la risposta con il piano congelato; il nuovo verifica la risposta e ottiene la propria autorizzazione prima di attivare hotspot; il vecchio scansiona il codice finale. Nessun ripiego sul vecchio protocollo.

File ed elenco restano sui due telefoni; il sito riceve solo identità e hash. Il ripristino usa piano e destinazione originali; una ricezione completata ripete solo la ricevuta. Annullamento e successo sono distinti, gli esiti offline restano in attesa. Aggiornamenti verificano firma, lunghezza/SHA256, pacchetto, release, versione crescente e certificato prima dell’installazione di sistema. Marche fisiche, hotspot e installazione richiedono verifiche separate; i dati privati protetti sono esclusi.

English: Android 8+ testing candidate. Existing package and signing certificate are retained for normal system updates.

Both phones must be online first. On the new phone choose a receiving folder and generate setup QR. On the old phone select data, scan setup QR and show response QR. The new phone scans response and obtains its own permission before enabling hotspot. The old phone scans final QR to connect.

Only the new protocol is accepted. Selection and metadata are frozen before network changes; complete metadata is checked before any object write. Files remain local between phones; the website receives task identity and hashes only.

Task records can restore only the original scope. Keep both task records until both phones show verified completion. A completed receiver may replay the original final receipt to its pinned original peer, but cannot receive another transfer under that task. Safe cancellation is recorded separately from success.

Updates verify signed website metadata, full APK SHA256 and bytes, package, release and original signing certificate, then use Android system permission/install prompts. The user controls installation.

This build has local JVM, SQLite and SDK build evidence. Physical-brand transfer, OEM Wi-Fi behavior, camera and system-install acceptance must be verified separately. Private app data, protected chats and system data are outside this tool's permission.
'''
(out/'README.md').write_text(readme)
metadata={'version':v['versionName'],'versionCode':v['versionCode'],'releaseId':v['releaseId'],'available':False,'apkPath':'/toolbox/phone-current/ChinaTech-Phone-Assistant.apk','instructionsPath':'/toolbox/phone-current/README.md','sha256':v['apkSha256'],'signerSha256':v['signerCertificateSha256'],'bytes':v['apkBytes'],'minAndroid':8,'targetApi':37}
(r/'lib/toolbox/android-assistant-release.ts').write_text('/** Candidate remains unavailable until native runtime and release gates pass. */\nexport const androidAssistantRelease = '+json.dumps(metadata,indent=2)+' as const;\n')
(out/'checksums.json').write_text(json.dumps({'releaseId':v['releaseId'],'files':[{'name':x.name,'sha256':hashlib.sha256(x.read_bytes()).hexdigest(),'bytes':x.stat().st_size} for x in sorted(out.iterdir()) if x.is_file() and x.name!='checksums.json']},indent=2)+'\n')
# Exact source input list, kept local; do not create a public source ZIP or copy to another checkout.
inputs=[]
for folder in ['android/phone-assistant','scripts/android-assistant','tests/android-phone-gate','tests/android-phone-gate-native']:
 for x in sorted((r/folder).rglob('*')):
  if x.is_file():inputs.append({'path':str(x.relative_to(r)),'sha256':hashlib.sha256(x.read_bytes()).hexdigest(),'bytes':x.stat().st_size})
x=r/'tests/android-phone-gate.test.py';inputs.append({'path':str(x.relative_to(r)),'sha256':hashlib.sha256(x.read_bytes()).hexdigest(),'bytes':x.stat().st_size})
(r/'.local/android-phone-gate/build-inputs.json').write_text(json.dumps({'releaseId':v['releaseId'],'apk':v,'inputs':inputs,'published':False},indent=2)+'\n')
print(json.dumps(metadata,indent=2))
