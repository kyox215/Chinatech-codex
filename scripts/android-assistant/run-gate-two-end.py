"""Run only the two explicitly selected project emulators. QR strings stay in host/device RAM."""
from pathlib import Path
import argparse,json,re,socket,struct,subprocess,shlex,time
r=Path(__file__).resolve().parents[2];workspace=r.parents[2];parser=argparse.ArgumentParser();parser.add_argument('--receiver',required=True);parser.add_argument('--sender',required=True);parser.add_argument('--adb',type=Path,default=workspace/'.local/smartswitch-universal/runtime/sdk/platform-tools/adb');args=parser.parse_args()
allowed={'emulator-'+str(x['port']) for x in json.loads((r/'.local/android-phone-gate/runtime/emulators.json').read_text())};assert args.receiver in allowed and args.sender in allowed and args.receiver!=args.sender,'Only the two recorded project emulators may be used';assert args.adb.is_file()
output=r/'.local/android-phone-gate/runtime';component='in.chinatech.phoneassistantgatetest/in.chinatech.phoneassistant.GateTwoEndTests';processes={};ports={};states={}
class TaskPhaseTracker:
 """Only a baseline terminal may remain visible while an async new task is being prepared."""
 failure_status={'file_failed','transfer_failed','gate_failed','tls_failed','service_start_failed','cancelled','session_expired','integrity_failed','partial_remains','service_timeout','permission_denied','pair_declined','wifi_required','hotspot_failed','folder_not_selected','gate_pair_first','gate_storage','gate_peer_required','receiver_complete_unconfirmed','action_failed'}
 @staticmethod
 def identity(state):
  if 'taskId' not in state or 'jobId' not in state:raise RuntimeError('INVALID_TASK_IDENTITY')
  task,job=state['taskId'],state['jobId']
  if not task and not job:return ('','')
  pattern=r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'
  if not isinstance(task,str) or not isinstance(job,str) or not re.fullmatch(pattern,task) or not re.fullmatch(pattern,job) or task=='00000000-0000-0000-0000-000000000000' or job=='00000000-0000-0000-0000-000000000000':raise RuntimeError('INVALID_TASK_IDENTITY')
  return task,job
 def __init__(self,role,baseline,expect_new):
  self.role=role.upper();self.baseline=self.identity(baseline);self.expect_new=expect_new;self.current=None if expect_new else self.baseline
  if expect_new and baseline.get('terminal','') not in ('completed','cancelled',''):raise RuntimeError('PENDING_BASELINE_'+self.role)
  if not expect_new and self.baseline==('',''):raise RuntimeError('MISSING_ORIGINAL_TASK_'+self.role)
 def observe(self,state):
  identity=self.identity(state)
  if state.get('status') in self.failure_status:raise RuntimeError('ENGINE_FAILED_'+self.role)
  if self.current is None:
   if identity==self.baseline:
    if not state.get('active'):raise RuntimeError('NEW_TASK_NOT_STARTED_'+self.role)
    return False
   if not all(identity) or (all(self.baseline) and (identity[0]==self.baseline[0] or identity[1]==self.baseline[1])):raise RuntimeError('INCONSISTENT_NEW_TASK_'+self.role)
   self.current=identity
  elif identity!=self.current:raise RuntimeError('TASK_IDENTITY_CHANGED_'+self.role)
  if state.get('terminal')=='cancelled':raise RuntimeError('TASK_CANCELLED_'+self.role)
  return True
 def summary(self):return {'baselineTaskId':self.baseline[0],'baselineJobId':self.baseline[1],'expectNewTask':self.expect_new,'observedTaskId':'' if self.current is None else self.current[0],'observedJobId':'' if self.current is None else self.current[1]}
def adb(serial,*command):return subprocess.run([str(args.adb),'-s',serial,*command],capture_output=True,text=True,check=True).stdout.strip()
def exact(sock,n):
 result=bytearray()
 while len(result)<n:
  chunk=sock.recv(n-len(result))
  if not chunk:raise ConnectionError('IPC_CLOSED')
  result.extend(chunk)
 return bytes(result)
def rpc(role,command,code=None):
 with socket.create_connection(('127.0.0.1',ports[role]),3) as sock:
  sock.settimeout(60)
  for text in ([command] if code is None else [command,code]):
   raw=text.encode();sock.sendall(struct.pack('>I',len(raw))+raw)
  size=struct.unpack('>I',exact(sock,4))[0]
  if size>4096:raise ValueError('IPC_LIMIT')
  return exact(sock,size).decode('utf-8')
def wait_ready(role,timeout=65):
 end=time.monotonic()+timeout
 while time.monotonic()<end:
  if processes[role].poll() is not None:raise RuntimeError('INSTRUMENTATION_EXITED_'+role)
  try:states[role]=json.loads(rpc(role,'STATE'));return
  except (OSError,ConnectionError,ValueError):time.sleep(.2)
 raise TimeoutError('IPC_NOT_READY_'+role)
