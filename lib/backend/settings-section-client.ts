import{backendScopeKey,type BackendReadScope}from'./read-plan';
import{settingsSectionFormat,type SettingsSectionQuery,type SettingsSectionPage}from'./settings-section-contract';
import{defaultStoreSettings,parseStoreSettings,validateFinanceEntry,type FinanceEntry}from'../store-settings';
import{allPermissions,staffRoles,defaultStaffData,parseStaffData}from'../staff';
import{parseRepairGroups}from'../repair-groups';
type ObjectValue=Record<string,unknown>;
function object(value:unknown,keys:string[]):ObjectValue{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw Error();return value as ObjectValue;}
function strings(row:ObjectValue,keys:string[]){if(keys.some(key=>typeof row[key]!=='string'))throw Error();}
function integer(value:unknown,min=0){if(!Number.isSafeInteger(value)||Number(value)<min)throw Error();}
function generationParts(value:unknown){if(typeof value!=='string')throw Error();const parts:unknown=JSON.parse(value);if(!Array.isArray(parts)||![3,4].includes(parts.length)||parts.some(part=>typeof part!=='string')||!/^(0|[1-9]\d*)$/.test(parts[0])||!/^(0|[1-9]\d*)$/.test(parts[1])||parts[2]!==''&&!/^[a-f0-9]{32}$/.test(parts[2]))throw Error();return parts as string[];}
/** The staff writer accepts safe numeric watermarks. A larger canonical
 * watermark must neither hide the roster nor round its write lock. */
