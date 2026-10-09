from pathlib import Path
import os,subprocess,json,zipfile,shutil
r=Path(__file__).resolve().parents[3];b=r/'.local/mimover-universal-next';build=b/'build';build.mkdir(exist_ok=True);j=r/'.local/android-assistant/toolchain/jdk/jdk-21.0.12.1+1/Contents/Home';bt=r/'.local/android-assistant/toolchain/sdk/android-16';api=r/'.local/android-assistant/toolchain/sdk/android-37.0/android.jar';module=r/'android/mimover-universal';env=dict(os.environ,JAVA_HOME=str(j),PATH=str(j/'bin')+os.pathsep+os.environ['PATH'])
def run(name,args):
 with (b/(name+'.log')).open('w') as f:subprocess.run([str(x) for x in args],env=env,stdout=f,stderr=subprocess.STDOUT,check=True)
for name in ['stubs','classes','dex']:
 path=build/name
 if path.exists():shutil.rmtree(path)
 path.mkdir()
def arguments(path,files):path.write_text('\n'.join('"'+str(p)+'"' for p in files))
arguments(build/'stubs.args',(module/'stubs').rglob('*.java'));run('javac-stubs',[j/'bin/javac','--release','8','-cp',api,'-d',build/'stubs','@'+str(build/'stubs.args')])
arguments(build/'sources.args',(module/'src/main/java').rglob('*.java'));run('javac-native',[j/'bin/javac','--release','8','-encoding','UTF-8','-cp',str(api)+os.pathsep+str(build/'stubs')+os.pathsep+str(module/'lib/mimover-zxing-3.5.3.jar'),'-d',build/'classes','@'+str(build/'sources.args')])
run('jar-native',[j/'bin/jar','cf',build/'owned-classes.jar','-C',build/'classes','.']);run('d8-native',[bt/'d8','--lib',api,'--classpath',build/'stubs','--min-api','26','--output',build/'dex',build/'owned-classes.jar',module/'lib/mimover-zxing-3.5.3.jar'])
privateSource=build/'private-resource-source'
if privateSource.exists():shutil.rmtree(privateSource)
for folder in ['values','values-zh','values-it']:
 (privateSource/folder).mkdir(parents=True);shutil.copy2(module/'src/main/res'/folder/'strings.xml',privateSource/folder/'strings.xml')
run('compile-private-res',[bt/'aapt2','compile','--dir',privateSource,'-o',build/'private-res.zip'])
run('link-private-res',[bt/'aapt2','link','-o',build/'private-res.apk','--manifest',module/'src/main/AndroidManifest.xml','-I',api,'--package-id','0x6e','--allow-reserved-package-id','--stable-ids',b/'resource-ids.txt',build/'private-res.zip'])
run('link-template',[bt/'aapt2','link','-o',build/'template.apk','--manifest',module/'src/main/AndroidManifest.xml','-I',api])
print(json.dumps({'compiled':'owned-classes.jar','dexBytes':(build/'dex/classes.dex').stat().st_size,'compileStubsNotPackaged':True}))
