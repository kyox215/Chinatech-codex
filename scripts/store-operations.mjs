// Server operator utility. No browser keys and no default production target.
// Read-only by default. Explicit --apply adjusts one store's entitlement and
// records its exact before/after values. It never deletes data or objects.
import postgres from 'postgres';
import {randomUUID} from 'node:crypto';
const args=process.argv.slice(2),option=name=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
const storeId=option('--store'),actor=option('--operator');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
if(!uuid(storeId)||!process.env.CT_OPERATIONS_DATABASE_URL)throw new Error('Supply --store UUID and private CT_OPERATIONS_DATABASE_URL. No default database is used.');
const apply=args.includes('--apply'),bytes=option('--attachment-limit'),members=option('--member-limit');
if(apply&&(!uuid(actor)||(!bytes&&!members)))throw new Error('--apply requires --operator UUID and a specific quota value.');
for(const value of [bytes,members])if(value!==undefined&&(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))))throw new Error('Quota values must be safe non-negative integers.');
if(members!==undefined&&Number(members)<1)throw new Error('At least one owner seat is required.');
const sql=postgres(process.env.CT_OPERATIONS_DATABASE_URL,{max:1,prepare:false});
try{
 const result=await sql.begin(async tx=>{
  const [role]=await tx`select current_user as name`;
  if(role.name==='chinatech_runtime')throw new Error('The runtime role cannot perform platform operations.');
  const [before]=await tx`select * from chinatech_v2_private.store_entitlements where store_id=${storeId} for update`;
  if(!before)throw new Error('Store entitlement not found.');
  const next={attachmentLimit:bytes===undefined?Number(before.attachment_limit):Number(bytes),memberLimit:members===undefined?before.member_limit:Number(members)};
  const orphans=await tx`select r.id,r.bytes,r.status,r.created_at,exists(select 1 from storage.objects o where o.bucket_id='chinatech-private-attachments' and o.name=r.store_id::text||'/'||r.id::text||case r.mime when 'image/png' then '.png' when 'image/webp' then '.webp' else '.jpg' end) as object_exists from chinatech_v2_private.attachment_reservations r where r.store_id=${storeId} and r.created_at<now()-interval '7 days' and not exists(select 1 from chinatech_v2_private.intake_photo_objects p join chinatech_v2_private.repair_intakes i on i.store_id=p.store_id and i.id=p.repair_id where p.store_id=r.store_id and p.id=r.id and i.data->'photos' @> jsonb_build_array(jsonb_build_object('id',r.id::text))) and not exists(select 1 from chinatech_v2_private.retail_units u where u.store_id=r.store_id and u.data->'photos' @> jsonb_build_array('ct-photo:'||r.id::text)) order by r.created_at limit 100`;
  if(apply){
   if(!(await tx`select id from chinatech_v2.accounts where id=${actor}`).length)throw new Error('Operator must identify an existing account for the audit.');
   await tx`update chinatech_v2_private.store_entitlements set attachment_limit=${next.attachmentLimit},member_limit=${next.memberLimit} where store_id=${storeId}`;
   await tx`insert into chinatech_v2_private.audit_events(store_id,actor_id,request_id,kind,entity_id) values(${storeId},${actor},${randomUUID()},'platform.entitlement.adjusted',${JSON.stringify({before:{attachmentLimit:Number(before.attachment_limit),memberLimit:before.member_limit},after:next})})`;
  }
  return {storeId,applied:apply,current:{attachmentLimit:Number(before.attachment_limit),memberLimit:before.member_limit,planVersion:before.plan_version},proposed:next,unreferencedOlderThanSevenDays:orphans,note:'Unreferenced originals stay charged. This utility performs no cleanup.'};
 });
 console.log(JSON.stringify(result,null,2));
}finally{await sql.end();}
