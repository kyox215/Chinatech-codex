import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{sourceLoader}from'../../tests/helpers/typescript-source.mjs';
const{repairCustomerDeviceIdentity}=sourceLoader()('./lib/customer-devices');
// Metadata and event rows have independent cursors. A physical unit with 1,000
// sales never sends its full document, photos or a repeated long model to Node.
export async function customerDeviceFactBatch(tx,storeId,cursor=null){
 const[kind='',origin='']=cursor??[];
 return tx`with source as(
  select 'repair'kind,r.id origin_id,jsonb_build_object('id',r.id,'category',r.data->'category','brand',r.data->'brand','model',r.data->'model','serial',r.data->'serial')document from chinatech_v2_private.repair_intakes r where r.store_id=${storeId} and('repair',r.id collate "C")>(${kind},${origin} collate "C")
  union all select 'sale',u.id,jsonb_build_object('id',u.id,'category',u.data->'category','brand',u.data->'brand','model',u.data->'model','serial',u.data->'serial','imei1',u.data->'imei1','code',u.data->'code')from chinatech_v2_private.retail_units u where u.store_id=${storeId} and('sale',u.id collate "C")>(${kind},${origin} collate "C")and exists(select 1 from jsonb_array_elements(coalesce(u.data->'sales','[]'))s where coalesce(s->>'customerPhone','')<>'')
 ),first_batch as(select*from source order by kind collate "C",origin_id collate "C" limit 200),sized as(select*,row_number()over(order by kind collate "C",origin_id collate "C")n,sum(octet_length(to_jsonb(first_batch)::text))over(order by kind collate "C",origin_id collate "C")bytes from first_batch)select kind,origin_id,document from sized where bytes<=200000 or n=1 order by kind collate "C",origin_id collate "C"`;
}
export async function customerDeviceRecordBatch(tx,storeId,cursor=null){
 const[kind='',origin='',ordinal=-1]=cursor??[];
 return tx`with flat as(
  select 'repair'kind,r.id origin_id,r.id event_id,0 event_order,r.id display_id,r.data->>'phone'phone,r.data->>'createdAt'event_at from chinatech_v2_private.repair_intakes r where r.store_id=${storeId} and('repair',r.id collate "C",0)>(${kind},${origin} collate "C",${ordinal})
  union all select 'sale',u.id,s.value->>'id',s.ordinality::integer,u.data->>'code',s.value->>'customerPhone',s.value->>'time'from chinatech_v2_private.retail_units u cross join lateral jsonb_array_elements(coalesce(u.data->'sales','[]'))with ordinality s(value,ordinality)where u.store_id=${storeId} and('sale',u.id collate "C")>=(${kind},${origin} collate "C")and('sale',u.id collate "C",s.ordinality::integer)>(${kind},${origin} collate "C",${ordinal})and coalesce(s.value->>'customerPhone','')<>''
 ),first_batch as(select*from flat order by kind collate "C",origin_id collate "C",event_order limit 200),sized as(select*,row_number()over(order by kind collate "C",origin_id collate "C",event_order)n,sum(octet_length(to_jsonb(first_batch)::text))over(order by kind collate "C",origin_id collate "C",event_order)bytes from first_batch)select kind,origin_id,event_id,event_order,display_id,phone,event_at from sized where bytes<=200000 or n=1 order by kind collate "C",origin_id collate "C",event_order`;
}
export async function putCustomerDeviceFacts(tx,storeId,rows){
 if(!rows.length)return;assert(rows.length<=200);
 await tx`insert into chinatech_v2_private.customer_device_facts(store_id,kind,origin_id,device_id,category,model,serial,search)select ${storeId},v.kind,v.origin_id,f->>'id',f->>'category',f->>'model',f->>'serial',chinatech_v2_private.unicode17_lower((f->>'model')||' '||(f->>'serial'))from jsonb_to_recordset(${tx.json(rows)})v(kind text,origin_id text,document jsonb)cross join lateral chinatech_v2_private.customer_device_document(v.kind,v.document)f on conflict(store_id,kind,origin_id)do update set device_id=excluded.device_id,category=excluded.category,model=excluded.model,serial=excluded.serial,search=excluded.search`;
}
export async function putCustomerDeviceRecords(tx,storeId,rows){
 if(!rows.length)return;assert(rows.length<=200);
 await tx`insert into chinatech_v2_private.customer_device_records(store_id,kind,origin_id,event_id,event_order,display_id,phone,event_at,event_lex,search)select ${storeId},v.kind,v.origin_id,v.event_id,v.event_order,v.display_id,v.phone,v.event_at,chinatech_v2_private.customer_device_utf16(v.event_at),chinatech_v2_private.unicode17_lower(v.phone||' '||v.display_id)from jsonb_to_recordset(${tx.json(rows)})v(kind text,origin_id text,event_id text,event_order integer,display_id text,phone text,event_at text)on conflict(store_id,kind,origin_id,event_id)do update set event_order=excluded.event_order,display_id=excluded.display_id,phone=excluded.phone,event_at=excluded.event_at,event_lex=excluded.event_lex,search=excluded.search`;
}
function expectedFact(kind,document){
 const model=document.brand+' '+document.model,identity=kind==='repair'?repairCustomerDeviceIdentity(document.id,document.brand,document.serial):{key:'retail:'+document.id,serial:document.imei1||document.serial||document.code};
 return{device_id:createHash('sha256').update(identity.key).digest('hex'),category:document.category,model,serial:identity.serial,search:(model+' '+identity.serial).toLowerCase()};
}
export async function verifyCustomerDeviceProjection(tx,storeId){
 let facts=0,records=0,factBatches=0,recordBatches=0,maximumBatchRows=0,maximumBatchBytes=0,cursor=null;
 const measure=rows=>{assert(rows.length<=200);maximumBatchRows=Math.max(maximumBatchRows,rows.length);maximumBatchBytes=Math.max(maximumBatchBytes,Buffer.byteLength(JSON.stringify(rows)));};
 for(;;){const rows=await customerDeviceFactBatch(tx,storeId,cursor);if(!rows.length)break;measure(rows);factBatches++;
  const actual=await tx`select kind,origin_id,device_id,category,model,serial,search from chinatech_v2_private.customer_device_facts where store_id=${storeId} and(kind,origin_id)in(select v.kind,v.origin_id from jsonb_to_recordset(${tx.json(rows.map(({kind,origin_id})=>({kind,origin_id})))})v(kind text,origin_id text))`;
  for(const row of rows){const saved=actual.find(v=>v.kind===row.kind&&v.origin_id===row.origin_id);assert(saved,'Every physical canonical source has metadata');assert.deepEqual({...saved},{kind:row.kind,origin_id:row.origin_id,...expectedFact(row.kind,row.document)});facts++;}cursor=[rows.at(-1).kind,rows.at(-1).origin_id];
 }
 cursor=null;
 for(;;){const rows=await customerDeviceRecordBatch(tx,storeId,cursor);if(!rows.length)break;measure(rows);recordBatches++;
  const actual=await tx`select kind,origin_id,event_id,event_order,display_id,phone,event_at,event_lex,search from chinatech_v2_private.customer_device_records where store_id=${storeId} and(kind,origin_id,event_id)in(select v.kind,v.origin_id,v.event_id from jsonb_to_recordset(${tx.json(rows.map(({kind,origin_id,event_id})=>({kind,origin_id,event_id})))})v(kind text,origin_id text,event_id text))`;
  for(const row of rows){const saved=actual.find(v=>v.kind===row.kind&&v.origin_id===row.origin_id&&v.event_id===row.event_id);assert(saved,'Every canonical device event has a projection');const{event_lex,...value}=saved;assert.deepEqual({...value},{...row,search:(row.phone+' '+row.display_id).toLowerCase()});assert.equal(Buffer.from(event_lex).toString('hex'),Buffer.from(row.event_at,'utf16le').swap16().toString('hex'));records++;}cursor=[rows.at(-1).kind,rows.at(-1).origin_id,rows.at(-1).event_order];
 }
 const[count]=await tx`select(select count(*)from chinatech_v2_private.customer_device_facts where store_id=${storeId})::integer facts,(select count(*)from chinatech_v2_private.customer_device_records where store_id=${storeId})::integer records`;assert.equal(count.facts,facts,'No stale or extra physical sources');assert.equal(count.records,records,'No stale or extra device events');return{facts,records,factBatches,recordBatches,maximumBatchRows,maximumBatchBytes};
}
