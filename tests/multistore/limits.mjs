import {origin} from './local-only.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import postgres from 'postgres';import {randomUUID} from 'node:crypto';import {createClient} from '@supabase/supabase-js';
const c=JSON.parse(fs.readFileSync('.local/backend/connection.private.json','utf8')),env=JSON.parse(fs.readFileSync('.local/backend/env.private.json','utf8')),f=JSON.parse(fs.readFileSync('.company-tmp/multistore-pilot-20261017/fixture.private.json','utf8'));
const admin=postgres(c.DB_URL,{max:2}),runtime=postgres(env.APP_DATABASE_URL,{max:3}),checks=[];
const claims=who=>{const raw=who.jar.filter(([k])=>/^ct_rebuild_auth(?:\.\d+)?$/.test(k)).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v).join('');const session=JSON.parse(Buffer.from(raw.slice(7),'base64url').toString());return {sub:who.id,session_id:JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString()).session_id,role:'authenticated'};};
async function setup(tx,who,storeId=''){await tx`select set_config('request.jwt.claims',${JSON.stringify(claims(who))},true),set_config('app.store_id',${storeId},true)`;}
try{
 // Test daily ownership boundary without retaining an additional store.
 try{await runtime.begin(async tx=>{await setup(tx,f.owner);const [row]=await tx`select chinatech_v2_private.create_store(${randomUUID()},'Synthetic daily third') as id`;assert(row.id);let denied=false;try{await tx.savepoint(sub=>sub`select chinatech_v2_private.create_store(${randomUUID()},'Synthetic daily fourth')`);}catch(e){assert.equal(e.code,'P0001');denied=true;}assert(denied);checks.push('third daily store allowed/fourth denied');throw new Error('ROLLBACK_VERIFIED');});}catch(e){assert.equal(e.message,'ROLLBACK_VERIFIED');}
 const [cap]=await admin`select max_stores from chinatech_v2_private.pilot_control where singleton`;const [count]=await admin`select count(*)::int as count from chinatech_v2.stores`;
 try{
  await admin`update chinatech_v2_private.pilot_control set max_stores=${count.count+1} where singleton`;
  const create=()=>runtime.begin(async tx=>{await setup(tx,f.staff);return tx`select chinatech_v2_private.create_store(${randomUUID()},'Synthetic concurrent pilot boundary') as id`;});
  const concurrent=await Promise.allSettled([create(),create()]);assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);assert.equal(concurrent.filter(r=>r.status==='rejected').length,1);checks.push('concurrent platform admission retains exactly one final slot');
 }finally{await admin`update chinatech_v2_private.pilot_control set max_stores=${cap.max_stores} where singleton`;}
 // Member approval cap is enforced independently of invitation validity.
 const supabase=createClient(c.API_URL,c.SECRET_KEY||c.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const email='pilot-cap-'+randomUUID()+'@example.test',password='Test-'+randomUUID();const created=await supabase.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);
 const jars={owner:f.owner.jar,applicant:[]},accounts={owner:f.owner.id,applicant:created.data.user.id};
 async function request(who,path,body){const response=await fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:jars[who].map(([k,v])=>k+'='+v).join('; '),'x-ct-account-id':accounts[who],'x-ct-store-id':f.storeId},body:JSON.stringify(body)});for(const raw of response.headers.getSetCookie()){const pair=raw.split(';')[0],at=pair.indexOf('=');const name=pair.slice(0,at),value=pair.slice(at+1);jars[who]=jars[who].filter(([k])=>k!==name);jars[who].push([name,value]);}return {status:response.status,data:await response.json()};}
 assert.equal((await request('applicant','/api/auth/login',{email,password,remember:false})).status,200);
 const invite=await request('owner','/api/backend/store-invitations',{requestId:randomUUID()});assert.equal(invite.status,200);
 const application=await request('applicant','/api/account/store-invitations',{token:invite.data.token,requestId:randomUUID()});assert.equal(application.status,200);
 const [entitlement]=await admin`select member_limit from chinatech_v2_private.store_entitlements where store_id=${f.storeId}`;
 try{await admin`update chinatech_v2_private.store_entitlements set member_limit=2 where store_id=${f.storeId}`;const blocked=await request('owner','/api/backend/store-applications',{id:application.data.id,requestId:randomUUID(),action:'approve',role:'viewer'});assert.equal(blocked.status,409);const [membership]=await admin`select count(*)::int as count from chinatech_v2.store_memberships where store_id=${f.storeId} and user_id=${created.data.user.id}`;assert.equal(membership.count,0);checks.push('full member allowance refuses valid approval without partial membership');
 const secondEmail='pilot-cap-second-'+randomUUID()+'@example.test',secondPassword='Test-'+randomUUID();const second=await supabase.auth.admin.createUser({email:secondEmail,password:secondPassword,email_confirm:true});assert.ifError(second.error);accounts.applicant2=second.data.user.id;jars.applicant2=[];
 assert.equal((await request('applicant2','/api/auth/login',{email:secondEmail,password:secondPassword,remember:false})).status,200);
 const secondInvite=await request('owner','/api/backend/store-invitations',{requestId:randomUUID()});assert.equal(secondInvite.status,200);
 const secondApplication=await request('applicant2','/api/account/store-invitations',{token:secondInvite.data.token,requestId:randomUUID()});assert.equal(secondApplication.status,200);
 await admin`update chinatech_v2_private.store_entitlements set member_limit=3 where store_id=${f.storeId}`;
 const approvals=await Promise.all([application,secondApplication].map(a=>request('owner','/api/backend/store-applications',{id:a.data.id,requestId:randomUUID(),action:'approve',role:'viewer'})));
 assert.deepEqual(approvals.map(r=>r.status).sort(),[200,409]);const [total]=await admin`select count(*)::int as count from chinatech_v2.store_memberships where store_id=${f.storeId} and membership_status='active'`;assert.equal(total.count,3);checks.push('concurrent distinct approvals cannot consume the same last member slot');
}finally{await admin`update chinatech_v2_private.store_entitlements set member_limit=${entitlement.member_limit} where store_id=${f.storeId}`;}
 fs.writeFileSync('.company-tmp/multistore-pilot-20261017/limits-integration.json',JSON.stringify({checks},null,2));console.log('PASS '+checks.length+' actual daily/platform/member limits');
}finally{await Promise.all([runtime.end(),admin.end()]);}
