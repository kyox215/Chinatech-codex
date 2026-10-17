import type { BackendReadScope } from "./read-plan";
import {listSearchInput} from "./list-search";
export type ProcurementBatchRow={id:string;repairId:string;repairModel:string|null;repairCancelled:boolean;item:string;specification:string|null;quantity:number;arrived:number;ledgerRevision:number;supplierId:string};
export type ProcurementSupplierCandidate={id:string;name:string;active:boolean;count:number};
export type ProcurementBatchPage={scope:BackendReadScope;stateToken:string;total:number;unresolved:number;eligible:number;suppliers:ProcurementSupplierCandidate[];supplier:ProcurementSupplierCandidate|null;items:ProcurementBatchRow[];startIndex:number;nextCursor:string|null};
export type ProcurementRepairCandidate={id:string;model:string|null};
export type ProcurementBatchQuery={kind:"suppliers"|"rows"|"repairs";q:string;repairId:string;supplierId:string};
export function procurementBatchQuery(raw:Partial<ProcurementBatchQuery>):ProcurementBatchQuery {
 const {kind="suppliers",q="",repairId="",supplierId=""}=raw;
 if(!raw||Array.isArray(raw)||Object.keys(raw).some(key=>!["kind","q","repairId","supplierId"].includes(key))||!["suppliers","rows","repairs"].includes(kind)||typeof q!=="string"||q.length>160||typeof repairId!=="string"||repairId.length>100||typeof supplierId!=="string"||supplierId.length>100||kind==="rows"&&!supplierId)throw new Error("请求资料无效。");
 return {kind,q:listSearchInput(q),repairId,supplierId};
}
