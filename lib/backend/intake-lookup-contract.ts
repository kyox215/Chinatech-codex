import type{BackendReadScope}from'./read-plan';import type{RepairStatus}from'../repair-status';import type{IntakePolicy}from'../repair-intake-record';
export type IntakeHistoryQuery={kind:'exact'|'related';serial:string;brand:string;model:string};
export type IntakeHistoryItem={id:string;createdAt:string;brand:string;model:string;stage:RepairStatus;statusLabel?:string;issue?:string;faults?:string[];issueNote?:string};
export type IntakeHistoryPage={scope:BackendReadScope;raw:string;query:IntakeHistoryQuery;generation:string;stateToken:string;total:number;exactTotal:number;relatedTotal:number;startIndex:number;items:IntakeHistoryItem[];nextCursor:string|null};
export type IntakeDraftMetadata={id:string;exists:boolean;revision:number;signatureCount:number;policy:IntakePolicy};
export function intakeHistoryQuery(raw:unknown):IntakeHistoryQuery{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!['kind','serial','brand','model'].includes(key)))throw new Error('请求资料无效。');
 const{kind='exact',serial='',brand='',model=''}=raw as Partial<IntakeHistoryQuery>;
 if(!['exact','related'].includes(kind)||typeof serial!=='string'||serial.length>150||typeof brand!=='string'||brand.length>100||typeof model!=='string'||model.length>160)throw new Error('请求资料无效。');
 // Keep raw case and width. Matching derives its own legacy JS keys; repeated
 // protocol validation must not expand Unicode or change identifier semantics.
 return{kind,serial:serial.trim(),brand:brand.trim(),model:model.trim()};
}
