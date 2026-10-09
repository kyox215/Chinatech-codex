from pathlib import Path
import copy,hashlib,json,os,struct,subprocess,zipfile
r=Path(__file__).resolve().parents[3];b=r/'.local/mimover-universal-next';build=b/'build';old=r/'交付/MiMover新机入口开放实验版-20261009/MiMover-4.5.7.5-coexist-lab1.apk';assert hashlib.sha256(old.read_bytes()).hexdigest()=='4a8b16b0f6a297c46e485cf1aea32fa90690131bd9c920f01ae785d01eae06d0'
# Reuse the owned binary XML adapter as data parsing only.
from binary_xml import chunks,pool,mkpool
NONE=0xffffffff
with zipfile.ZipFile(old) as z:original=chunks(z.read('AndroidManifest.xml'))
with zipfile.ZipFile(build/'template.apk') as z:extra=chunks(z.read('AndroidManifest.xml'))
strings=pool(original[0]);es=pool(extra[0]);mapping={}
for i,t in enumerate(es):
 if t not in strings:strings.append(t)
 mapping[i]=strings.index(t)
res=list(struct.unpack('<'+'I'*((len(original[1])-8)//4),original[1][8:]));res += [0]*(len(strings)-len(res));er=struct.unpack('<'+'I'*((len(extra[1])-8)//4),extra[1][8:])
for i,value in enumerate(er):
 if value:assert res[mapping[i]] in [0,value];res[mapping[i]]=value

def attrs(c,st):
 if struct.unpack_from('<H',c)[0]!=0x102:return []
 start,size,count=struct.unpack_from('<HHH',c,24);assert size==20
 return [(16+start+i*size,st[struct.unpack_from('<I',c,16+start+i*size+4)[0]]) for i in range(count)]
def val(c,p,st):return st[struct.unpack_from('<I',c,p+16)[0]] if c[p+15]==3 else None
def tag(c,st):return st[struct.unpack_from('<I',c,20)[0]] if struct.unpack_from('<H',c)[0] in [0x102,0x103] else ''
def mapped(c):
 c=bytearray(c)
 for pos in [12,16,20]:
  i=struct.unpack_from('<I',c,pos)[0];struct.pack_into('<I',c,pos,NONE if i==NONE else mapping[i])
 if struct.unpack_from('<H',c)[0]==0x102:
  for p,k in attrs(c,strings):
   for pos in [p,p+4,p+8]:
    i=struct.unpack_from('<I',c,pos)[0];struct.pack_into('<I',c,pos,NONE if i==NONE else mapping[i])
   if c[p+15]==3:struct.pack_into('<I',c,p+16,mapping[struct.unpack_from('<I',c,p+16)[0]])
 return c

def string(c,p,v):
 if v not in strings:strings.append(v);res.append(0)
 i=strings.index(v);c[p+15]=3;struct.pack_into('<I',c,p+8,i);struct.pack_into('<I',c,p+16,i)
components=[];permissions=[];current=None;level=0
for c in extra[2:]:
 kind=struct.unpack_from('<H',c)[0];name=tag(c,es)
 if kind==0x102 and name in ['uses-permission','activity','service','receiver']:current=[];level=0
 if current is not None:
  current.append(mapped(c));level+=1 if kind==0x102 else -1 if kind==0x103 else 0
  if level==0:
   (permissions if name=='uses-permission' else components).extend(current);current=None
allowed=set(val(c,p,strings) for c in permissions for p,k in attrs(c,strings) if k=='name')
for c in components:
 if tag(c,strings)=='activity':
  for p,k in attrs(c,strings):
   if k=='theme':struct.pack_into('<I',c,p+16,0x7f1100ff)
# The autonomous channel owns all services/receivers. Legacy OEM endpoints are not entered.
disabled=[];out=[];skip=0;owner=None;filterSkip=0
for c in original:
 kind=struct.unpack_from('<H',c)[0];name=tag(c,strings)
 if kind==0x102 and name=='activity':owner=next((val(c,p,strings) for p,k in attrs(c,strings) if k=='name'),None)
 if owner=='com.miui.huanji.MainActivity' and kind==0x102 and name=='intent-filter':filterSkip=1;continue
 if filterSkip:
  filterSkip+=1 if kind==0x102 else -1 if kind==0x103 else 0
  continue
 if kind==0x103 and name=='activity':owner=None
 if kind==0x102 and name=='uses-permission':skip=1;continue
 if skip:
  skip+=1 if kind==0x102 else -1 if kind==0x103 else 0
  continue
 if kind==0x102:
  if name in ['service','receiver','provider']:
   className=next((val(c,p,strings) for p,k in attrs(c,strings) if k=='name'),None)
   keep=name=='provider' and className=='androidx.startup.InitializationProvider'
   if not keep:
    # Existing enabled attribute or add one, preserving sorted resource attributes.
    entries=attrs(c,strings);enabled=next((p for p,k in entries if k=='enabled'),None)
    if enabled is not None:struct.pack_into('<I',c,enabled+16,0)
    else:
     if 'enabled' not in strings:strings.append('enabled');res.append(0x0101000e)
     else:
      index=strings.index('enabled')
      while len(res)<=index:res.append(0)
      assert res[index] in [0,0x0101000e];res[index]=0x0101000e
     nsIndex=strings.index('http://schemas.android.com/apk/res/android');nameIndex=strings.index('enabled')
     attr=struct.pack('<IIIHBBI',nsIndex,nameIndex,NONE,8,0,0x12,0)
     start,size,count=struct.unpack_from('<HHH',c,24);begin=16+start;oldAttrs=[bytes(c[begin+i*size:begin+(i+1)*size]) for i in range(count)];oldAttrs.append(attr);oldAttrs.sort(key=lambda a:res[struct.unpack_from('<I',a,4)[0]] if struct.unpack_from('<I',a,4)[0]<len(res) else 0)
     c[begin:begin+count*size]=b''.join(oldAttrs);struct.pack_into('<I',c,4,len(c));struct.pack_into('<H',c,28,count+1)
    disabled.append(className)
  for p,k in attrs(c,strings):
   if name=='activity' and owner=='com.miui.huanji.MainActivity' and k=='exported':struct.pack_into('<I',c,p+16,0)
   if name=='manifest' and k=='versionCode':assert struct.unpack_from('<I',c,p+16)[0]==45706;struct.pack_into('<I',c,p+16,45707)
   if name=='manifest' and k=='versionName':string(c,p,'4.5.7.5-ct-lab2')
   if name=='application' and k=='label':string(c,p,'Mi Mover · ChinaTech lab2')
   if name=='uses-sdk' and k=='minSdkVersion':struct.pack_into('<I',c,p+16,26)
   if name=='uses-feature' and k=='required':struct.pack_into('<I',c,p+16,0)
  if name=='application':out.extend(permissions)
 if kind==0x103 and name=='application':out.extend(components)
 out.append(c)
# Rebuild pools after all owned names were added.
res += [0]*max(0,len(strings)-len(res));out[0]=mkpool(strings);out[1]=bytearray(struct.pack('<HHI',0x180,8,8+4*len(res))+struct.pack('<'+'I'*len(res),*res));body=b''.join(out);manifest=struct.pack('<HHI',3,8,8+len(body))+body
(build/'manifest-lab2.bin').write_bytes(manifest)
with zipfile.ZipFile(old) as src,zipfile.ZipFile(build/'unsigned.apk','w') as dst:
 for info in src.infolist():
  n=info.filename;upper=n.upper()
  if upper=='META-INF/MANIFEST.MF' or upper.startswith('META-INF/') and upper.endswith(('.SF','.RSA','.DSA','.EC')):continue
  data=manifest if n=='AndroidManifest.xml' else (build/'dex/classes.dex').read_bytes() if n=='classes3.dex' else (build/'merged-resources.arsc').read_bytes() if n=='resources.arsc' else src.read(info);dst.writestr(copy.copy(info),data)
 for p in (r/'android/mimover-universal/licenses').glob('*.txt'):dst.writestr('assets/mimover-universal/'+p.name,p.read_bytes())
j=r/'.local/android-assistant/toolchain/jdk/jdk-21.0.12.1+1/Contents/Home';bt=r/'.local/android-assistant/toolchain/sdk/android-16';env=dict(os.environ,JAVA_HOME=str(j),PATH=str(j/'bin')+os.pathsep+os.environ['PATH'])
def run(name,args):
 with (b/(name+'.log')).open('w') as f:subprocess.run([str(x) for x in args],env=env,check=True,stdout=f,stderr=subprocess.STDOUT)
apk=b/'MiMover-4.5.7.5-universal-coexist-lab2.apk'
run('align',[bt/'zipalign','-P','16','-f','4',build/'unsigned.apk',build/'aligned.apk']);run('sign',[bt/'apksigner','sign','--v4-signing-enabled','false','--ks',r/'.local/mimover-universal/private/mimover-lab.p12','--ks-key-alias','ctmi','--ks-pass','file:'+str(r/'.local/mimover-universal/private/password.txt'),'--out',apk,build/'aligned.apk'])
for name,args in [('signature',[bt/'apksigner','verify','--verbose','--print-certs',apk]),('badging',[bt/'aapt2','dump','badging',apk]),('manifest',[bt/'aapt2','dump','xmltree',apk,'--file','AndroidManifest.xml']),('alignment',[bt/'zipalign','-c','-P','16','4',apk])]:run(name,args)
with zipfile.ZipFile(old) as src,zipfile.ZipFile(apk) as dst:
 same=[n for n in src.namelist() if not n.upper().startswith('META-INF/') and n not in ['classes3.dex','AndroidManifest.xml','resources.arsc']]
 for n in same:assert src.read(n)==dst.read(n),n
obj={'package':'com.miui.huanji.chinatech','versionCode':45707,'versionName':'4.5.7.5-ct-lab2','minSdk':26,'targetSdk':35,'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'bytes':apk.stat().st_size,'originalPayloadsPreserved':len(same),'changedFromEntry':['AndroidManifest.xml','classes3.dex','resources.arsc'],'disabledLegacyEndpoints':disabled,'ownPermissions':sorted(allowed),'published':False}
(b/'artifact.json').write_text(json.dumps(obj,indent=2)+'\n');print(json.dumps({k:obj[k] for k in ['package','versionCode','sha256','bytes','originalPayloadsPreserved']}))
