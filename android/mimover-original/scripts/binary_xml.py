import struct
NONE=0xffffffff
def chunks(data):
 pos=8;out=[]
 while pos<len(data):
  kind,header,size=struct.unpack_from('<HHI',data,pos);assert size>=header and pos+size<=len(data);out.append(bytearray(data[pos:pos+size]));pos+=size
 return out
def pool(chunk):
 count,styles,flags,offset,style=struct.unpack_from('<IIIII',chunk,8);assert not flags&0x100 and styles==0
 out=[]
 for i in range(count):
  p=offset+struct.unpack_from('<I',chunk,28+4*i)[0];n=struct.unpack_from('<H',chunk,p)[0];p+=2
  if n&0x8000:n=((n&0x7fff)<<16)|struct.unpack_from('<H',chunk,p)[0];p+=2
  out.append(bytes(chunk[p:p+2*n]).decode('utf-16-le'))
 return out
def mkpool(strings):
 payload=bytearray();offsets=[]
 for s in strings:
  b=s.encode('utf-16-le');n=len(b)//2;offsets.append(len(payload));payload+=struct.pack('<H',n) if n<0x8000 else struct.pack('<HH',0x8000|(n>>16),n&0xffff);payload+=b+b'\x00\x00'
 while len(payload)%4:payload+=b'\x00'
 start=28+len(strings)*4;return bytearray(struct.pack('<HHIIIIII',1,28,start+len(payload),len(strings),0,0,start,0)+struct.pack('<'+'I'*len(strings),*offsets)+payload)