def wait_code(role,prefix,timeout=65,previous=None,tracker=None):
 end=time.monotonic()+timeout
 while time.monotonic()<end:
  process=processes[role]
  if process.poll() is not None:raise RuntimeError('INSTRUMENTATION_EXITED_'+role)
  try:
   states[role]=json.loads(rpc(role,'STATE'))
   ready=tracker.observe(states[role]) if tracker is not None else True
   if tracker is None and states[role]['terminal']=='cancelled':raise RuntimeError('TASK_CANCELLED_'+role.upper())
   code=rpc(role,'CODE')
   if ready and code.startswith(prefix) and code!=previous:return code
  except (OSError,ConnectionError,ValueError):pass
  time.sleep(.2)
 raise TimeoutError('CODE_NOT_READY_'+role)
def wait_complete(role,timeout=90,tracker=None):
 end=time.monotonic()+timeout
 while time.monotonic()<end:
  states[role]=json.loads(rpc(role,'STATE'))
  if tracker is not None:tracker.observe(states[role])
  if states[role]['status']==('receiver_complete' if role=='receiver' else 'sender_complete') and states[role]['terminal']=='completed':return
  if not states[role]['active'] and states[role]['status'] in ['file_failed','transfer_failed','gate_failed','tls_failed','service_start_failed','cancelled']:raise RuntimeError('ENGINE_STOPPED_'+role)
  time.sleep(.2)
 raise TimeoutError('COMPLETION_TIMEOUT_'+role)
trackers={};phase_baselines={}
record={'phaseBaselines':phase_baselines,'status':'failed','scope':'Actual normal website admission and both production engines on existing emulator Wi-Fi; no automatic hotspot/physical/camera assertion','qrLogged':False,'productionApkModified':False}
try:
 for role,serial,remote in [('receiver',args.receiver,10082),('sender',args.sender,10083)]:
  ports[role]=int(adb(serial,'forward','tcp:0','tcp:'+str(remote)))
  command=['am','instrument','-w','-r','-e','role','receive' if role=='receiver' else 'send','-e','cleanupFixture','true',component]
  processes[role]=subprocess.Popen([str(args.adb),'-s',serial,'shell',shlex.join(command)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 offer=wait_code('receiver','CTPA5O|');wait_ready('sender');previous=rpc('sender','CODE');sender_baseline=dict(states['sender']);trackers['sender']=TaskPhaseTracker('sender',sender_baseline,True);phase_baselines['sender-offer']=trackers['sender'].summary();rpc('sender','APPLY',offer);offer=None
 response=wait_code('sender','CTPA5S|',previous=previous,tracker=trackers['sender']);previous=None;states['sender']=json.loads(rpc('sender','STATE'));trackers['sender'].observe(states['sender']);phase_baselines['sender-offer']=trackers['sender'].summary();states['receiver']=json.loads(rpc('receiver','STATE'));trackers['receiver']=TaskPhaseTracker('receiver',states['receiver'],False);phase_baselines['receiver-response']=trackers['receiver'].summary();rpc('receiver','APPLY',response);response=None
 final=wait_code('receiver','CTPA5F|',tracker=trackers['receiver']);states['sender']=json.loads(rpc('sender','STATE'));trackers['sender'].observe(states['sender']);trackers['sender']=TaskPhaseTracker('sender',states['sender'],False);phase_baselines['sender-final']=trackers['sender'].summary();rpc('sender','APPLY',final);final=None
 for role in ['sender','receiver']:wait_complete(role,tracker=trackers[role]);states[role]=json.loads(rpc(role,'VERIFY'));trackers[role].observe(states[role])
 for role in ['sender','receiver']:states[role]=json.loads(rpc(role,'FINISH'));trackers[role].observe(states[role])
 record['status']='passed';record['roles']={}
 for role,process in processes.items():
  text,_=process.communicate(timeout=20);(output/('two-end-'+role+'.txt')).write_text(text)
  assert process.returncode==0 and 'INSTRUMENTATION_CODE: -1' in text and 'failureType=' not in text and 'realTwoEngineThreeCodeFlow=true' in text,'NATIVE_FAILED_'+role
  record['roles'][role]={'checks':int(re.search(r'checks=(\d+)',text).group(1)),'log':'two-end-'+role+'.txt'}
 print('Two-engine three-code flow passed; public task outcomes and saved byte hashes verified. No QR strings logged.')
except Exception as error:
 record['status']='failed';record['failureType']=type(error).__name__;message=str(error);record['failureCode']=message if re.fullmatch('[A-Z0-9_]{1,100}',message) else 'HOST_COORDINATION_FAILED';raise
finally:
 record['lastSafeStates']=states
 record['lastTaskIdentities']={role:tracker.summary() for role,tracker in trackers.items()}
 for role,process in processes.items():
  if process.poll() is not None:
   text=process.stdout.read() if process.stdout and not process.stdout.closed else ''
   if text:(output/('two-end-'+role+'.txt')).write_text(text)
  # Do not kill an unknown original transfer or clear its journal on a coordination failure.
 for role,serial in [('receiver',args.receiver),('sender',args.sender)]:
  if role in ports:
   try:adb(serial,'forward','--remove','tcp:'+str(ports[role]))
   except subprocess.CalledProcessError:pass
 (output/'two-end-result.json').write_text(json.dumps(record,indent=2)+'\n')
