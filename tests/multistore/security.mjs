import {origin} from './local-only.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import postgres from 'postgres';import {randomUUID,createHash} from 'node:crypto';import {createClient} from '@supabase/supabase-js';
const c=JSON.parse(fs.readFileSync('.local/backend/connection.private.json','utf8')),env=JSON.parse(fs.readFileSync('.local/backend/env.private.json','utf8')),f=JSON.parse(fs.readFileSync('.company-tmp/multistore-pilot-20261017/fixture.private.json','utf8'));
const admin=postgres(c.DB_URL,{max:2,prepare:false}),runtime=postgres(env.APP_DATABASE_URL,{max:2,prepare:false}),checks=[];
function auth(who){const raw=who.jar.filter(([key])=>/^ct_rebuild_auth(?:\.\d+)?$/.test(key)).sort(([a],[b])=>a.localeCompare(b)).map(([,value])=>value).join('');const session=JSON.parse(Buffer.from(raw.slice(7),'base64url').toString());return {token:session.access_token,sessionId:JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString()).session_id};}
const owner=auth(f.owner),staff=auth(f.staff);
async function transaction(who,storeId,run){return runtime.begin(async tx=>{await tx`select set_config('request.jwt.claims',${JSON.stringify({sub:who==='owner'?f.owner.id:f.staff.id,session_id:who==='owner'?owner.sessionId:staff.sessionId,role:'authenticated'})},true),set_config('app.store_id',${storeId},true)`;return run(tx);});}
async function denied(label,run){let rejected=false;try{await runtime.begin(async tx=>{await tx`select set_config('request.jwt.claims',${JSON.stringify({sub:f.owner.id,session_id:owner.sessionId,role:'authenticated'})},true),set_config('app.store_id',${f.storeId},true)`;try{await run(tx);}catch(e){rejected=true;throw e;}throw new Error('UNEXPECTED_ALLOWED');});}catch(e){assert.notEqual(e.message,'UNEXPECTED_ALLOWED',label);}assert(rejected,label);checks.push(label);}
try{
 await denied('runtime cannot alter another store entitlement',tx=>tx`update chinatech_v2_private.store_entitlements set attachment_limit=999999 where store_id=${f.secondStoreId}`);
 await denied('invitation identity and secret immutable',tx=>tx`update chinatech_v2_private.store_invitations set token_hash=${'a'.repeat(64)} where store_id=${f.storeId}`);
 await denied('application tenant immutable',tx=>tx`update chinatech_v2_private.store_applications set store_id=${f.secondStoreId} where store_id=${f.storeId}`);
 await denied('cannot delegate owner',tx=>tx`update chinatech_v2.store_memberships set role='owner' where store_id=${f.storeId} and user_id=${f.staff.id}`);
 await denied('cannot change own membership',tx=>tx`update chinatech_v2.store_memberships set permissions='{}' where store_id=${f.storeId} and user_id=${f.owner.id}`);
 const [quota]=await admin`select * from chinatech_v2_private.store_entitlements where store_id=${f.storeId}`;
 try{
  const usage=await transaction('owner',f.storeId,async tx=>(await tx`select chinatech_v2_private.read_store_usage(${f.storeId}) as usage`)[0].usage);
  await admin`update chinatech_v2_private.store_entitlements set attachment_limit=${usage.usedBytes+usage.reservedBytes+256000} where store_id=${f.storeId}`;
  const reserve=()=>transaction('owner',f.storeId,tx=>tx`insert into chinatech_v2_private.attachment_reservations(store_id,id,actor_id,bytes,content_hash) values(${f.storeId},${randomUUID()},${f.owner.id},100,${createHash('sha256').update(randomUUID()).digest('hex')})`);
  const results=await Promise.allSettled([reserve(),reserve()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);checks.push('concurrent reservations cannot exceed allowance');
  await admin`update chinatech_v2_private.store_entitlements set attachment_limit=0 where store_id=${f.storeId}`;
  const read=await fetch(origin+'/api/backend/state',{headers:{Cookie:f.owner.jar.map(([k,v])=>k+'='+v).join('; '),'x-ct-store-id':f.storeId}});assert.equal(read.status,200);checks.push('over-quota existing business remains readable');
 }finally{await admin`update chinatech_v2_private.store_entitlements set attachment_limit=${quota.attachment_limit},member_limit=${quota.member_limit} where store_id=${f.storeId}`;}
 const photo=JSON.parse(fs.readFileSync('.company-tmp/multistore-pilot-20261017/storage-api.json','utf8'));
 const client=createClient(c.API_URL,c.PUBLISHABLE_KEY||c.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+owner.token}}});
 const path=f.storeId+'/'+photo.photoId+'.jpg',bucket=client.storage.from('chinatech-private-attachments');
 assert((await bucket.createSignedUrl(path,600)).error);checks.push('direct signed URL creation denied');
 const original=Buffer.from(await (await bucket.download(path)).data.arrayBuffer());
 const pendingId=randomUUID(),pendingPath=f.storeId+'/'+pendingId+'.jpg';
 const call=async body=>{const response=await fetch(origin+'/api/backend/attachments',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:f.owner.jar.map(([k,v])=>k+'='+v).join('; '),'x-ct-account-id':f.owner.id,'x-ct-store-id':f.storeId},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 const reserved=await call({action:'reserve',id:pendingId,bytes:original.length,hash:createHash('sha256').update(original).digest('hex'),domain:'repairs',mime:'image/jpeg'});assert.equal(reserved.status,200,JSON.stringify(reserved));
 assert((await bucket.createSignedUploadUrl(pendingPath)).error);checks.push('signed upload capabilities denied');
 assert.ifError((await bucket.upload(pendingPath,original,{contentType:'image/jpeg'})).error);
 const cancel=await call({action:'cancel',id:pendingId});assert([403,409].includes(cancel.status));
 const [retained]=await admin`select status,reserved_bytes from chinatech_v2_private.attachment_reservations where store_id=${f.storeId} and id=${pendingId}`;assert.equal(retained.status,'reserved');assert.equal(Number(retained.reserved_bytes),256000);checks.push('uploaded unconfirmed cancellation cannot free charged reservation');
 const beforeConfirmClient=createClient(c.API_URL,c.PUBLISHABLE_KEY||c.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+staff.token}}});assert((await beforeConfirmClient.storage.from('chinatech-private-attachments').download(pendingPath)).error);checks.push('other member cannot read unconfirmed original');
 const confirm=await call({action:'confirm',id:pendingId});assert.equal(confirm.status,200,JSON.stringify(confirm));assert((await bucket.download(pendingPath)).error);checks.push('confirmed unbound orphan remains charged and unreadable');
 const update=await bucket.update(path,Buffer.from('fake'),{contentType:'image/jpeg'});assert(update.error);checks.push('overwrite denied');
 const deleted=await bucket.remove([path]);assert(deleted.error||deleted.data.length===0);assert.ifError((await bucket.download(path)).error);checks.push('delete cannot remove immutable original');
 // Temporary broad legacy SELECT policy must not defeat restrictive bucket guards.
 await admin`create policy multistore_test_broad_read on storage.objects for select to authenticated using(true)`;
 try{assert((await bucket.createSignedUrl(path,600)).error);checks.push('legacy permissive SELECT cannot bypass signed URL guard');}finally{await admin`drop policy multistore_test_broad_read on storage.objects`;}
 await admin`update chinatech_v2.store_memberships set membership_status='disabled',revision=revision+1 where store_id=${f.storeId} and user_id=${f.staff.id}`;
 const outsider=createClient(c.API_URL,c.PUBLISHABLE_KEY||c.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+staff.token}}});assert((await outsider.storage.from('chinatech-private-attachments').download(path)).error);checks.push('revoked membership denies direct Storage download');
 await admin`update chinatech_v2.store_memberships set membership_status='active',revision=revision+1 where store_id=${f.storeId} and user_id=${f.staff.id}`;
 fs.writeFileSync('.company-tmp/multistore-pilot-20261017/security-integration.json',JSON.stringify({checks},null,2));console.log('PASS '+checks.length+' real runtime/Storage/security checks');
}finally{await Promise.all([runtime.end(),admin.end()]);}
