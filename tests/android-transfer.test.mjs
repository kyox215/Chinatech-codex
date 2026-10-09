import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../lib/toolbox/android-transfer.ts', import.meta.url),'utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exports = {}; new Function('exports',compiled)(exports);
const { defaultProfile, canRunAssistant, planAndroidTransfer, isVerifiedReceipt } = exports;
test('unknown, too old, unsupported future and native Harmony fail closed',()=>{
  for (const sdk of [null,25,38,NaN,34.5]) assert.equal(canRunAssistant({...defaultProfile,sdk}),false);
  const p=planAndroidTransfer(defaultProfile,{...defaultProfile,system:'harmony-next'});
  assert.equal(p.runnable,false);assert.ok(p.capabilities.filter(c=>['media','files','contacts','apps'].includes(c.kind)).every(c=>c.coverage==='blocked'));
});
test('cross brand without Google does not disable core transfer or promise private data',()=>{
  const p=planAndroidTransfer({...defaultProfile,brand:'HUAWEI',googleServices:false},{...defaultProfile,brand:'Samsung'});
  assert.equal(p.runnable,true);assert.equal(p.capabilities.find(c=>c.kind==='contacts').coverage,'alpha');
  assert.equal(p.capabilities.find(c=>c.kind==='chats').coverage,'external');assert.equal(p.capabilities.find(c=>c.kind==='apps').coverage,'alpha');
  assert.ok(p.notices.some(n=>n.includes('Google')));
});
test('media permission generations, selected photos and work profiles retain scope',()=>{
  for(const sdk of [26,28,29,30,31,33,34,35,36,37]){
    const p=planAndroidTransfer({...defaultProfile,sdk,partialPhotos:true,workProfile:true},defaultProfile);
    const permissions=p.capabilities.find(c=>c.kind==='media').permissions;
    assert.equal(permissions[1].permission,sdk>=34?'READ_MEDIA_IMAGES / READ_MEDIA_VIDEO / READ_MEDIA_AUDIO / READ_MEDIA_VISUAL_USER_SELECTED':sdk>=33?'READ_MEDIA_IMAGES / READ_MEDIA_VIDEO / READ_MEDIA_AUDIO':'READ_EXTERNAL_STORAGE');
    assert.ok(p.notices.some(n=>n.includes('部分照片')));assert.ok(p.notices.some(n=>n.includes('工作资料夹')));
    assert.ok(p.capabilities.find(c=>c.kind==='sms').permissions.every(x=>x.mode==='role'));
  }
});
test('permission plan does not mutate shared profiles or prior plan',()=>{
  const a=planAndroidTransfer(defaultProfile,defaultProfile);
  planAndroidTransfer(defaultProfile,{...defaultProfile,system:'harmony-next'});
  assert.equal(a.capabilities[0].coverage,'alpha');assert.equal(defaultProfile.system,'android');
});
test('hotspot uses per-version permission and new-phone host and manual old sender fallback',()=>{
 const old=planAndroidTransfer({...defaultProfile,sdk:26},{...defaultProfile,sdk:28});
 assert.equal(old.connectionPermissions[0].side,'receiver');assert.equal(old.connectionPermissions[1].side,'sender');
 assert.equal(old.connectionPermissions[0].permission,'ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION');
 assert.equal(old.connectionPermissions[1].permission,'ACTION_WIFI_SETTINGS');
 const modern=planAndroidTransfer({...defaultProfile,sdk:37},{...defaultProfile,sdk:37});
 assert.equal(modern.connectionPermissions[0].permission,'NEARBY_WIFI_DEVICES');
 assert.equal(modern.connectionPermissions.filter(p=>p.permission==='ACCESS_LOCAL_NETWORK').length,2);
 assert.deepEqual(planAndroidTransfer(defaultProfile,{...defaultProfile,system:'harmony-next'}).connectionPermissions,[]);
});
test('received or hash-mismatching content is never counted as saved',()=>{
 const r={objectId:'a'.repeat(24),expectedBytes:10,receivedBytes:10,expectedSha256:'a'.repeat(64),savedSha256:'a'.repeat(64),destinationCommitted:true};
 assert.equal(isVerifiedReceipt(r),true);
 for(const invalid of [{receivedBytes:9},{savedSha256:'b'.repeat(64)},{destinationCommitted:false},{expectedBytes:-1},{expectedBytes:1.5},{objectId:'../private'},{expectedSha256:'X'.repeat(64)}]) assert.equal(isVerifiedReceipt({...r,...invalid}),false);
 assert.equal(isVerifiedReceipt({...r,expectedBytes:0,receivedBytes:0}),true);
});

test('scanned exports retain explicit reconstruction boundaries',()=>{
 const p=planAndroidTransfer(defaultProfile,defaultProfile);
 assert.equal(p.capabilities.find(c=>c.kind==='calendar').coverage,'alpha');
 assert.ok(p.capabilities.find(c=>c.kind==='contacts').permissions.some(x=>x.permission==='WRITE_CONTACTS'));
 assert.ok(p.capabilities.find(c=>c.kind==='calendar').permissions.some(x=>x.permission==='WRITE_CALENDAR'));
 assert.ok(p.capabilities.find(c=>c.kind==='apps').permissions.some(x=>x.permission==='REQUEST_INSTALL_PACKAGES'));
 assert.equal(p.capabilities.find(c=>c.kind==='protected').coverage,'external');
});
