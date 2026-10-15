from pathlib import Path
import subprocess,os,json,re,xml.etree.ElementTree as ET,sqlite3
r=Path(__file__).resolve().parents[1];workspace=r.parents[2];tools=workspace/'.local/android-assistant/toolchain';java=next((tools/'jdk').glob('*/Contents/Home/bin'));proof=r/'.local/android-phone-gate';proof.mkdir(exist_ok=True);classes=proof/'jvm-tests';classes.mkdir(exist_ok=True)
cp=os.pathsep.join(map(str,[proof/'native-proof/build/classes.jar',tools/'sdk/android-37.0/android.jar',tools/'deps/zxing-core-3.5.3.jar']))
names=['ProtocolTest','ReliabilityTest','TransferV2Test','RecoveryStateTest','QrTest','ContactExportTest','ScanConsentTest'];sources=[r/'tests/android-assistant-native'/(n+'.java') for n in names]+[r/'tests/android-phone-gate/PhoneGateCoreTest.java',r/'tests/android-phone-gate/PhoneRecoveryCoreTest.java']
subprocess.run([str(java/'javac'),'-encoding','UTF-8','-cp',cp,'-d',str(classes),*map(str,sources)],check=True)
records=[]
for n in names+['PhoneGateCoreTest','PhoneRecoveryCoreTest']:
 args=[str(java/'java'),'-cp',str(classes)+os.pathsep+cp,'in.chinatech.phoneassistant.'+n]
 if n=='ProtocolTest':args.append(str(workspace/'.local/android-assistant/native-proof/candidate-key.p12'))
 result=subprocess.run(args,text=True,capture_output=True,timeout=90);(proof/(n+'.log')).write_text(result.stdout+result.stderr);print(result.stdout.strip());
 if result.returncode:print(result.stderr);result.check_returncode()
 records.extend(json.loads(x) for x in result.stdout.splitlines() if x.startswith('{'))
resources=[]
for folder in ['values','values-zh','values-it']:
 data={e.attrib['name']:e.text or '' for e in ET.parse(r/'android/phone-assistant/app/src/main/res'/folder/'strings.xml').getroot()};resources.append(data)
assert resources[0].keys()==resources[1].keys()==resources[2].keys()
for key in resources[0]:assert len(set(tuple(sorted(re.findall(r'%\d+\$[ds]',d[key]))) for d in resources))==1,key
# Additive SQLite DDL extracted from the real schema; old customer-related rows survive 1->3 and 2->3.
schema=(r/'android/phone-assistant/app/src/main/java/in/chinatech/phoneassistant/TransferSchema.java').read_text();manifest=re.search(r'MANIFEST="([^"]+)"',schema).group(1)
for version in [1,2]:
 db=sqlite3.connect(':memory:');db.executescript("CREATE TABLE items(n INTEGER);INSERT INTO items VALUES(1);CREATE TABLE receipts(transfer TEXT);INSERT INTO receipts VALUES('old');CREATE TABLE pending(transfer TEXT,object TEXT,dest TEXT"+("" if version==1 else ",directory TEXT NOT NULL DEFAULT ''")+");CREATE TABLE meta(k TEXT,v TEXT);INSERT INTO pending VALUES('t','o','content://old'"+("" if version==1 else ",'content://tree'")+");")
 if version==1:
  block=schema.split('FROM_ONE={',1)[1].split('};',1)[0]
  constants={k:v for k,v in re.findall(r'String (\w+)="([^"]+)"',schema)}
  for line in block.splitlines():
   line=line.strip().rstrip(',')
   if not line:continue
   sql=line[1:-1] if line.startswith('"') else constants[line];db.execute(sql)
 db.execute(manifest);assert db.execute('select count(*) from items').fetchone()[0]==1;assert db.execute('select transfer from receipts').fetchone()[0]=='old';
 if version==1:assert db.execute('select reason from residuals').fetchone()[0]=='legacy-scope-unknown'
 db.execute("insert into task_manifest values('t',0,'o','file','text/plain',1,X'00')")
 try:db.execute("insert into task_manifest values('t',1,'o','changed','text/plain',1,X'00')");raise AssertionError('duplicate object accepted')
 except sqlite3.IntegrityError:pass
(proof/'gate-verification.json').write_text(json.dumps({'tests':records,'languages':3,'resourceKeys':len(resources[0]),'sqliteAdditivePaths':[1,2],'physicalDeviceProof':False},indent=2)+'\n')
print('Three-language keys/variables and real SQLite additive 1->3 / 2->3 checks passed.')
