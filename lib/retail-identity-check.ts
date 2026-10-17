import{backendSnapshot}from'./backend/client';
import{backendScopeKey}from'./backend/read-plan';
import{requestScopedList}from'./backend/scoped-read-client';
import type{RetailUnit}from'./retail';

/** Full authorized scope check; the write transaction repeats the canonical
 * conflict rules before committing. A late reply never advances another UI. */
export async function checkFormalRetailIdentity(unit:Pick<RetailUnit,'id'|'code'|'brand'|'serial'|'imei1'|'imei2'>){
 const scope=backendSnapshot()?.read?.scope;if(!scope)throw new Error('登录身份或页面版本已变化，请刷新后重新核对。');
 const key=backendScopeKey(scope),checked=await requestScopedList(scope,'/api/backend/v2/retail/identity-check',{body:{id:unit.id,code:unit.code,brand:unit.brand,serial:unit.serial,imei1:unit.imei1,imei2:unit.imei2}});
 const current=backendSnapshot()?.read?.scope;if(!current||backendScopeKey(current)!==key)throw new Error('登录身份或页面版本已变化，请刷新后重新核对。');
 if(!Array.isArray(checked.items)||checked.items.length>1||checked.items.some((row:unknown)=>!row||typeof row!=='object'||typeof(row as {id?:unknown}).id!=='string'||typeof(row as {code?:unknown}).code!=='string'))throw new Error('后台资料暂不可用。');
 if(checked.items[0])throw new Error(`身份与已有单机 ${checked.items[0].code} 重复，请打开原档案，不要重复建档。`);
}
