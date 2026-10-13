from pathlib import Path
import xml.etree.ElementTree as E,json,re
r=Path(__file__).resolve().parents[3];base=r/'android/mimover-universal/src/main';target=base/'java/in/chinatech/mimoverengine'
translations={lang:{s.attrib['name']:''.join(s.itertext()).replace('\\n','\n').replace("\\'","'") for s in E.parse(base/'res'/folder/'strings.xml').getroot()} for lang,folder in [('en','values'),('zh','values-zh'),('it','values-it')]}
updates={
'app_name':('Mi Mover · Universal lab2','小米换机 · 通用 lab2','Mi Mover · Universale lab2'),
'alpha_notice':('Both Android phones need this Mi Mover lab2. Choose data on the old phone; receive and restore approved categories on the new one.','两端安卓手机均需使用此 Mi Mover lab2。旧机选择资料，新机接收并恢复已授权的范围。','Entrambi i telefoni Android devono usare Mi Mover lab2. Seleziona i dati sul vecchio telefono e ripristina le categorie approvate sul nuovo.'),
'qr_invalid':('Invalid or expired universal transfer code. Generate a fresh code on the new phone.','通用传输二维码无效或已过期，请在新机重新生成。','Codice di trasferimento universale non valido o scaduto. Generane uno nuovo sul nuovo telefono.'),
'paste_code':('Paste the new phone pairing code','粘贴新机配对码','Incolla il codice del nuovo telefono'),
'original_restore_unbound':('No restoration result is recorded for this transfer. Open the details to choose restoration for the received files.','本次传输尚无对应恢复结果，可打开明细选择恢复已收文件。','Nessun risultato di ripristino per questo trasferimento. Apri i dettagli per scegliere il ripristino dei file ricevuti.'),
'original_permission_scope':('Permissions for selected transfer','所选传输的权限','Permessi del trasferimento selezionato'),
'original_permission_intro':('Choose the data and restoration categories. Android asks for the corresponding permissions when needed.','选择传输和恢复范围后，按实际需要授予 Android 权限。','Scegli le categorie da trasferire e ripristinare. Android chiederà i permessi necessari.'),
'original_wifi_devices':('Nearby Wi-Fi devices','附近 Wi-Fi 设备','Dispositivi Wi-Fi vicini'),
'original_permission_categories':('Data and restoration categories','资料与恢复范围','Categorie di dati e ripristino'),
'original_permission_prompt':('Allow the Android prompts for the categories you choose.','仅按所选范围核对系统授权提示。','Consenti i permessi Android delle categorie che scegli.'),
'original_local_connection':('Local Wi-Fi connection','本地 Wi-Fi 连接','Connessione Wi-Fi locale'),
'original_local_connection_hint':('Use an automatic hotspot, system hotspot or the same Wi-Fi.','可使用自动热点、系统热点或同一 Wi-Fi。','Usa un hotspot automatico, di sistema o la stessa Wi-Fi.'),
'original_connection_options':('Connection options','连接方式','Opzioni di connessione'),
'original_choose_data':('Select data','选择资料','Seleziona i dati'),
'original_new_phone':('New phone','新手机','Nuovo telefono'),
'original_old_phone':('Old phone','旧手机','Vecchio telefono'),
'original_host_title':('Open Mi Mover lab2 on the old phone','在旧机打开 Mi Mover lab2','Apri Mi Mover lab2 sul vecchio telefono'),
'original_guest_title':('Connect to the new phone','连接新手机','Collega il nuovo telefono'),
'original_unsupported_ios':('This channel needs the same Mi Mover lab2 on two Android phones. An iPhone cannot install this APK.','此通道需两台安卓手机安装同版 Mi Mover lab2。iPhone 无法安装此 APK。','Questo canale richiede Mi Mover lab2 su due telefoni Android. iPhone non può installare questo APK.'),
'original_more_actions':('More actions','更多操作','Altre azioni'),
'original_transfer_title':('Transferring selected data','正在传输所选资料','Trasferimento dei dati selezionati'),
'original_completed_title':('Selected transfer complete','所选资料传输完成','Trasferimento selezionato completato'),
'original_receiving_files':('Saved %1$d / %2$d files','已保存 %1$d / %2$d 个文件','Salvati %1$d / %2$d file'),
'original_sent_files':('Acknowledged %1$d / %2$d files','新机已确认 %1$d / %2$d 个文件','Confermati %1$d / %2$d file'),
'original_details':('Transfer and restoration details','传输与恢复明细','Dettagli di trasferimento e ripristino'),
'original_pair_code_input':('Enter the new phone code','输入新机配对码','Inserisci il codice del nuovo telefono'),
'original_pair_help':('Generate a QR code on the new phone, then scan it here.','在新机生成二维码，然后在此扫描。','Genera un codice QR sul nuovo telefono e scansionalo qui.'),
'original_file_progress':('%1$d selected files','已选 %1$d 个文件','%1$d file selezionati'),
'original_no_items':('No authorized data selected yet','尚未选择已授权资料','Nessun dato autorizzato selezionato'),
'original_page_count':('%1$d items on this page; more items are available with Next.','本页 %1$d 项；更多资料可点下一页。','%1$d elementi in questa pagina; usa Avanti per gli altri.'),
}
for key,values in updates.items():
 for lang,value in zip(['en','zh','it'],values):translations[lang][key]=value
keys=list(translations['en']);assert all(set(d)==set(keys) for d in translations.values())
for k in keys:
 formats=[re.findall(r'%\d+\$[a-z]',translations[l][k]) for l in ['en','zh','it']];assert formats[0]==formats[1]==formats[2],k
ids={k:0x6e010000+i for i,k in enumerate(keys)}
(target/'R.java').write_text('package in.chinatech.mimoverengine;\npublic final class R { public static final class string {\n'+''.join('public static final int '+k+'=0x%08x;\n'%ids[k] for k in keys)+'}}\n')
# Android itself owns Resources/Theme and the original drawable class loader.
for lang,folder in [('en','values'),('zh','values-zh'),('it','values-it')]:
 root=E.Element('resources')
 for key in keys:
  item=E.SubElement(root,'string',{'name':key});item.text=translations[lang][key].replace("'","\\'").replace('\n','\\n')
 path=base/'res'/folder/'strings.xml';path.parent.mkdir(parents=True,exist_ok=True);E.indent(root);path.write_bytes(E.tostring(root,encoding='utf-8',xml_declaration=True))
(r/'.local/mimover-universal-next/resource-ids.txt').write_text(''.join('in.chinatech.mimoverengine:string/'+key+' = 0x%08x\n'%ids[key] for key in keys))
(r/'.local/mimover-universal-next/resource-translations.json').write_text(json.dumps(translations,ensure_ascii=False))
wrapper=target/'BridgeResources.java'
if wrapper.exists():wrapper.unlink()
(r/'.local/mimover-universal-next/resource-verification.json').write_text(json.dumps({'privateIdPrefix':'0x6e','keys':len(keys),'languages':['en','zh','it'],'formatVariablesVerified':True,'normalResourceLoading':True},indent=2)+'\n')
print('Generated',len(keys),'three-language private strings and inspected host IDs')
