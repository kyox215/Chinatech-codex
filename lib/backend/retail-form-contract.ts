import type{BackendReadScope}from'./read-plan';
import type{RetailCategory,RetailUnit}from'../retail';
import type{RetailCatalogField}from'../retail-catalog';
export const retailFormFields=['brand','model','cpu','gpu','keyboard','edition']as const;
export type RetailFormCandidateQuery={field:RetailCatalogField;category:RetailCategory;brand:string;q:string;key:string};
export type RetailFormCandidate={key:string;label:string;preview:boolean;detail?:string;catalogKey?:string|null};
export type RetailFormCandidatePage={formatVersion:1;scope:BackendReadScope;generation:string;query:RetailFormCandidateQuery;stateToken:string;total:number;items:RetailFormCandidate[]};
export type RetailFormCandidateValue={formatVersion:1;scope:BackendReadScope;query:RetailFormCandidateQuery;key:string;value:string};
export type RetailCopyFacts=Pick<RetailUnit,'id'|'code'|'category'|'brand'|'model'|'color'|'ramGb'|'bodyStorage'|'disks'|'cpu'|'gpu'|'keyboard'|'edition'|'productCode'>;
export type RetailCreationDefaults={revision:number;warrantyMonths:number;copy:RetailCopyFacts|null};
export type RetailIdentityCheck={id:string;code:string};
export function retailCopyFacts(unit:RetailUnit):RetailCopyFacts{
 const{id,code,category,brand,model,color,ramGb,bodyStorage,disks,cpu,gpu,keyboard,edition,productCode}=unit;
 return{id,code,category,brand,model,color,ramGb,bodyStorage,disks,cpu,gpu,keyboard,edition,productCode};
}
export function retailFormCandidateQuery(raw:unknown):RetailFormCandidateQuery{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!['field','category','brand','q','key'].includes(key)))throw new Error('请求资料无效。');
 const{field='model',category='phone',brand='',q='',key=''}=raw as Partial<RetailFormCandidateQuery>;
 if(!retailFormFields.includes(field as RetailCatalogField)||!['phone','tablet','laptop','desktop','console','other'].includes(category)||typeof brand!=='string'||brand.length>5000||typeof q!=='string'||q.length>160||typeof key!=='string'||key!==''&&!/^[a-f0-9]{64}$/.test(key))throw new Error('请求资料无效。');
 return{field,category,brand,q:q.trim(),key};
}
