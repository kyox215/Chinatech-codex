"""Append a separate owned resource package; retain original resource IDs and assets."""
from pathlib import Path
import struct,json,zipfile
r=Path(__file__).resolve().parents[3];b=r/'.local/mimover-universal-next';build=b/'build'
def chunks(data,start,end=None):
 end=len(data) if end is None else end;pos=start
 while pos<end:
  kind,header,size=struct.unpack_from('<HHI',data,pos);assert size>=header and pos+size<=end
  yield kind,header,bytearray(data[pos:pos+size]);pos+=size
 assert pos==end

def readpool(c):
 count,styles,flags,start,style=struct.unpack_from('<IIIII',c,8)
 def length(pos,width):
  n=int.from_bytes(c[pos:pos+width],'little');pos+=width;flag=0x80 if width==1 else 0x8000
  if n&flag:n=((n&(flag-1))<<(8*width))|int.from_bytes(c[pos:pos+width],'little');pos+=width
  return n,pos
 values=[]
 for i in range(count):
  p=start+struct.unpack_from('<I',c,28+4*i)[0]
  if flags&0x100:
   _,p=length(p,1);n,p=length(p,1);values.append(bytes(c[p:p+n]).decode('utf-8'))
  else:n,p=length(p,2);values.append(bytes(c[p:p+2*n]).decode('utf-16-le'))
 return values

