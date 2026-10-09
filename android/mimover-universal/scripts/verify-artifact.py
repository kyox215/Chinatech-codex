from pathlib import Path
import zipfile,struct,json,hashlib
r=Path(__file__).resolve().parents[3];b=r/'.local/mimover-universal-next';apk=b/'MiMover-4.5.7.5-universal-coexist-lab2.apk';old=r/'交付/MiMover新机入口开放实验版-20261009/MiMover-4.5.7.5-coexist-lab1.apk'
def uleb(data,pos):
 n=0;s=0
 while True:
  c=data[pos];pos+=1;n|=(c&127)<<s;s+=7
  if not c&128:return n,pos

def definitions(data):
 sc,so=struct.unpack_from('<II',data,56);tc,to=struct.unpack_from('<II',data,64);cc,co=struct.unpack_from('<II',data,96);strings=[]
 for i in range(sc):
  start=struct.unpack_from('<I',data,so+i*4)[0];n,start=uleb(data,start);end=data.index(0,start);strings.append(data[start:end].decode('utf-8','replace'))
 types=[strings[struct.unpack_from('<I',data,to+i*4)[0]] for i in range(tc)]
 return [types[struct.unpack_from('<I',data,co+i*32)[0]] for i in range(cc)]
with zipfile.ZipFile(apk) as z,zipfile.ZipFile(old) as baseline:
 own=definitions(z.read('classes3.dex'));assert all(n.startswith(('Lin/chinatech/mimover','Lin/chinatech/mimoverzxing')) for n in own),[n for n in own if n.startswith(('Lcom/','Landroidx/'))]
 preserved=[]
 for n in baseline.namelist():
  u=n.upper()
  if u=='META-INF/MANIFEST.MF' or u.startswith('META-INF/') and u.endswith(('.SF','.RSA','.DSA','.EC')):continue
  if n in ['AndroidManifest.xml','resources.arsc','classes3.dex']:continue
  assert baseline.read(n)==z.read(n),n;preserved.append(n)
 native=[]
 for n in z.namelist():
  if not n.endswith('.so'):continue
  data=z.read(n)
  if not data.startswith(b'\x7fELF') or data[4]!=2:continue
  assert data[5]==1
  off=struct.unpack_from('<Q',data,32)[0];size,count=struct.unpack_from('<HH',data,54);loads=[]
  for i in range(count):
   p=off+i*size
   if struct.unpack_from('<I',data,p)[0]!=1:continue
   offset,addr=struct.unpack_from('<QQ',data,p+8);align=struct.unpack_from('<Q',data,p+48)[0];loads.append(align>=16384 and offset%16384==addr%16384)
  native.append({'path':n,'loadSegments':len(loads),'elf16kb':all(loads)})
 result={'apkSha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'apkBytes':apk.stat().st_size,'ownClassDefinitions':len(own),'compileStubsExcluded':True,'shadedQrNamespaceVerified':True,'originalPayloadsPreserved':len(preserved),'layoutsAssetsOtherDexNativeBytesPreserved':True,'arm64Elf':native,'testComponentsExcluded':not any('RuntimeTests' in x or 'TestDocs' in x for x in own)}
 assert result['testComponentsExcluded'];(b/'static-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='arm64Elf'}));print('ARM64 ELF 16kb',sum(x['elf16kb'] for x in native),'/',len(native))
