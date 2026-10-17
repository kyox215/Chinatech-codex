import type{RetailCodeType}from'../retail';
import{identifierScanValue}from'../identifier-scan';
import type{BackendReadScope}from'./read-plan';
import type{RetailListSummary}from'./retail-list-contract';
export type RetailScanQuery={raw:string;kind:RetailCodeType};
export type RetailScanItem=Pick<RetailListSummary,'key'|'id'|'source'|'code'|'title'|'status'|'previews'>;
export type RetailScanPage={formatVersion:1;scope:BackendReadScope;generation:string;query:RetailScanQuery;raw:string;stateToken:string;total:number;startIndex:number;items:RetailScanItem[];nextCursor:string|null};
export function retailScanQuery(value:Partial<RetailScanQuery>={}):RetailScanQuery{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['raw','kind'].includes(key)))throw new Error('请求资料无效。');
 const{raw='',kind='internal'}=value;
 if(typeof raw!=='string'||raw.length>150||!['internal','serial','imei','product'].includes(kind))throw new Error('请求资料无效。');
 const input=raw.trim();if(!input)throw new Error('请输入识别内容。');
 const checked=kind==='imei'?identifierScanValue(input,'imei'):null;if(checked?.error)throw new Error(checked.error);
 return{raw:checked?.value??input,kind};
}
