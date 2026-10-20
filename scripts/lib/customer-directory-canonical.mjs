import assert from 'node:assert/strict';
const keys={profile:['phone','name','email'],repair:['id','phone','customerName','email','createdAt','updatedAt'],history:['id','sourceRow','intakeAt','pickupDate','customerPhone','customerName']};
/** Owner-only oracle reads. No photos, signatures, notes, costs, product snapshots
 * or event bodies cross the wire; sales are flat physical source rows. */
export async function directoryCanonicalBatch(tx,storeId,kind,cursor=null){
 let query;
 if(kind==='sale'){
  const [id,position]=cursor??['',0];
  query=tx`with candidates as(select u.id,n::integer position,jsonb_build_object('id',sale->'id','time',sale->'time','customerPhone',sale->'customerPhone','customerName',sale->'customerName','customerEmail',sale->'customerEmail')data
   from chinatech_v2_private.retail_units u cross join lateral jsonb_array_elements(coalesce(u.data->'sales','[]'))with ordinality x(sale,n)
   where u.store_id=${storeId} and(u.id>${id} or u.id=${id} and n>${position})order by u.id,n limit 200),sized as(select *,row_number()over(order by id,position)rank,sum(octet_length(data::text)+octet_length(id)+100)over(order by id,position)bytes from candidates)
   select id,position,data from sized where rank=1 or bytes<=900000 order by id,position`;
 }else{
  assert(Object.hasOwn(keys,kind));const table={profile:'customers',repair:'repair_intakes',history:'retail_history_records'}[kind],column=kind==='profile'?'normalized_phone':'id';
  query=tx`with candidates as(select ${tx(column)}::text id,coalesce((select jsonb_object_agg(key,value)from jsonb_each(data)where key=any(${tx.array(keys[kind],25)})),'{}'::jsonb)data from ${tx('chinatech_v2_private.'+table)}
   where store_id=${storeId} and ${tx(column)}::text>${cursor??''} ${kind==='history'?tx`and published`:tx``} order by ${tx(column)}::text limit 200),sized as(select *,row_number()over(order by id)rank,sum(octet_length(data::text)+octet_length(id)+100)over(order by id)bytes from candidates)
   select id,data from sized where rank=1 or bytes<=900000 order by id`;
 }
 const rows=await query;assert(rows.length<=200);assert(Buffer.byteLength(JSON.stringify(rows))<=1000000,'One legal identity summary must fit the bounded oracle wire budget');return rows;
}