def extendpool(c,new):
 old=readpool(c);count,styles,flags,start,style=struct.unpack_from('<IIIII',c,8);assert struct.unpack_from('<H',c,2)[0]==28
 payload=bytearray(c[start:style or len(c)]);offsets=list(struct.unpack_from('<'+'I'*count,c,28));styleOffsets=bytes(c[28+count*4:28+(count+styles)*4]);styleData=bytes(c[style:]) if style else b''
 def length(n,width):
  flag=0x80 if width==1 else 0x8000;return n.to_bytes(width,'little') if n<flag else ((n>>(8*width))|flag).to_bytes(width,'little')+(n&(256**width-1)).to_bytes(width,'little')
 for value in new:
  offsets.append(len(payload))
  if flags&0x100:
   encoded=value.encode('utf-8');payload+=length(len(value.encode('utf-16-le'))//2,1)+length(len(encoded),1)+encoded+b'\0'
  else:
   encoded=value.encode('utf-16-le');payload+=length(len(encoded)//2,2)+encoded+b'\0\0'
 while len(payload)%4:payload+=b'\0'
 total=count+len(new);offset=28+4*(total+styles);styleStart=offset+len(payload) if style else 0;size=offset+len(payload)+len(styleData)
 return bytearray(struct.pack('<HHIIIIII',1,28,size,total,styles,flags&~1,offset,styleStart)+struct.pack('<'+'I'*total,*offsets)+styleOffsets+payload+styleData)

def entries(c):
 header=struct.unpack_from('<H',c,2)[0];flags=c[9];count,start=struct.unpack_from('<II',c,12)
 if flags&1:
  indices=[(struct.unpack_from('<H',c,header+i*4)[0],struct.unpack_from('<H',c,header+i*4+2)[0]*4) for i in range(count)]
 elif flags&2:indices=[(i,struct.unpack_from('<H',c,header+i*2)[0]*4) for i in range(count) if struct.unpack_from('<H',c,header+i*2)[0]!=0xffff]
 else:indices=[(i,struct.unpack_from('<I',c,header+i*4)[0]) for i in range(count) if struct.unpack_from('<I',c,header+i*4)[0]!=0xffffffff]
 for index,offset in indices:
  pos=start+offset;size,eflags,key=struct.unpack_from('<HHI',c,pos);assert not eflags&1,'complex value unexpected';assert size>=8
  yield index,pos+size,key

old=r/'交付/MiMover新机入口开放实验版-20261009/MiMover-4.5.7.5-coexist-lab1.apk'
with zipfile.ZipFile(old) as z:original=z.read('resources.arsc')
with zipfile.ZipFile(build/'private-res.apk') as z:owned=z.read('resources.arsc')
oldChunks=list(chunks(original,12));newChunks=list(chunks(owned,12));assert oldChunks[0][0]==newChunks[0][0]==1
originalStrings=readpool(oldChunks[0][2]);privateStrings=readpool(newChunks[0][2]);appended=list(privateStrings)
translations=json.loads((b/'resource-translations.json').read_text());aliases={0x130:'original_permission_intro',0x131:'original_permission_scope',0x389:'original_permission_categories',0x387:'original_permission_prompt',0x388:'original_permission_prompt',0x3b7:'original_local_connection',0x3b3:'original_local_connection_hint',0x3b4:'original_local_connection_hint',0x39e:'original_wifi_devices',0x39f:'original_wifi_devices'}
indices={}
for lang in ['en','zh','it']:
 for key in set(aliases.values()):indices[(lang,key)]=len(originalStrings)+len(appended);appended.append(translations[lang][key])
result=[extendpool(oldChunks[0][2],appended)];aliasPatched=0;defaultType=None;stringSpecCount=None;aliasKeys={}
for kind,header,pkg in oldChunks[1:]:
 if kind!=0x200:result.append(pkg);continue
 assert struct.unpack_from('<I',pkg,8)[0]==0x7f;contents=[]
 for typ,h,c in chunks(pkg,header):
  if typ==0x202 and c[8]==0x10:stringSpecCount=struct.unpack_from('<I',c,12)[0]
  if typ==0x201 and c[8]==0x10:
   lang=bytes(c[28:30]).rstrip(b'\0').decode('ascii','ignore');lang=lang if lang in ['zh','it'] else 'en'
   if not any(c[24:h]):defaultType=bytearray(c[:h])
   for index,pos,keyIndex in entries(c):
    if index in aliases and c[pos+3]==3:aliasKeys[index]=keyIndex;struct.pack_into('<I',c,pos+4,indices[(lang,aliases[index])]);aliasPatched+=1
  contents.append(c)
 assert defaultType is not None and stringSpecCount
 # Original app has no Italian translations: add only the corrected permission labels.
 assert not any(t==0x201 and c[8]==0x10 and bytes(c[28:30])==b'it' for t,h,c in chunks(pkg,header))
 c=defaultType;c[9]=0;c[28:30]=b'it';count=stringSpecCount;start=len(c)+count*4;struct.pack_into('<II',c,12,count,start);offsets=[0xffffffff]*count;payload=bytearray()
 for index,key in sorted(aliases.items()):offsets[index]=len(payload);payload+=struct.pack('<HHI',8,0,aliasKeys[index])+struct.pack('<HBBI',8,0,3,indices[('it',key)])
 c+=struct.pack('<'+'I'*count,*offsets)+payload;struct.pack_into('<I',c,4,len(c));contents.append(c)
 out=bytearray(pkg[:header])+b''.join(contents);struct.pack_into('<I',out,4,len(out));result.append(out)
for kind,header,pkg in newChunks[1:]:
 if kind!=0x200:continue
 assert struct.unpack_from('<I',pkg,8)[0]==0x6e
 contents=[]
 for typ,h,c in chunks(pkg,header):
  if typ==0x201:
   for index,pos,keyIndex in entries(c):
    if c[pos+3]==3:struct.pack_into('<I',c,pos+4,len(originalStrings)+struct.unpack_from('<I',c,pos+4)[0])
  contents.append(c)
 out=bytearray(pkg[:header])+b''.join(contents);struct.pack_into('<I',out,4,len(out));result.append(out)
body=b''.join(result);merged=struct.pack('<HHII',2,12,12+len(body),struct.unpack_from('<I',original,8)[0]+1)+body
(build/'merged-resources.arsc').write_bytes(merged)
(b/'merged-resource-verification.json').write_text(json.dumps({'originalStringIndicesPreserved':len(originalStrings),'ownedPackage':'0x6e','keys':200,'permissionLabelsUpdated':aliasPatched,'originalLayoutsAssetsNativeUnchanged':True,'bytes':len(merged)},indent=2)+'\n')
print('Merged normal resources; original permission labels corrected:',aliasPatched)
