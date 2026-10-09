from pathlib import Path
import subprocess,os,json,re,xml.etree.ElementTree as ET
r=Path(__file__).resolve().parents[2];p=r/'.local/android-assistant-v3';classes=p/'jvm-tests';classes.mkdir(exist_ok=True);tool=r/'.local/android-assistant/toolchain';j=tool/'jdk/jdk-21.0.12.1+1/Contents/Home/bin';api=tool/'sdk/android-37.0/android.jar';jar=p/'native-proof/build/classes.jar';zx=tool/'deps/zxing-core-3.5.3.jar';cp=os.pathsep.join(map(str,[jar,api,zx]));names=['ProtocolTest','ReliabilityTest','TransferV2Test','RecoveryStateTest','QrTest','ContactExportTest','ScanConsentTest']
subprocess.run([str(j/'javac'),'--release','8','-cp',cp,'-d',str(classes),*[str(r/'tests/android-assistant-native'/(n+'.java')) for n in names]],check=True)
records=[]
for n in names:
 args=[str(j/'java'),'-cp',str(classes)+os.pathsep+cp,'in.chinatech.phoneassistant.'+n]
 if n=='ProtocolTest':args.append(str(r/'.local/android-assistant/native-proof/candidate-key.p12'))
 result=subprocess.run(args,text=True,capture_output=True,timeout=90);(p/(n+'.log')).write_text(result.stdout+result.stderr);result.check_returncode();print(result.stdout.strip());records.extend(json.loads(x) for x in result.stdout.splitlines() if x.startswith('{'))
# Resource identity and format variables must match in all three languages.
resources=[]
for folder in ['values','values-zh','values-it']:
 data={e.attrib['name']:e.text or '' for e in ET.parse(r/'android/phone-assistant/app/src/main/res'/folder/'strings.xml').getroot()};resources.append(data)
assert resources[0].keys()==resources[1].keys()==resources[2].keys()
for key in resources[0]:assert len(set(tuple(sorted(re.findall(r'%\d+\$[ds]',d[key]))) for d in resources))==1,key
(p/'jvm-verification.json').write_text(json.dumps({'tests':records,'resourceKeys':len(resources[0]),'languages':3,'physicalDeviceProof':False},indent=2)+'\n')
