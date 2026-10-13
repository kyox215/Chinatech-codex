from pathlib import Path
import subprocess,json,shlex,re
r=Path(__file__).resolve().parents[2];p=r/'.local/android-assistant-v3';adb=r/'.local/smartswitch-universal/runtime/sdk/platform-tools/adb';runner='in.chinatech.phoneassistanttest/in.chinatech.phoneassistant.RuntimeTests';records=[]
for mode in ['tls','fault','camera','entry','scope','selection','gallery','contacts']:
 args=[str(adb),'-s','emulator-5580','shell',shlex.join(['am','instrument','-w','-r','-e','mode',mode,runner])]
 result=subprocess.run(args,capture_output=True,text=True,timeout=180);out=result.stdout+result.stderr;(p/'runtime'/('native-'+mode+'.txt')).write_text(out);print(mode+'\n'+out,flush=True)
 result.check_returncode();assert 'INSTRUMENTATION_CODE: -1' in out and 'failure=' not in out,mode
 records.append({'mode':mode,'checks':int(re.search(r'checks=(\d+)',out).group(1)),'status':'passed','log':str((p/'runtime'/('native-'+mode+'.txt')).relative_to(r))})
(p/'native-modes.json').write_text(json.dumps(records,indent=2)+'\n')
