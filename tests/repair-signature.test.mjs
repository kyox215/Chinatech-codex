import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
const modules=new Map();
const compile=path=>ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
function library(name){if(modules.has(name))return modules.get(name);const code=compile('lib/'+name+'.ts').replace(/from "\.\/([^"]+)"/g,(_,dep)=>`from "${library([...name.split("/").slice(0,-1),dep].join("/"))}"`);const result=url(code);modules.set(name,result);return result;}
const domain=await import(library('repair-intake-record'));
const {defaultStoreSettings,parseStoreSettings}=await import(library('store-settings'));
const {emptyIntakeServices}=await import(library('intake-services'));
const {defaultStaffData}=await import(library('staff'));
const {getRepairOrder}=await import(library('repair-fixtures'));
const policy={months:6,shopName:'DEMO Shop',address:'DEMO Address',phone:'DEMO Contact'};
const data={id:'LOCAL-0000000000000001',createdAt:'2026-10-02 10:00:00',updatedAt:'2026-10-02 10:00:00',previewAt:'2026-10-02 10:00',customerName:'DEMO',phone:'+39 320 000 1188',email:'',category:'手机',brand:'Apple',model:'DEMO Phone',color:'黑色',serial:'DEMO-SIGN',issue:'屏幕：碎裂',accessories:['充电器'],services:structuredClone(emptyIntakeServices),priority:'普通',photoCount:0,policy};
const draft=(source=data,selectedPolicy=policy,id='DEMO-SIGN-1')=>({id,signedAt:'2026-10-02 10:01:00',language:'it',termsVersion:'repair-intake-2026-10-v1',strokes:[[{x:.1,y:.2},{x:.3,y:.5},{x:.6,y:.2}]],snapshot:domain.intakeSignatureSnapshot(source,selectedPolicy)});
test('笔迹拒绝空白、单点、原地重复、越界、非有限坐标和超量，接受合法真实轨迹',()=>{
  for(const strokes of [[],[[{x:0,y:0}]],[[{x:0,y:0},{x:0,y:0}]],[[{x:0,y:0},{x:1.01,y:0}]],[[{x:0,y:0},{x:NaN,y:0}]],Array.from({length:81},()=>[{x:0,y:0},{x:1,y:1}]),[Array.from({length:1001},(_,i)=>({x:i%2,y:0}))]])assert.equal(domain.validSignatureStrokes(strokes),false);
  assert.equal(domain.validSignatureStrokes(draft().strokes),true);
});
test('签署绑定客户、设备、故障、随件、配件、期限和结构化原文，阶段更新时间不撤销签署',()=>{
  const records=domain.appendIntakeSignature([],data,policy,draft(),'DEMO-OWNER',0);
  assert.equal(domain.matchingIntakeSignature(records,data,policy).id,'DEMO-SIGN-1');
  for(const changed of [{phone:'+39 320 000 1189'},{issue:'电池'},{accessories:[]},{services:{...emptyIntakeServices,screen:{quality:'assembled',technology:'oled'}}},{brand:'DEMO Other'},{color:'蓝色'},{faults:['屏幕：碎裂'],issueNote:''}])assert.equal(domain.matchingIntakeSignature(records,{...data,...changed},policy),undefined);
  assert.equal(domain.matchingIntakeSignature(records,data,{...policy,months:12}),undefined);
  assert.ok(domain.matchingIntakeSignature(records,{...data,updatedAt:'2026-10-02 12:00:00'},policy));
  assert.throws(()=>domain.appendIntakeSignature([],{...data,issue:'电池'},policy,draft(),'DEMO-OWNER',0));
  assert.equal(domain.appendIntakeSignature(records,data,policy,draft(),'DEMO-OWNER',0),records);
  assert.throws(()=>domain.appendIntakeSignature(records,data,policy,draft(data,policy,'DEMO-SIGN-2'),'DEMO-OWNER',0));
  const next=domain.appendIntakeSignature(records,data,policy,draft(data,policy,'DEMO-SIGN-2'),'DEMO-OWNER',1);assert.equal(next.length,2);assert.equal(records.length,1);
});
test('老接机格式可读；坏签名、重复操作、超量历史和不一致故障不进入存储',()=>{
  assert.deepEqual(domain.parseIntakeSignatures(JSON.stringify({version:1,records:[data]})),[]);
  const signature={...draft(),orderId:data.id,actorId:'DEMO-OWNER'};
  for(const signatures of [[{...signature,strokes:[]}],[signature,signature],Array.from({length:21},(_,i)=>({...signature,id:'DEMO-'+i}))])assert.throws(()=>domain.parseLocalIntakes(JSON.stringify({version:1,records:[data],signatures})));
  assert.equal(domain.validLocalIntake({...data,faults:['电池'],issueNote:''}),false);
});
test('默认保修区分维修和整机，旧设置升级，非法月数不会静默回退',()=>{
  assert.equal(defaultStoreSettings.repairWarrantyMonths,6);assert.equal(defaultStoreSettings.retailWarrantyMonths,12);
  const legacy={...defaultStoreSettings};delete legacy.repairWarrantyMonths;delete legacy.retailWarrantyMonths;
  assert.equal(parseStoreSettings(JSON.stringify({version:1,settings:legacy})).repairWarrantyMonths,6);
  for(const months of [null,0,-1,1.5,121,'6'])assert.throws(()=>parseStoreSettings(JSON.stringify({version:1,settings:{...defaultStoreSettings,repairWarrantyMonths:months}})));
});
let instance=0;
async function store(){const code=compile('components/repairs/local-intake-store.ts').replace(/import \{[^}]+\} from "@\/lib\/backend\/react";/g, "const useBackendState=()=>null;const useBackendMode=()=>false;").replace(/import \{[^}]+\} from "react";/,'const useSyncExternalStore=()=>{}; const useMemo=fn=>fn();').replace(/import \{ useRepairWorkflows \} from "\.\/repair-workflow-store";/,'const useRepairWorkflows=()=>({workflows:{}});').replace(/from "@\/lib\/([^"]+)"/g,(_,dep)=>`from "${library(dep)}"`);return import(url(code+'\n// '+instance++));}
async function withBrowser(action){const before=globalThis.window;const values=new Map([['chinatech.m1.store-settings.v1',JSON.stringify({version:1,settings:{...defaultStoreSettings,shopName:policy.shopName,address:policy.address,phone:policy.phone}})]]);const browser=new EventTarget();browser.denyWrite=false;browser.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(browser.denyWrite)throw new Error('DEMO quota');values.set(key,value);}};globalThis.window=browser;try{await action(await store(),values,browser);}finally{if(before===undefined)delete globalThis.window;else globalThis.window=before;}}
const key='chinatech.m1.local-intakes.v1';
test('新工单与签名一次保存；旧表单不能覆盖补签，修改资料保留原签名',()=>withBrowser(async(store,values)=>{
  const saved=store.saveLocalIntake(data,0,draft());const envelope=JSON.parse(values.get(key));assert.equal(saved.revision,1);assert.equal(envelope.signatures.length,1);
  store.saveIntakeSignature(saved,policy,draft(saved,policy,'DEMO-SIGN-2'),1);
  const changed=store.saveLocalIntake({...saved,issue:'电池'},1);assert.equal(changed.revision,2);assert.equal(JSON.parse(values.get(key)).signatures.length,2);
  const raw=values.get(key);assert.throws(()=>store.saveLocalIntake(saved,1));assert.equal(values.get(key),raw);
  assert.throws(()=>store.saveIntakeSignature(saved,policy,draft(saved,policy,'DEMO-SIGN-3'),2));assert.equal(values.get(key),raw);
  assert.equal(domain.matchingIntakeSignature(JSON.parse(raw).signatures,changed,policy),undefined);
}));
test('fixture和售后来源工单可追加签名，未知工单不能签署，来源快照不改写',()=>withBrowser(async(store,values)=>{
  const fixture=domain.fixtureIntakeReceipt(getRepairOrder('CT-2026-0927'));
  store.saveIntakeSignature(fixture,policy,draft(fixture,policy,'DEMO-FIXTURE-SIGN'),0);
  assert.equal(JSON.parse(values.get(key)).records.length,0);
  const afterSale={...data,retailOrigin:{unitId:'DEMO-UNIT',saleId:'DEMO-SALE',caseId:'DEMO-CASE'}};
  values.set(key,JSON.stringify({version:1,records:[afterSale],signatures:[]}));
  store.saveIntakeSignature(afterSale,policy,draft(afterSale),0);assert.deepEqual(JSON.parse(values.get(key)).records,[afterSale]);
  assert.throws(()=>store.saveLocalIntake(afterSale,1));assert.throws(()=>store.saveIntakeSignature({...data,id:'LOCAL-0000000000000002'},policy,draft(),0));
}));
test('权限撤销、身份切换、容量失败、资料或设置变化与损坏数据都保留原记录',()=>withBrowser(async(store,values,browser)=>{
  const saved=store.saveLocalIntake(data,0);const original=values.get(key);
  browser.denyWrite=true;assert.throws(()=>store.saveIntakeSignature(saved,policy,draft(),0));assert.equal(values.get(key),original);browser.denyWrite=false;
  values.set('chinatech.m1.staff.v1',JSON.stringify({version:1,data:{...defaultStaffData,currentId:'DEMO-VIEWER'}}));assert.throws(()=>store.saveIntakeSignature(saved,policy,draft(),0));assert.equal(values.get(key),original);
  values.delete('chinatech.m1.staff.v1');
  let staffReads=0;const getter=browser.localStorage.getItem;browser.localStorage.getItem=name=>name==='chinatech.m1.staff.v1' && ++staffReads>=2?JSON.stringify({version:1,data:{...defaultStaffData,currentId:'DEMO-MANAGER'}}):getter(name);
  assert.throws(()=>store.saveIntakeSignature(saved,policy,draft(),0));assert.equal(values.get(key),original);browser.localStorage.getItem=getter;
  values.set(key,'{DEMO invalid');assert.throws(()=>store.saveIntakeSignature(saved,policy,draft(),0));assert.equal(values.get(key),'{DEMO invalid');
}));

