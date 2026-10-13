from pathlib import Path
import zipfile,struct,copy,subprocess,os,hashlib,json
r=Path(__file__).resolve().parents[2];b=r/'.local/smart-switch-original-ui';b.mkdir(exist_ok=True)
lab1=r/'public/toolbox/smart-switch-experiment/SmartSwitch-3.7.73.4-receiver-entry-lab1.apk';lab3=r/'public/toolbox/smart-switch-experiment/SmartSwitch-3.7.73.4-universal-coexist-lab3.apk'
assert hashlib.sha256(lab1.read_bytes()).hexdigest()=='7daa79ef27c1a8b63a14638cb03ae33bafe680e946bad4a224635a1d10697de1'
# Reuse project's first-party binary XML parsing routines without executing its mutation stages.
from binary_xml import chunks,pool,mkpool
NONE=0xffffffff
with zipfile.ZipFile(lab1) as z:original=chunks(z.read('AndroidManifest.xml'));original_dex=z.read('classes5.dex')
with zipfile.ZipFile(lab3) as z:current=chunks(z.read('AndroidManifest.xml'))
ss=pool(original[0]);strings=pool(current[0]);mapping={}
for i,t in enumerate(ss):
 if t not in strings:strings.append(t)
 mapping[i]=strings.index(t)
def tag(c):return strings[struct.unpack_from('<I',c,20)[0]]
def attributes(c,st):
 if struct.unpack_from('<H',c)[0]!=0x102:return []
 start,size,count=struct.unpack_from('<HHH',c,24);return [(16+start+i*size,st[struct.unpack_from('<I',c,16+start+i*size+4)[0]]) for i in range(count)]
def value(c,p,st):return st[struct.unpack_from('<I',c,p+16)[0]] if c[p+15]==3 else None
def mapped(c):
 c=bytearray(c);kind=struct.unpack_from('<H',c)[0]
 for pos in [12,16,20]:
  i=struct.unpack_from('<I',c,pos)[0];struct.pack_into('<I',c,pos,NONE if i==NONE else mapping[i])
 if kind==0x102:
  for p,k in attributes(c,strings):
   for pos in [p,p+4,p+8]:
    i=struct.unpack_from('<I',c,pos)[0];struct.pack_into('<I',c,pos,NONE if i==NONE else mapping[i])
   if c[p+15]==3:struct.pack_into('<I',c,p+16,mapping[struct.unpack_from('<I',c,p+16)[0]])
 return c
filters={};owner=None;pending=None;level=0
for c in original[2:]:
 kind=struct.unpack_from('<H',c)[0];name=ss[struct.unpack_from('<I',c,20)[0]] if kind in [0x102,0x103] else ''
 if kind==0x102 and name=='activity':owner=next(value(c,p,ss) for p,k in attributes(c,ss) if k=='name')
 if kind==0x102 and name=='intent-filter':pending=[];level=0
 if pending is not None:
  pending.append(c);level += 1 if kind==0x102 else -1 if kind==0x103 else 0
  if level==0:
   vals=[value(n,p,ss) for n in pending for p,k in attributes(n,ss)]
   if 'android.intent.action.MAIN' in vals and any(t in vals for t in ['android.intent.category.LAUNCHER','android.intent.category.INFO']):filters.setdefault(owner,[]).extend(mapped(n) for n in pending)
   pending=None
 if kind==0x103 and name=='activity':owner=None
out=[];owner=None;skip=0;restored=[]
for c in current:
 kind=struct.unpack_from('<H',c)[0];name=tag(c) if kind in [0x102,0x103] else ''
 if kind==0x102 and name=='activity':owner=next(value(c,p,strings) for p,k in attributes(c,strings) if k=='name')
 if owner=='in.chinatech.smartswitchbridge.LaunchActivity' and kind==0x102 and name=='intent-filter':skip=1;continue
 if skip:
  skip+=1 if kind==0x102 else -1 if kind==0x103 else 0
  continue
 if kind==1:c=mkpool(strings)
 if kind==0x102 and name=='manifest':
  for p,k in attributes(c,strings):
   if k=='versionCode':struct.pack_into('<I',c,p+16,377304133)
 if kind==0x102 and name=='activity' and owner=='in.chinatech.smartswitchbridge.LaunchActivity':
  for p,k in attributes(c,strings):
   if k=='exported':struct.pack_into('<I',c,p+16,0)
 if kind==0x103 and name=='activity':
  if owner in filters:out.extend(filters[owner]);restored.append(owner)
  owner=None
 out.append(c)
assert sorted(restored)==sorted(filters)
payload=b''.join(out);manifest=struct.pack('<HHI',3,8,8+len(payload))+payload
with zipfile.ZipFile(lab3) as src,zipfile.ZipFile(b/'original-shell-unsigned.apk','w') as dst:
 for info in src.infolist():
  n=info.filename;u=n.upper()
  if u=='META-INF/MANIFEST.MF' or u.startswith('META-INF/') and u.endswith(('.SF','.RSA','.DSA','.EC')):continue
  data=manifest if n=='AndroidManifest.xml' else original_dex if n=='classes5.dex' else src.read(info)
  dst.writestr(copy.copy(info),data)
j=r/'.local/android-assistant/toolchain/jdk/jdk-21.0.12.1+1/Contents/Home';bt=r/'.local/android-assistant/toolchain/sdk/android-16';env=dict(os.environ,JAVA_HOME=str(j),PATH=str(j/'bin')+os.pathsep+os.environ['PATH'])
def run(name,args):
 with (b/(name+'.log')).open('w') as f:subprocess.run([str(x) for x in args],env=env,check=True,stdout=f,stderr=subprocess.STDOUT)
apk=b/'SmartSwitch-original-ui-shell.apk';run('shell-align',[bt/'zipalign','-P','16','-f','4',b/'original-shell-unsigned.apk',b/'original-shell-aligned.apk']);run('shell-sign',[bt/'apksigner','sign','--v4-signing-enabled','false','--ks',r/'.local/smart-switch-experiment/private/lab1.p12','--ks-key-alias','lab1','--ks-pass','file:'+str(r/'.local/smart-switch-experiment/private/password.txt'),'--out',apk,b/'original-shell-aligned.apk']);run('shell-signature',[bt/'apksigner','verify','--verbose','--print-certs',apk]);run('shell-manifest',[bt/'aapt2','dump','xmltree',apk,'--file','AndroidManifest.xml']);run('shell-badging',[bt/'aapt2','dump','badging',apk])
obj={'apkSha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'apkBytes':apk.stat().st_size,'versionCode':377304133,'restoredOriginalLauncherOwners':restored,'mainButtonsRestoredToLab1':True,'customLauncherDisabled':True,'originalResourcesPreserved':True,'fullTransferImplemented':False,'published':False};(b/'shell-proof.json').write_text(json.dumps(obj,indent=2)+'\n');print(json.dumps(obj,indent=2))
