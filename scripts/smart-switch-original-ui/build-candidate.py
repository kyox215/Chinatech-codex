from pathlib import Path
import zipfile,struct,copy,subprocess,os,hashlib,json,shutil
r=Path(__file__).resolve().parents[2];b=r/'.local/smart-switch-original-ui';build=b/'candidate-build';build.mkdir(exist_ok=True)
for d in ['classes','dex']:
 if (build/d).exists():shutil.rmtree(build/d)
 (build/d).mkdir()
j=r/'.local/android-assistant/toolchain/jdk/jdk-21.0.12.1+1/Contents/Home';bt=r/'.local/android-assistant/toolchain/sdk/android-16';api=r/'.local/android-assistant/toolchain/sdk/android-37.0/android.jar';shade=r/'.local/smartswitch-universal/zxing-shaded.jar';env=dict(os.environ,JAVA_HOME=str(j),PATH=str(j/'bin')+os.pathsep+os.environ['PATH'])
def run(name,args):
 with (b/(name+'.log')).open('w') as f:subprocess.run([str(x) for x in args],env=env,check=True,stdout=f,stderr=subprocess.STDOUT)
files=list((r/'android/smart-switch-original-ui/src/main/java').rglob('*.java'))+list((r/'android/smart-switch-original-ui/compile-stubs').rglob('*.java'));(build/'sources.args').write_text('\n'.join('"'+str(p)+'"' for p in files))
run('candidate-javac',[j/'bin/javac','--release','8','-encoding','UTF-8','-cp',str(api)+os.pathsep+str(shade),'-d',build/'classes','@'+str(build/'sources.args')]);run('candidate-jar',[j/'bin/jar','--create','--file',build/'helper.jar','-C',build/'classes','in']);run('candidate-d8',[bt/'d8','--lib',api,'--min-api','26','--output',build/'dex',build/'helper.jar',shade])
from binary_xml import chunks,pool,mkpool
old=b/'SmartSwitch-original-ui-shell.apk'
with zipfile.ZipFile(old) as z:a=chunks(z.read('AndroidManifest.xml'))
strings=pool(a[0]);extra=None;owner=None;capturing=None;depth=0
for c in a[2:]:
 kind=struct.unpack_from('<H',c)[0];name=strings[struct.unpack_from('<I',c,20)[0]] if kind in [0x102,0x103] else ''
 if kind==0x102 and name=='activity':
  start,size,count=struct.unpack_from('<HHH',c,24);owner=next(strings[struct.unpack_from('<I',c,16+start+i*size+16)[0]] for i in range(count) if strings[struct.unpack_from('<I',c,16+start+i*size+4)[0]]=='name')
  if owner=='in.chinatech.smartswitchbridge.MainActivity':capturing=[];depth=0
 if capturing is not None:
  capturing.append(bytearray(c));depth+=1 if kind==0x102 else -1 if kind==0x103 else 0
  if depth==0:extra=capturing;capturing=None
assert extra is not None
newname='in.chinatech.smartswitchbridge.OriginalFlowActivity';strings.append(newname);strings.append('3.7.73.4-lab4')
node=extra[0];start,size,count=struct.unpack_from('<HHH',node,24)
for i in range(count):
 p=16+start+i*size;name=strings[struct.unpack_from('<I',node,p+4)[0]]
 if name=='name':v=strings.index(newname);struct.pack_into('<I',node,p+8,v);struct.pack_into('<I',node,p+16,v)
 if name=='exported':struct.pack_into('<I',node,p+16,0)
 if name=='theme':struct.pack_into('<I',node,p+16,0x7f1201c6)
# Delete obsolete custom activities; retain service with the new original-page notification target.
out=[];skip=0
for c in a:
 k=struct.unpack_from('<H',c)[0];name=strings[struct.unpack_from('<I',c,20)[0]] if k in [0x102,0x103] else ''
 if not skip and k==0x102 and name=='activity':
  st,sz,ct=struct.unpack_from('<HHH',c,24);owner=next(strings[struct.unpack_from('<I',c,16+st+i*sz+16)[0]] for i in range(ct) if strings[struct.unpack_from('<I',c,16+st+i*sz+4)[0]]=='name')
  if owner in ['in.chinatech.smartswitchbridge.MainActivity','in.chinatech.smartswitchbridge.LaunchActivity','in.chinatech.smartswitchbridge.LiveQrActivity']:skip=1;continue
 if skip:
  skip+=1 if k==0x102 else -1 if k==0x103 else 0;continue
 if k==0x102 and name=='manifest':
  st,sz,ct=struct.unpack_from('<HHH',c,24)
  for i in range(ct):
   p=16+st+i*sz
   if strings[struct.unpack_from('<I',c,p+4)[0]]=='versionCode':struct.pack_into('<I',c,p+16,377304135)
   if strings[struct.unpack_from('<I',c,p+4)[0]]=='versionName':
    v=strings.index('3.7.73.4-lab4');struct.pack_into('<I',c,p+8,v);struct.pack_into('<I',c,p+16,v)
 out.append(c)
a=out;app_end=next(i for i,c in enumerate(a) if struct.unpack_from('<H',c)[0]==0x103 and strings[struct.unpack_from('<I',c,20)[0]]=='application');a[app_end:app_end]=extra
proof=[]
for coexist in [True,False]:
 st=strings if coexist else [t.replace('com.sec.android.easyMover.chinatech','com.sec.android.easyMover') for t in strings];a[0]=mkpool(st);payload=b''.join(a);manifest=struct.pack('<HHI',3,8,8+len(payload))+payload
 name='SmartSwitch-3.7.73.4-original-ui-'+('coexist-' if coexist else '')+'lab4.apk'
 with zipfile.ZipFile(old) as src,zipfile.ZipFile(build/'unsigned.apk','w') as dst:
  for info in src.infolist():
   n=info.filename;u=n.upper()
   if u=='META-INF/MANIFEST.MF' or u.startswith('META-INF/') and u.endswith(('.SF','.RSA','.DSA','.EC')):continue
   data=manifest if n=='AndroidManifest.xml' else (build/'dex/classes.dex').read_bytes() if n=='classes7.dex' else (b/'classes5.dex').read_bytes() if n=='classes5.dex' else src.read(info);dst.writestr(copy.copy(info),data)
 apk=b/name;run(name+'-align',[bt/'zipalign','-P','16','-f','4',build/'unsigned.apk',build/'aligned.apk']);run(name+'-sign',[bt/'apksigner','sign','--v4-signing-enabled','false','--ks',r/'.local/smart-switch-experiment/private/lab1.p12','--ks-key-alias','lab1','--ks-pass','file:'+str(r/'.local/smart-switch-experiment/private/password.txt'),'--out',apk,build/'aligned.apk']);run(name+'-signature',[bt/'apksigner','verify','--verbose','--print-certs',apk]);run(name+'-badging',[bt/'aapt2','dump','badging',apk]);run(name+'-manifest',[bt/'aapt2','dump','xmltree',apk,'--file','AndroidManifest.xml'])
 proof.append({'file':name,'apkSha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'bytes':apk.stat().st_size,'versionCode':377304135,'originalLauncher':True,'originalResourceLayouts':True,'actualTransferVerified':False,'published':False})
with zipfile.ZipFile(build/'helper.jar') as z:assert all(not n.startswith('androidx/') for n in z.namelist());assert not any('/MainActivity' in n or '/LaunchActivity' in n or '/LiveQrActivity' in n for n in z.namelist())
(b/'candidate-artifacts.json').write_text(json.dumps(proof,indent=2));print(json.dumps(proof,indent=2))