test('原接机页签署期间详情补签会拒绝旧历史版本，记录和所有签名均保留',()=>withBrowser(async(store,values)=>{
  const saved=store.saveLocalIntake(data,0);
  const formDraft=draft(saved,policy,'DEMO-FORM-A');
  store.saveIntakeSignature(saved,policy,draft(saved,policy,'DEMO-DETAIL-B'),0);
  const raw=values.get(key);
  assert.throws(()=>store.saveLocalIntake(saved,1,formDraft,0));assert.equal(values.get(key),raw);
  const next=store.saveLocalIntake(saved,1,formDraft,1);assert.equal(next.revision,2);assert.equal(JSON.parse(values.get(key)).signatures.length,2);
}));
test('新接机冻结保修；legacy和fixture补签前默认变化必须重新核对',()=>withBrowser(async(store,values)=>{
  const saved=store.saveLocalIntake(data,0);
  values.set('chinatech.m1.store-settings.v1',JSON.stringify({version:1,settings:{...defaultStoreSettings,shopName:policy.shopName,address:policy.address,phone:policy.phone,repairWarrantyMonths:9}}));
  store.saveIntakeSignature(saved,policy,draft(saved),0);
  assert.equal(JSON.parse(values.get(key)).records[0].policy.months,6);
  const fixture=domain.fixtureIntakeReceipt(getRepairOrder('CT-2026-0927'));
  const raw=values.get(key);assert.throws(()=>store.saveIntakeSignature(fixture,policy,draft(fixture),0));assert.equal(values.get(key),raw);
  const currentPolicy={...policy,months:9};store.saveIntakeSignature(fixture,currentPolicy,draft(fixture,currentPolicy,'DEMO-FIXTURE-POLICY'),0);
}));

test('签名保存采集比例并兼容旧固定比例，拒绝非法比例',()=>{
 const signature={...draft(),orderId:data.id,actorId:'DEMO-OWNER'};
 assert.equal(domain.validIntakeSignature(signature),true);
 for(const ratio of [.5,1.92,4.62,10])assert.equal(domain.validIntakeSignature({...signature,aspectRatio:ratio}),true);
 for(const ratio of [null,0,.49,10.01,Infinity,NaN,'1.92'])assert.equal(domain.validIntakeSignature({...signature,aspectRatio:ratio}),false);
 const saved=domain.appendIntakeSignature([],data,policy,{...draft(),aspectRatio:1.92},'DEMO-OWNER',0);assert.equal(saved[0].aspectRatio,1.92);
});
