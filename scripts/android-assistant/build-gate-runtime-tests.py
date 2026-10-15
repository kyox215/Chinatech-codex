from pathlib import Path
import os,subprocess,zipfile,shutil
r=Path(__file__).resolve().parents[2];workspace=r.parents[2];tools=workspace/'.local/android-assistant/toolchain';source=r/'tests/android-phone-gate-native';proof=r/'.local/android-phone-gate';build=proof/'runtime-test-build';build.mkdir(exist_ok=True);(build/'classes').mkdir(exist_ok=True);(build/'dex').mkdir(exist_ok=True)
j=next((tools/'jdk').glob('*/Contents/Home'));bt=tools/'sdk/android-16';api=tools/'sdk/android-37.0/android.jar';jar=proof/'native-proof/build/classes.jar';key=workspace/'.local/android-assistant/native-proof/candidate-key.p12';assert key.is_file();env=dict(os.environ,JAVA_HOME=str(j),PATH=str(j/'bin')+os.pathsep+os.environ['PATH'])
def run(args):subprocess.run(list(map(str,args)),env=env,check=True)
(build/'sources.args').write_text('\n'.join('"'+str(p)+'"' for p in (source/'src').rglob('*.java')))
run([j/'bin/javac','--release','8','-encoding','UTF-8','-cp',str(api)+os.pathsep+str(jar),'-d',build/'classes','@'+str(build/'sources.args')]);run([j/'bin/jar','--create','--file',build/'tests.jar','-C',build/'classes','.']);run([bt/'d8','--lib',api,'--classpath',jar,'--min-api','26','--output',build/'dex',build/'tests.jar']);run([bt/'aapt2','link','-o',build/'unsigned.apk','--manifest',source/'AndroidManifest.xml','-I',api])
with zipfile.ZipFile(build/'unsigned.apk','a') as z:z.write(build/'dex/classes.dex','classes.dex')
run([bt/'zipalign','-P','16','-f','4',build/'unsigned.apk',build/'aligned.apk']);run([bt/'apksigner','sign','--v4-signing-enabled','false','--ks',key,'--ks-key-alias','candidate','--ks-pass','pass:android','--out',proof/'gate-runtime-tests.apk',build/'aligned.apk']);print(proof/'gate-runtime-tests.apk')