export function settingsStaffWriteRevision(generation:string):number|null{try{const revision=Number(generationParts(generation)[0]);return Number.isSafeInteger(revision)?revision:null;}catch{return null;}}
function previews(row:ObjectValue,keys:string[],limits:Record<string,number>={}){if(!Array.isArray(row.previews)||row.previews.some(key=>typeof key!=='string'||!keys.includes(key)||typeof row[key]!=='string'||limits[key]!==undefined&&[...row[key]as string].length!==limits[key])||new Set(row.previews).size!==row.previews.length)throw Error();}
function item(value:unknown,query:SettingsSectionQuery,revision:number){
 if(['general','printing','orders'].includes(query.kind)){
  const fields=query.kind==='general'?['shopName','address','phone','repairWarrantyMonths','retailWarrantyMonths']:query.kind==='printing'?['paper']:['repairGroups'],row=object(value,['revision',...fields]);if(row.revision!==revision)throw Error();
  if(query.kind==='general'){strings(row,['shopName','address','phone']);for(const key of['repairWarrantyMonths','retailWarrantyMonths']){integer(row[key],1);if(Number(row[key])>120)throw Error();}}
  else if(query.kind==='printing'){if(!['a4','a5','half','double'].includes(String(row.paper)))throw Error();}
  else{if(!row.repairGroups)throw Error();parseRepairGroups(row.repairGroups);}return;
 }
 if(query.kind==='supplier'||query.kind==='suppliers'){
  const row=object(value,['id','name','phone','website','active',...(query.kind==='suppliers'?['previews']:[])]);strings(row,['id','name','phone','website']);if(typeof row.active!=='boolean')throw Error();if(query.kind==='suppliers')previews(row,['name','phone'],{name:120,phone:80});const validation=query.kind==='suppliers'&&(row.previews as string[]).includes('name')?{...row,name:'preview validation'}:row;parseStoreSettings(JSON.stringify({version:1,settings:{...defaultStoreSettings,suppliers:[validation]}}));return;
 }
 if(query.kind==='finance'||query.kind==='finance-original'){
  const row=object(value,['id','kind','amountCents','purpose','relatedId','note','time','voidReason',...(query.kind==='finance'?['previews']:[])]);strings(row,['id','purpose','relatedId','note','time']);if(row.voidReason!==undefined&&typeof row.voidReason!=='string')throw Error();if(query.kind==='finance'){if(!/^[a-f0-9]{64}$/.test(row.id as string))throw Error();previews(row,['purpose','note','time','voidReason'],{purpose:200,note:200,time:100,voidReason:200});}const validation=query.kind==='finance'&&(row.previews as string[]).includes('purpose')?{...row,purpose:'preview validation'}:row;validateFinanceEntry(validation as FinanceEntry);return;
 }
 if(query.kind==='staff'||query.kind==='member'){
  const row=object(value,['id','name','email','role','accountStatus','membershipStatus','revision','permissions',...(query.kind==='staff'?['previews']:[])]);strings(row,['id','name','email']);integer(row.revision,1);if(!Object.hasOwn(staffRoles,String(row.role))||!['pending','active','disabled'].includes(String(row.accountStatus))||!['pending','active','disabled'].includes(String(row.membershipStatus))||!Array.isArray(row.permissions)||row.permissions.some(permission=>!allPermissions.includes(permission))||new Set(row.permissions).size!==row.permissions.length)throw Error();if(query.kind==='staff')previews(row,['name','email']);return;
 }
 if(query.kind==='audit'){
  const row=object(value,['id','actorId','actorName','targetId','time','before','after','targetName','targetNamePreview']);parseStaffData(JSON.stringify({version:1,data:{...defaultStaffData,audit:[row]}}));if(row.targetName!==undefined&&typeof row.targetName!=='string'||row.targetNamePreview!==undefined&&typeof row.targetNamePreview!=='boolean')throw Error();return;
 }
 const row=object(value,['id','key','source','label','previews']);strings(row,['id','key','source','label']);if(!['repair','unit'].includes(String(row.source))||row.key!==row.source+':'+row.id)throw Error();previews(row,['label']);
}
/** Decode the read DTO without normalizing or turning a preview into a draft. */
export function settingsSectionResponse(value:unknown,scope:BackendReadScope,query:SettingsSectionQuery,known?:string):SettingsSectionPage|{unchanged:true;stateToken:string}{
 try{
  const row=object(value,['unchanged','formatVersion','scope','generation','stateToken','query','revision','items','total','startIndex','previousCursor','nextCursor','totals','auditTotal']);
  if(row.unchanged===true){if(!known||row.stateToken!==known||Object.keys(row).some(key=>!['unchanged','stateToken'].includes(key)))throw Error();return{unchanged:true,stateToken:known};}
  if(row.formatVersion!==settingsSectionFormat||typeof row.stateToken!=='string'||!/^[a-f0-9]{64}$/.test(row.stateToken)||typeof row.generation!=='string'||!row.generation||JSON.stringify(row.query)!==JSON.stringify(query)||backendScopeKey(row.scope as BackendReadScope)!==backendScopeKey(scope))throw Error();
  integer(row.revision);const generation=generationParts(row.generation);if(generation.length!==(query.kind==='association'?4:3)||generation[1]!==String(row.revision))throw Error();integer(row.total);integer(row.startIndex);if(!Array.isArray(row.items)||row.items.length>50||Number(row.startIndex)+row.items.length>Number(row.total)||Number(row.total)>0&&!row.items.length)throw Error();
  for(const key of['previousCursor','nextCursor'])if(row[key]!==null&&(typeof row[key]!=='string'||String(row[key]).length>2048))throw Error();
  if(query.kind==='finance'){const total=object(row.totals,['income','expense','balance']);integer(total.income);integer(total.expense);if(!Number.isSafeInteger(total.balance)||total.balance!==Number(total.income)-Number(total.expense))throw Error();}else if(row.totals!==undefined)throw Error();
  if(query.kind==='staff')integer(row.auditTotal);else if(row.auditTotal!==undefined)throw Error();
  for(const value of row.items)item(value,query,Number(row.revision));
  const keys=row.items.map(value=>query.kind==='association'?value.key:'id'in value?value.id:query.kind);if(new Set(keys).size!==keys.length)throw Error();
  return value as SettingsSectionPage;
 }catch{throw new Error('后台资料暂不可用。');}
}
