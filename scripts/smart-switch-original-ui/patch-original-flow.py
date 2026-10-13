from pathlib import Path
import shutil,json,difflib
r=Path(__file__).resolve().parents[2];b=r/'.local/smart-switch-original-ui';source=r/'.local/smart-switch-experiment/final-smali';target=b/'flow-smali'
if target.exists():shutil.rmtree(target)
shutil.copytree(source,target)
ns='Lin/chinatech/smartswitchbridge/'
changed={}
def mutate(file,fn):
 p=target/file;old=p.read_text();new=fn(old);assert new!=old; p.write_text(new);changed[file]=[old,new]
def method(s,name,fn):
 a=s.index(name);z=s.index('.end method',a)+len('.end method');return s[:a]+fn(s[a:z])+s[z:]
def inject(s,name,body):
 return method(s,name,lambda m:m[:m.index('\n\n',m.index('.registers'))]+'\n\n'+body+m[m.index('\n\n',m.index('.registers')):])
def main(s):
 for name,value in [('X',0),('Y',1)]:s=inject(s,f'.method public static synthetic {name}(',f'    const/4 v0, 0x{value}\n    invoke-static {{p0, v0}}, {ns}Entry;->noteRole(Landroid/app/Activity;Z)V\n')
 return method(s,'.method public final g0()V',lambda m:'.method public final g0()V\n    .registers 1\n    invoke-static {p0}, '+ns+'Entry;->mainPermission(Landroid/app/Activity;)V\n    return-void\n.end method')
mutate('com/sec/android/easyMover/ui/MainActivity.smali',main)
def distribution(s):
 assert s.count('invoke-static {}, Ljg/z;->o()Z')==2
 return s.replace('invoke-static {}, Ljg/z;->o()Z','invoke-static {}, '+ns+'Entry;->permissionsReviewed()Z')
mutate('com/sec/android/easyMover/ui/launch/DistributionActivity.smali',distribution)
def welcome(s):
 def f(m):
  marker='    invoke-static {}, Ljg/z;->q()V';assert m.count(marker)==1
  return m.replace(marker,marker+'\n    invoke-virtual {p0}, Lcom/sec/android/easyMover/ui/WelcomeActivity;->h0()V\n    return-void\n')
 return method(s,'.method public final Y()V',f)
mutate('com/sec/android/easyMover/ui/WelcomeActivity.smali',welcome)
def permission(s):
 def create(m):
  marker='    :cond_a\n';assert m.count(marker)==1
  return m.replace(marker,marker+'    const/4 v0, 0x0\n    invoke-static {p0, v0}, '+ns+'OriginalPermissionController;->attach(Landroid/app/Activity;Landroid/os/Bundle;)Z\n    return-void\n')
 s=method(s,'.method public final onCreate(Landroid/os/Bundle;)V',create)
 s=method(s,'.method public final onConfigurationChanged(Landroid/content/res/Configuration;)V',lambda m:''' .method public final onConfigurationChanged(Landroid/content/res/Configuration;)V
    .registers 2
    invoke-super {p0, p1}, Lcom/sec/android/easyMover/host/ActivityBase;->onConfigurationChanged(Landroid/content/res/Configuration;)V
    invoke-static {p0}, '''+ns+'''OriginalPermissionController;->configured(Landroid/app/Activity;)Z
    return-void
.end method'''.lstrip())
 s=method(s,'.method public final onRequestPermissionsResult(I[Ljava/lang/String;[I)V',lambda m:''' .method public final onRequestPermissionsResult(I[Ljava/lang/String;[I)V
    .registers 4
    invoke-super {p0, p1, p2, p3}, Lcom/sec/android/easyMover/host/ActivityBase;->onRequestPermissionsResult(I[Ljava/lang/String;[I)V
    invoke-static {p0, p1, p2, p3}, '''+ns+'''OriginalPermissionController;->onResult(Landroid/app/Activity;I[Ljava/lang/String;[I)V
    return-void
.end method'''.lstrip())
 return s+'\n.method protected onDestroy()V\n    .registers 1\n    invoke-static {p0}, '+ns+'OriginalPermissionController;->destroy(Landroid/app/Activity;)V\n    invoke-super {p0}, Lcom/sec/android/easyMover/host/ActivityBase;->onDestroy()V\n    return-void\n.end method\n'
mutate('com/sec/android/easyMover/ui/RuntimePermissionActivity.smali',permission)
def wireless(s):
 s=method(s,'.method public final onCreate(Landroid/os/Bundle;)V',lambda m:m.replace('    :cond_d\n','    :cond_d\n    invoke-static {p0}, '+ns+'Entry;->wireless(Landroid/app/Activity;)V\n    return-void\n'))
 for name in ['onResume','onPause','onDestroy']:
  s=method(s,f'.method public final {name}()V',lambda m:f'.method public final {name}()V\n    .registers 1\n    invoke-super {{p0}}, Lcom/sec/android/easyMover/host/ActivityBase;->{name}()V\n    return-void\n.end method')
 return s
mutate('com/sec/android/easyMover/ui/WirelessConnectingActivity.smali',wireless)
(b/'flow-hooks.patch').write_text(''.join(''.join(difflib.unified_diff(a.splitlines(True),z.splitlines(True),fromfile='lab1/'+f,tofile='original-flow/'+f)) for f,(a,z) in changed.items()))
(b/'flow-hook-record.json').write_text(json.dumps({'files':list(changed),'fakePermissionGrants':False,'fakeMainDataModelCompletion':False},indent=2))
print('Patched',len(changed),'original UI classes')
