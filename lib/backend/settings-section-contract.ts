import type{BackendReadScope}from'./read-plan';
import type{StoreSettings,SupplierProfile,FinanceEntry}from'../store-settings';
import type{StaffMember,StaffAudit}from'../staff';
import{listSearchInput}from'./list-search';
export const settingsSectionFormat=1;
export const settingsReadVersionChangedCode='READ_VERSION_CHANGED';
export type SettingsSectionKind='general'|'printing'|'orders'|'suppliers'|'supplier'|'finance'|'finance-original'|'staff'|'member'|'audit'|'association';
export type SettingsSectionQuery={kind:SettingsSectionKind;q:string;filter:'all'|'income'|'expense';key:string;id:string};
export type SettingsPreferences=Pick<StoreSettings,'revision'|'shopName'|'address'|'phone'|'repairWarrantyMonths'|'retailWarrantyMonths'>|Pick<StoreSettings,'revision'|'paper'>|Pick<StoreSettings,'revision'|'repairGroups'>;
export type SettingsSupplierSummary=SupplierProfile&{previews:string[]};
export type SettingsFinanceSummary=Omit<FinanceEntry,'id'>&{id:string;previews:string[]};
export type SettingsMemberSummary=StaffMember&{previews:string[]};
export type SettingsAssociation={id:string;key:string;source:'repair'|'unit';label:string;previews:string[]};
export type SettingsSectionItem=SettingsPreferences|SettingsSupplierSummary|SettingsFinanceSummary|SettingsMemberSummary|SettingsAssociation|SupplierProfile|FinanceEntry|StaffMember|StaffAudit;
export type SettingsSectionPage<T=SettingsSectionItem>={formatVersion:1;scope:BackendReadScope;generation:string;stateToken:string;query:SettingsSectionQuery;revision:number;items:T[];total:number;startIndex:number;previousCursor:string|null;nextCursor:string|null;totals?:{income:number;expense:number;balance:number};auditTotal?:number;windowBatches?:{startIndex:number;size:number}[];windowExtent?:number};
export function settingsSectionQuery(raw:unknown):SettingsSectionQuery{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('请求资料无效。');const row=raw as Record<string,unknown>;
 if(Object.keys(row).some(key=>!['kind','q','filter','key','id'].includes(key))||!['general','printing','orders','suppliers','supplier','finance','finance-original','staff','member','audit','association'].includes(String(row.kind)))throw new Error('请求资料无效。');
 const kind=row.kind as SettingsSectionKind,q=listSearchInput(row.q??''),filter=row.filter??'all',key=row.key??'',id=row.id??'';
 if(!['all','income','expense'].includes(String(filter))||typeof key!=='string'||key&&!/^[a-f0-9]{64}$/.test(key)||typeof id!=='string'||id.length>200)throw new Error('请求资料无效。');
 if(q&&!['suppliers','staff','association'].includes(kind)||filter!=='all'&&kind!=='finance'||key&&kind!=='finance-original'||id&&!['supplier','member','association'].includes(kind)||kind==='finance-original'&&!key||['supplier','member'].includes(kind)&&!id)throw new Error('请求资料无效。');
 return{kind,q,filter:filter as SettingsSectionQuery['filter'],key,id};
}
