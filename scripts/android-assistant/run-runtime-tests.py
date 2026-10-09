from pathlib import Path
import subprocess,socket,struct,time,json,concurrent.futures,shlex
root=Path(__file__).resolve().parents[2];b=root/'.local/android-assistant-v3';adb=root/'.local/smartswitch-universal/runtime/sdk/platform-tools/adb';runner='in.chinatech.phoneassistanttest/in.chinatech.phoneassistant.RuntimeTests'
def cmd(serial,args):return [str(adb),'-s',serial]+args
def run(serial,mode,code=None):
 a=cmd(serial,['shell','am','instrument','-w','-r','-e','mode',mode])
 if code:a+=['-e','code',code]
 if 'shell' in a:
  index=a.index('shell');a=a[:index+1]+[shlex.join(a[index+1:]+[runner])]
 else:a+=[runner]
 p=subprocess.run(a,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=240)
 # Never persist pairing code; it is not present in the instrumentation result.
 text=p.stdout
 if code:
  for field in code.split('|'):
   if field:text=text.replace(field,'[redacted test field]')
 stamp=str(int(time.time()));(b/'runtime'/('result-'+mode+'-'+stamp+'.txt')).write_text(text)
 return text
subprocess.run(cmd('emulator-5580',['forward','tcp:11081','tcp:10081']),check=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
 r=executor.submit(run,'emulator-5580','receiver');connection=None
 for attempt in range(700):
  if r.done():break
  try:
   connection=socket.create_connection(('127.0.0.1',11081),timeout=.5)
   connection.settimeout(10)
   connection.sendall(struct.pack('>i',4)+b'PAIR')
   header=b''
   while len(header)<4:
    part=connection.recv(4-len(header))
    if not part:break
    header+=part
   if len(header)==4:break
   connection.close();connection=None
  except OSError:
   if connection:connection.close();connection=None
  time.sleep(.1)
 if connection is None:
  print(r.result());raise SystemExit('Receiver never supplied pairing; retained native failure')
 with connection:
  size=struct.unpack('>i',header)[0];assert 0<size<=512;data=b''
  while len(data)<size:data+=connection.recv(size-len(data))
 code=data.decode();s=executor.submit(run,'emulator-5582','sender',code);del code,data
 print('SENDER\n'+s.result());print('RECEIVER\n'+r.result())
subprocess.run(cmd('emulator-5580',['forward','--remove','tcp:11081']),check=True)
