from pathlib import Path
import copy,hashlib,json,os,struct,subprocess,sys,zipfile,zlib

r=next(p for p in Path(__file__).resolve().parents if (p/"PROJECT_MEMORY.md").is_file())
b=r/'.local/mimover-original-only';b.mkdir(exist_ok=True)
sys.path.insert(0,str(r/'android/mimover-original/scripts'))
from binary_xml import chunks,pool
src=r/'.local/smartswitch-universal/research-oem/downloads/xiaomi.apk'
assert hashlib.sha256(src.read_bytes()).hexdigest()=='2e2b845f44fc99249de19c7801d7ce6aa67e31f3372ba54dc4f6d20782e25752'
with zipfile.ZipFile(src) as z:
 original_dex=z.read('classes2.dex');cs=chunks(z.read('AndroidManifest.xml'))
assert hashlib.sha256(original_dex).hexdigest()=='08ad71fbd43815c227914fabb8f69c6dde403789be8ec61f78691a36d25fa8a0'
offset=1996484;assert original_dex[offset:offset+4]==bytes.fromhex('6302c63a')
dex=bytearray(original_dex);dex[offset:offset+4]=bytes.fromhex('13020100')
dex[12:32]=hashlib.sha1(dex[32:]).digest();struct.pack_into('<I',dex,8,zlib.adler32(dex[12:])&0xffffffff)
assert dex[32:offset]==original_dex[32:offset] and dex[offset+4:]==original_dex[offset+4:]
strings=pool(cs[0]);manifest_changes=[]
for c in cs:
 if struct.unpack_from('<H',c)[0]!=0x102 or strings[struct.unpack_from('<I',c,20)[0]]!='manifest':continue
 start,size,count=struct.unpack_from('<HHH',c,24);assert size==20
 drop=None
 for i in range(count):
  p=16+start+i*size;name=strings[struct.unpack_from('<I',c,p+4)[0]]
  if name=='versionCode':
   assert struct.unpack_from('<I',c,p+16)[0]==45705;struct.pack_into('<I',c,p+16,45708);manifest_changes.append('versionCode:45705->45708')
  if name=='sharedUserId':
   assert strings[struct.unpack_from('<I',c,p+16)[0]]=='android.uid.backup';drop=p;manifest_changes.append('remove system sharedUserId android.uid.backup')
 assert drop is not None
 index=(drop-16-start)//size;del c[drop:drop+size];struct.pack_into('<I',c,4,len(c));struct.pack_into('<H',c,28,count-1)
 for pos in [30,32,34]:
  n=struct.unpack_from('<H',c,pos)[0]
  struct.pack_into('<H',c,pos,0 if n==index+1 else n-1 if n>index+1 else n)
body=b''.join(cs);manifest=struct.pack('<HHI',3,8,8+len(body))+body
j=r/'.local/android-assistant/toolchain/jdk/jdk-21.0.12.1+1/Contents/Home';bt=r/'.local/android-assistant/toolchain/sdk/android-16'
env=dict(os.environ,JAVA_HOME=str(j),PATH=str(j/'bin')+os.pathsep+os.environ['PATH'])
def run(name,args):
 with (b/(name+'.log')).open('w') as out:subprocess.run([str(x) for x in args],env=env,stdout=out,stderr=subprocess.STDOUT,check=True)
unsigned=b/'unsigned.apk';aligned=b/'aligned.apk';apk=b/'MiMover-4.5.7.5-original-brand-entry.apk'
def signature(name):
 u=name.upper();return u=='META-INF/MANIFEST.MF' or u.startswith('META-INF/') and u.endswith(('.SF','.RSA','.DSA','.EC'))
with zipfile.ZipFile(src) as z,zipfile.ZipFile(unsigned,'w') as dst:
 for info in z.infolist():
  if signature(info.filename):continue
  data=manifest if info.filename=='AndroidManifest.xml' else bytes(dex) if info.filename=='classes2.dex' else z.read(info)
  dst.writestr(copy.copy(info),data)
run('align',[bt/'zipalign','-P','16','-f','4',unsigned,aligned])
private=r/'.local/mimover-universal/private'
run('sign',[bt/'apksigner','sign','--v4-signing-enabled','false','--ks',private/'mimover-lab.p12','--ks-key-alias','ctmi','--ks-pass','file:'+str(private/'password.txt'),'--out',apk,aligned])
for name,args in [('signature',[bt/'apksigner','verify','--verbose','--print-certs',apk]),('badging',[bt/'aapt2','dump','badging',apk]),('manifest',[bt/'aapt2','dump','xmltree',apk,'--file','AndroidManifest.xml']),('check-align',[bt/'zipalign','-c','-P','16','4',apk])]:run(name,args)
with zipfile.ZipFile(src) as a,zipfile.ZipFile(apk) as z:
 names=[n for n in a.namelist() if not signature(n)]
 assert {n for n in z.namelist() if not signature(n)}==set(names)
 changed=[n for n in names if a.read(n)!=z.read(n)]
 assert set(changed)=={'AndroidManifest.xml','classes2.dex'}
 assert sorted(n for n in z.namelist() if n.startswith('classes') and n.endswith('.dex'))==['classes.dex','classes2.dex']
 changed_body=[i for i in range(32,len(dex)) if dex[i]!=original_dex[i]];assert changed_body==[1996484,1996486,1996487]
record={'package':'com.miui.huanji','versionName':'4.5.7.5','versionCode':45708,'minSdk':21,'targetSdk':35,'apkSha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'apkBytes':apk.stat().st_size,'originalApkSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'changedEntries':changed,'manifestChanges':manifest_changes,'dexBodyChangedOffsets':changed_body,'dexChecksumUpdated':True,'addedFiles':[],'addedDex':False,'originalMainApplication':True,'originalLabelVersionNameResourcesPermissionsComponentsProtocolAndRestorationPreserved':True,'originalGlobalMiuiStatusUnchanged':True,'signerSha256':'1b71b70be3bb58e2db847aa71029ca2c071e467c60f5babef62a841eb00efc75','independentlySigned':True,'physicalBrandTransferVerified':False,'runtimeVerified':False,'payloadEntries':len(names),'preservedEntries':len(names)-2}
(b/'artifact-verification.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
