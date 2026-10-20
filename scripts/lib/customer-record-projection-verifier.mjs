import assert from'node:assert/strict';import{sourceLoader}from'../../tests/helpers/typescript-source.mjs';
const load=sourceLoader(),{customerRecordFact}=load('./lib/customer-record-projection'),{customerRecordKey}=load('./lib/backend/customer-detail-contract');
// Cursor is by flat association, not canonical entity. Even one physical unit
// containing 1,000 sales is emitted as <=200 narrow, byte-bounded facts.
export async function customerRecordCanonicalBatch(tx,storeId,cursor=null){
 const[kind='',origin='',ordinal=0]=cursor??[];
 assert(['','history','repairs','sales'].includes(kind));assert.equal(typeof origin,'string');assert(Number.isSafeInteger(ordinal)&&ordinal>=0);
 // Canonical kind order is C history < repairs < sales. An empty current kind
 // advances to the later kinds; it never ends the complete association stream.
 if(kind<='history'){
  const rows=await tx`with keys as materialized(
   select h.id,(h.data->>'sourceRow')::integer event_order from chinatech_v2_private.retail_history_records h
   where h.store_id=${storeId} and h.published and(${kind!=='history'} or(h.id::text collate "C",(h.data->>'sourceRow')::integer)>(${origin} collate "C",${ordinal}))
   order by h.id::text collate "C",event_order limit 200
  ),documents as materialized(select 'history'kind,h.id::text origin_id,k.event_order,h.id::text event_id,jsonb_build_object('id',h.id,'sourceRow',h.data->'sourceRow','sourceStatus',h.data->'sourceStatus','brand',h.data->'brand','model',h.data->'model','intakeAt',h.data->'intakeAt','pickupDate',h.data->'pickupDate','salePriceCents',h.data->'salePriceCents','reviewReasons',h.data->'reviewReasons','customerPhone',h.data->'customerPhone','customerName',h.data->'customerName') document
   from keys k cross join lateral(select id,data from chinatech_v2_private.retail_history_records where store_id=${storeId} and id=k.id limit 1)h),sized as(
   select*,row_number()over(order by origin_id collate "C",event_order)n,sum(octet_length(document::text))over(order by origin_id collate "C",event_order)bytes from documents)
  select kind,origin_id,event_order,event_id,document from sized where bytes<=200000 or n=1 order by origin_id collate "C",event_order`;
  if(rows.length)return rows;
 }
 if(kind<='repairs'){
  const rows=await tx`with keys as materialized(
   select r.id from chinatech_v2_private.repair_intakes r where r.store_id=${storeId} and(${kind!=='repairs'} or(r.id collate "C",0)>(${origin} collate "C",${ordinal}))
   order by r.id collate "C" limit 200
  ),documents as materialized(select 'repairs'kind,r.id origin_id,0 event_order,r.id event_id,jsonb_build_object('id',r.id,'phone',r.data->'phone','createdAt',r.data->'createdAt','brand',r.data->'brand','model',r.data->'model','issue',r.data->'issue')||case when r.data?'faults'then jsonb_build_object('faults',r.data->'faults')else '{}'::jsonb end||case when r.data?'issueNote'then jsonb_build_object('issueNote',r.data->'issueNote')else '{}'::jsonb end||case when r.data?'repairOrigin'then jsonb_build_object('repairOrigin',r.data->'repairOrigin')else '{}'::jsonb end document
   from keys k cross join lateral(select id,data from chinatech_v2_private.repair_intakes where store_id=${storeId} and id=k.id limit 1)r),sized as(
   select*,row_number()over(order by origin_id collate "C")n,sum(octet_length(document::text))over(order by origin_id collate "C")bytes from documents)
  select kind,origin_id,event_order,event_id,document from sized where bytes<=200000 or n=1 order by origin_id collate "C"`;
  if(rows.length)return rows;
 }
 // Read <=200 physical identities/counts first. Never expand every sale or
 // construct refund/product/name documents just to sort all remaining rows.
 // Empty-sale units advance only this internal seek; the persisted cursor is
 // still the final emitted (kind, physical ID, ordinal) tuple.
 let afterId=kind==='sales'?origin:'',inclusive=true;
 for(;;){
  const heads=await tx`with keys as materialized(select id from chinatech_v2_private.retail_units
   where store_id=${storeId} and(${kind!=='sales'&&inclusive} or id collate "C">${afterId} collate "C" or(${inclusive} and id collate "C"=${afterId} collate "C"))
   order by id collate "C" limit 200)
   select u.id,jsonb_array_length(coalesce(u.data->'sales','[]'))::integer length from keys k cross join lateral(select id,data from chinatech_v2_private.retail_units where store_id=${storeId} and id=k.id limit 1)u order by u.id collate "C"`;
  if(!heads.length)return[];
  const keys=[];
  for(const head of heads){assert(Number.isSafeInteger(head.length)&&head.length>=0);
   for(let n=head.id===origin&&kind==='sales'?ordinal+1:1;n<=head.length&&keys.length<200;n++)keys.push({id:head.id,ordinality:n});
   if(keys.length===200)break;
  }
  if(keys.length){
   return tx`with keys as materialized(select * from jsonb_to_recordset(${tx.json(keys)})as k(id text,ordinality integer)),documents as materialized(
    select 'sales'kind,u.id origin_id,s.ordinality event_order,s.value->>'id'event_id,jsonb_build_object('id',u.id,'code',u.data->'code','brand',u.data->'brand','model',u.data->'model','sale',jsonb_build_object('id',s.value->'id','time',s.value->'time','customerPhone',s.value->'customerPhone','customerName',s.value->'customerName','customerEmail',s.value->'customerEmail','customerAddress',s.value->'customerAddress','customerNote',s.value->'customerNote','priceCents',s.value->'priceCents','paidCents',s.value->'paidCents','delivered',s.value->'delivered','returned',coalesce(s.value->'returned','false'),'refunds',(select coalesce(jsonb_agg(jsonb_build_object('amountCents',v->'amountCents','void',coalesce(v->'void','false'))),'[]')from jsonb_array_elements(coalesce(s.value->'refunds','[]'))v),'afterSales',(select coalesce(jsonb_agg('{}'::jsonb),'[]')from jsonb_array_elements(coalesce(s.value->'afterSales','[]'))v))||case when s.value?'deliveryDate'then jsonb_build_object('deliveryDate',s.value->'deliveryDate')else '{}'::jsonb end||case when s.value?'product'then jsonb_build_object('product',jsonb_build_object('code',s.value->'product'->'code','brand',s.value->'product'->'brand','model',s.value->'product'->'model'))else '{}'::jsonb end) document
    from keys k cross join lateral(select id,data from chinatech_v2_private.retail_units where store_id=${storeId} and id=k.id limit 1)u
    cross join lateral(select k.ordinality,u.data->'sales'->(k.ordinality-1)value)s),sized as(
    select*,row_number()over(order by origin_id collate "C",event_order)n,sum(octet_length(document::text))over(order by origin_id collate "C",event_order)bytes from documents)
    select kind,origin_id,event_order,event_id,document from sized where bytes<=200000 or n=1 order by origin_id collate "C",event_order`;
  }
  afterId=heads.at(-1).id;inclusive=false;
 }
}
export async function verifyCustomerRecordProjection(tx,storeId){
 let cursor=null,canonicalRows=0,expectedRows=0,batches=0,maximumBatchBytes=0,maximumBatchRows=0;
 for(;;){const rows=await customerRecordCanonicalBatch(tx,storeId,cursor);if(!rows.length)break;assert(rows.length<=200);maximumBatchRows=Math.max(maximumBatchRows,rows.length);maximumBatchBytes=Math.max(maximumBatchBytes,Buffer.byteLength(JSON.stringify(rows)));batches++;
  const actual=await tx`select kind,origin_id,event_id,event_order,key,phone,event_at,search,summary from chinatech_v2_private.customer_record_sources where store_id=${storeId} and(kind,origin_id,event_id)in(select a.kind,a.origin_id,a.event_id from jsonb_to_recordset(${tx.json(rows.map(row=>({kind:row.kind,origin_id:row.origin_id,event_id:row.event_id})))})as a(kind text,origin_id text,event_id text))`;
  for(const row of rows){canonicalRows++;const fact=customerRecordFact(row.kind,row.document),saved=actual.find(item=>item.kind===row.kind&&item.origin_id===row.origin_id&&item.event_id===row.event_id);if(!fact){assert.equal(saved,undefined);continue;}expectedRows++;assert(saved,'Every canonical association has a projection');const key=customerRecordKey(row.kind,row.origin_id,row.event_id);assert.deepEqual({...saved},{kind:row.kind,origin_id:row.origin_id,event_id:row.event_id,event_order:row.event_order,key,phone:fact.phone,event_at:fact.eventAt,search:fact.search,summary:{...fact.summary,key}});}
  cursor=[rows.at(-1).kind,rows.at(-1).origin_id,rows.at(-1).event_order];
 }
 const[count]=await tx`select count(*)::integer n from chinatech_v2_private.customer_record_sources where store_id=${storeId}`;assert.equal(count.n,expectedRows,'No stale or extra source associations');return{canonicalRows,expectedRows,batches,maximumBatchRows,maximumBatchBytes};
}
