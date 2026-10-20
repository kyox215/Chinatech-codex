import assert from'node:assert/strict';import test from'node:test';import{sourceLoader}from'./helpers/typescript-source.mjs';
class BackendError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const load=sourceLoader(process.cwd(),{'./database':{BackendError}}),{applySettingsPatch}=load('./lib/backend/settings-patch'),{defaultStoreSettings,parseStoreSettings}=load('./lib/store-settings'),{defaultRepairGroups}=load('./lib/repair-groups');
const settingsOnly={settings:true,financeRead:false,financeEdit:false},financeOnly={settings:false,financeRead:true,financeEdit:true};
const entry=index=>({id:'DEMO-'+index,kind:index%2?'expense':'income',amountCents:index+1,purpose:'DEMO original '+index,relatedId:'',note:'DEMO note',time:'2026-10-17 10:00:00'});
function current(){return parseStoreSettings(JSON.stringify({version:1,settings:{...structuredClone(defaultStoreSettings),revision:7,finance:[entry(0),{...entry(1),voidReason:'DEMO original reason'}]}}));}
test('explicit preference/printing/groups updates preserve unread suppliers and complete financial facts without mutating the original',()=>{
 const value=current(),raw=JSON.stringify(value),finance=JSON.stringify(value.finance),suppliers=JSON.stringify(value.suppliers);
 for(const patch of[{type:'general',values:{shopName:'DEMO updated',address:'DEMO address',phone:'DEMO',repairWarrantyMonths:18,retailWarrantyMonths:24}},{type:'printing',paper:'a5'},{type:'orders',repairGroups:defaultRepairGroups()}]){const next=applySettingsPatch(value,patch,settingsOnly);assert.equal(next.revision,8);assert.equal(JSON.stringify(next.finance),finance);assert.equal(JSON.stringify(next.suppliers),suppliers);}assert.equal(JSON.stringify(value),raw);
});
test('supplier delta updates its original position or appends without deleting another supplier or modifying finance',()=>{
 const value=current(),first=value.suppliers[0],changed={...first,name:'DEMO renamed'},next=applySettingsPatch(value,{type:'supplier',supplier:changed},settingsOnly);assert.equal(next.suppliers[0].name,changed.name);assert.deepEqual(next.suppliers.slice(1),value.suppliers.slice(1));assert.deepEqual(next.finance,value.finance);
 const appended=applySettingsPatch(value,{type:'supplier',supplier:{id:'DEMO-new',name:'DEMO new',phone:'',website:'',active:true}},settingsOnly);assert.equal(appended.suppliers.length,value.suppliers.length+1);assert.equal(appended.suppliers.at(-1).id,'DEMO-new');assert.throws(()=>applySettingsPatch(value,{type:'supplier',supplier:{...first,id:'DEMO-other'}},settingsOnly),/重复/);
});
test('finance append and one-time void retain all original amounts/names/times and frozen void facts',()=>{
 const value=current(),appended=applySettingsPatch(value,{type:'finance.append',entry:entry(2)},financeOnly);assert.deepEqual(appended.finance.slice(0,2),value.finance);assert.deepEqual(appended.suppliers,value.suppliers);assert.equal(appended.shopName,value.shopName);
 const voided=applySettingsPatch(value,{type:'finance.void',id:value.finance[0].id,reason:' DEMO correction '},financeOnly);assert.deepEqual(voided.finance[0],{...value.finance[0],voidReason:'DEMO correction'});assert.deepEqual(voided.finance[1],value.finance[1]);assert.throws(()=>applySettingsPatch(voided,{type:'finance.void',id:value.finance[0].id,reason:'DEMO replacement'},financeOnly),error=>error.status===409);assert.throws(()=>applySettingsPatch(value,{type:'finance.append',entry:value.finance[0]},financeOnly),error=>error.status===409);
});
test('each section enforces the original permissions and rejects extra/unread arrays instead of replacing them',()=>{
 const value=current();for(const access of[{settings:false,financeRead:true,financeEdit:false},{settings:true,financeRead:false,financeEdit:true},{settings:false,financeRead:false,financeEdit:false}])assert.throws(()=>applySettingsPatch(value,{type:'finance.append',entry:entry(2)},access),error=>error.status===403);
 assert.throws(()=>applySettingsPatch(value,{type:'printing',paper:'a5'},financeOnly),error=>error.status===403);for(const patch of[{type:'printing',paper:'a5',finance:[]},{type:'general',values:{shopName:'DEMO',finance:[]}},{type:'finance.append',entry:{...entry(2),voidReason:'DEMO'}},{type:'finance.void',id:'missing',reason:'DEMO'},{type:'finance.append',entry:{id:'DEMO',kind:'income',amountCents:1}}])assert.throws(()=>applySettingsPatch(value,patch,{settings:true,financeRead:true,financeEdit:true}));
});
test('valid full 5000-entry ledger is preserved by unrelated changes and refuses a 5001st entry',()=>{
 const value=current();value.finance=Array.from({length:5000},(_,i)=>entry(i));const before=JSON.stringify(value.finance),next=applySettingsPatch(value,{type:'printing',paper:'a5'},settingsOnly);assert.equal(next.finance.length,5000);assert.equal(JSON.stringify(next.finance),before);assert.throws(()=>applySettingsPatch(value,{type:'finance.append',entry:entry(5000)},financeOnly),/格式异常/);
});
