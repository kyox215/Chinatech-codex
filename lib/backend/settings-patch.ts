import {parseStoreSettings,type StoreSettings,type SupplierProfile,type FinanceEntry,type PaperFormat} from '../store-settings';
import type {RepairGroupSettings} from '../repair-groups';
import {BackendError} from './database';

/** Explicit section updates. Omitted settings are never represented by empty
 * arrays, and finance facts are append-only except their original void reason. */
export type SettingsPatch=
 |{type:'general';values:Pick<StoreSettings,'shopName'|'address'|'phone'|'repairWarrantyMonths'|'retailWarrantyMonths'>}
 |{type:'printing';paper:PaperFormat}
 |{type:'orders';repairGroups:RepairGroupSettings}
 |{type:'supplier';supplier:SupplierProfile}
 |{type:'finance.append';entry:FinanceEntry}
 |{type:'finance.void';id:string;reason:string};
function object(value:unknown,keys:string[]){if(!value||typeof value!=='object'||Array.isArray(value))throw new BackendError('请求资料无效。');const row=value as Record<string,unknown>;if(Object.keys(row).some(key=>!keys.includes(key)))throw new BackendError('请求包含不支持的字段。');return row;}
export function applySettingsPatch(current:StoreSettings,input:unknown,access:{settings:boolean;financeRead:boolean;financeEdit:boolean}):StoreSettings{
 const patch=object(input,['type','values','paper','repairGroups','supplier','entry','id','reason']);
 if(typeof patch.type!=='string')throw new BackendError('请求资料无效。');
 const financial=patch.type==='finance.append'||patch.type==='finance.void';
 if(financial?!(access.financeRead&&access.financeEdit):!access.settings)throw new BackendError('当前账号没有此操作权限。',403);
 let proposed:StoreSettings;
 switch(patch.type){
  case'general':{object(patch,['type','values']);const values=object(patch.values,['shopName','address','phone','repairWarrantyMonths','retailWarrantyMonths']);if(Object.keys(values).length!==5)throw new BackendError('设置资料无效。');proposed={...current,...values} as StoreSettings;break;}
  case'printing':object(patch,['type','paper']);proposed={...current,paper:patch.paper as PaperFormat};break;
  case'orders':object(patch,['type','repairGroups']);if(!patch.repairGroups)throw new BackendError('设置资料无效。');proposed={...current,repairGroups:patch.repairGroups as RepairGroupSettings};break;
  case'supplier':{object(patch,['type','supplier']);const supplier=object(patch.supplier,['id','name','phone','website','active']) as SupplierProfile;const index=current.suppliers.findIndex(row=>row.id===supplier.id);proposed={...current,suppliers:index<0?[...current.suppliers,supplier]:current.suppliers.map((row,i)=>i===index?supplier:row)};break;}
  case'finance.append':{object(patch,['type','entry']);const entry=object(patch.entry,['id','kind','amountCents','purpose','relatedId','note','time']) as FinanceEntry;if(![entry.id,entry.kind,entry.purpose,entry.relatedId,entry.note,entry.time].every(value=>typeof value==='string'))throw new BackendError('请填写有效收支类型、金额与用途。');if(current.finance.some(row=>row.id===entry.id))throw new BackendError('收支记录重复或作废原因异常。',409);proposed={...current,finance:[...current.finance,entry]};break;}
  case'finance.void':{object(patch,['type','id','reason']);if(typeof patch.id!=='string'||typeof patch.reason!=='string'||!patch.reason.trim()||patch.reason.length>300)throw new BackendError('收支记录重复或作废原因异常。');const entry=current.finance.find(row=>row.id===patch.id);if(!entry||entry.voidReason)throw new BackendError('原收支事实不能覆盖或删除；更正须追加。',409);proposed={...current,finance:current.finance.map(row=>row.id===patch.id?{...row,voidReason:(patch.reason as string).trim()}:row)};break;}
  default:throw new BackendError('请求资料无效。');
 }
 return parseStoreSettings(JSON.stringify({version:1,settings:{...proposed,revision:current.revision+1}}));
}
