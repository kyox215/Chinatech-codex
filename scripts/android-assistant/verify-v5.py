from pathlib import Path
import hashlib,json,xml.etree.ElementTree as ET,zipfile
r=Path(__file__).resolve().parents[2];p=r/'.local/android-phone-gate/native-proof';v=json.loads((p/'apk-verification.json').read_text());apk=r/'.local/android-phone-gate/delivery/ChinaTech-Phone-Assistant.apk';a='{http://schemas.android.com/apk/res/android}';m=ET.parse(r/'android/phone-assistant/app/src/main/AndroidManifest.xml').getroot()
inputs=json.loads((p/'source-inputs.json').read_text());source=r/'android/phone-assistant/app/src/main'
assert inputs['sha256']==v['sourceInputsSha256']
for item in inputs['files']:assert hashlib.sha256((source/item['path']).read_bytes()).hexdigest()==item['sha256'],item['path']
assert hashlib.sha256(apk.read_bytes()).hexdigest()==v['apkSha256'];assert m.get('package')==v['package'];assert m.get(a+'versionCode')=='5';assert m.get(a+'versionName')=='0.5.0-test';assert v['releaseId']=='phone-assistant-0.5.0'
permissions={e.get(a+'name'):e for e in m.findall('uses-permission')};assert not set(permissions)&{'android.permission.MANAGE_EXTERNAL_STORAGE','android.permission.READ_SMS','android.permission.WRITE_SMS','android.permission.READ_CALL_LOG','android.permission.WRITE_CALL_LOG','android.permission.WRITE_CONTACTS','android.permission.QUERY_ALL_PACKAGES','android.permission.LOCAL_MAC_ADDRESS'}
assert permissions['android.permission.WRITE_EXTERNAL_STORAGE'].get(a+'maxSdkVersion')=='28';assert 'android.permission.REQUEST_INSTALL_PACKAGES' in permissions
app=m.find('application');assert app.get(a+'debuggable')=='false' and app.get(a+'allowBackup')=='false';assert app.find('meta-data').get(a+'value')==v['releaseId']
activities={e.get(a+'name'):e.get(a+'exported') for e in app.findall('activity')};assert activities=={'.LaunchActivity':'true','.MainActivity':'false','.LiveQrActivity':'false'};assert app.find('service').get(a+'exported')=='false';provider=app.find('provider');assert provider.get(a+'exported')=='false' and provider.get(a+'grantUriPermissions')=='true'
with zipfile.ZipFile(apk) as z:assert not any(x.startswith('lib/') or 'runtime-test' in x.lower() for x in z.namelist())
badging=(p/'apk-badging.txt').read_text();assert "versionCode='5'" in badging and "minSdkVersion:'26'" in badging and "targetSdkVersion:'37'" in badging
signature=(p/'apk-signature.txt').read_text();assert 'v2 scheme (APK Signature Scheme v2): true' in signature and 'v3 scheme (APK Signature Scheme v3): true' in signature
assert v['signerCertificateSha256']=='bb8969df392a7c575895c4b4e9bb9219847c20bacadd3980a9bcb956f19e1329'
result={'status':'passed','apkSha256':v['apkSha256'],'jniLibraries':0,'exportedActivities':['LaunchActivity'],'permissions':'No root/SMS/call logs/all-files/full-package-query/contact-write. Install request is only verified self-update through normal system UI.','signingSchemes':['v2','v3'],'androidRuntimeProof':False};(p/'static-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
