import {origin} from './local-only.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import postgres from 'postgres';import {randomUUID,randomBytes} from 'node:crypto';import {createClient} from '@supabase/supabase-js';
const c=JSON.parse(fs.readFileSync('.local/backend/connection.private.json')),env=JSON.parse(fs.readFileSync('.local/backend/env.private.json')),f=JSON.parse(fs.readFileSync('.company-tmp/multistore-pilot-20261017/fixture.private.json'));
const admin=postgres(c.DB_URL,{prepare:false}),runtime=postgres(env.APP_DATABASE_URL,{prepare:false}),auth=createClient(c.API_URL,c.SECRET_KEY||c.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),checks=[];

function claims(who){const raw=who.jar.filter(([k])=>/^ct_rebuild_auth(?:\.\d+)?$/.test(k)).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v).join('');const session=JSON.parse(Buffer.from(raw.slice(7),'base64url'));return {sub:who.id,session_id:JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url')).session_id,role:'authenticated'};}
async function txDenied(who,label,run){let rejected=false;try{await runtime.begin(async tx=>{await tx`select set_config('request.jwt.claims',${JSON.stringify(claims(who))},true),set_config('app.store_id',${f.storeId},true)`;try{await run(tx);}catch(e){rejected=true;throw e;}throw Error('UNEXPECTED_ALLOWED');});}catch(e){assert.notEqual(e.message,'UNEXPECTED_ALLOWED',label);}assert(rejected,label);checks.push(label);}
async function post(path,body,cookie=''){const r=await fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'x-ct-account-id':f.owner.id},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
try{
 const email='unverified-'+randomBytes(6).toString('hex')+'@example.test',password='Pilot'+randomBytes(14).toString('hex');
 const created=await auth.auth.admin.createUser({email,password,email_confirm:false});assert.ifError(created.error);assert.equal(created.data.user.email_confirmed_at,undefined);
 const login=await post('/api/auth/login',{email,password,remember:false});assert(login.status>=400);checks.push('real Auth unverified login denied');
 assert((await post('/api/account/stores',{name:'Unverified forbidden',requestId:randomUUID()})).status>=400);checks.push('unverified session cannot create store');
 assert((await post('/api/account/store-invitations',{token:randomBytes(32).toString('base64url'),requestId:randomUUID()})).status>=400);checks.push('unverified session cannot apply');
 const [original]=await admin`select * from chinatech_v2.store_memberships where store_id=${f.storeId} and user_id=${f.staff.id}`;
 const [target]=await admin`select user_id from chinatech_v2.store_memberships where store_id=${f.storeId} and user_id<>${f.staff.id} and role<>'owner' limit 1`;
 assert(target,'Synthetic fixture needs one additional approved member');
 try{
  await admin`update chinatech_v2.store_memberships set role='manager',permissions=array['staff.manage','repairs.view'],revision=revision+1 where id=${original.id}`;
  await txDenied(f.staff,'manager cannot delegate staff.manage',tx=>tx`update chinatech_v2.store_memberships set permissions=array['staff.manage'] where store_id=${f.storeId} and user_id=${target.user_id}`);
  await txDenied(f.staff,'manager cannot grant absent permission',tx=>tx`update chinatech_v2.store_memberships set permissions=array['settings.edit'] where store_id=${f.storeId} and user_id=${target.user_id}`);
  await txDenied(f.staff,'manager cannot edit owner',tx=>tx`update chinatech_v2.store_memberships set permissions=array['repairs.view'] where store_id=${f.storeId} and user_id=${f.owner.id}`);
  await txDenied(f.staff,'manager cannot escalate self',tx=>tx`update chinatech_v2.store_memberships set permissions=array['staff.manage','settings.edit'] where id=${original.id}`);
  await txDenied(f.staff,'manager cannot grant owner',tx=>tx`update chinatech_v2.store_memberships set role='owner' where store_id=${f.storeId} and user_id=${target.user_id}`);
 }finally{await admin`update chinatech_v2.store_memberships set role=${original.role},permissions=${original.permissions},revision=revision+1 where id=${original.id}`;}
 // Fixture invitations are rolled back, including all unexpected successes.
 for(const [label,fields]of [['revoked',{revoked_at:new Date()}],['expired',{expires_at:new Date(Date.now()-1000)}],['consumed by another applicant',{applicant_id:f.staff.id,consumed_at:new Date()}]]){
  let denied=false;try{await admin.begin(async tx=>{const digest=randomBytes(32).toString('hex');await tx`insert into chinatech_v2_private.store_invitations ${tx({id:randomUUID(),store_id:f.storeId,created_by:f.owner.id,created_at:new Date(Date.now()-86400000),token_hash:digest,expires_at:new Date(Date.now()+86400000),...fields})}`;await tx`select set_config('request.jwt.claims',${JSON.stringify(claims(f.owner))},true)`;try{await tx`select chinatech_v2_private.invitation_action(${digest},${randomUUID()})`;}catch(error){assert.equal(error.code,'P0001');assert.equal(error.message,'Invitation unavailable');denied=true;throw Error('ROLLBACK_DENIED');}throw Error('UNEXPECTED_ALLOWED');});}catch(e){assert.notEqual(e.message,'UNEXPECTED_ALLOWED');if(!denied)throw e;}assert(denied);checks.push(label+' invitation denied');
 }
 fs.writeFileSync('.company-tmp/multistore-pilot-20261017/admission-security.json',JSON.stringify({checks,registrationBoundary:'Admin creates unverified synthetic identity; no public signup/email confirmation flow claimed.'},null,2));console.log('PASS '+checks.length+' admission/manager/invitation negative checks');
}finally{await Promise.all([admin.end(),runtime.end()]);}
