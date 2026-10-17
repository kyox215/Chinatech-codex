import {origin} from './local-only.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import {randomBytes,randomUUID} from 'node:crypto';import {createClient} from '@supabase/supabase-js';
const config=JSON.parse(fs.readFileSync('.local/backend/connection.private.json','utf8'));
const admin=createClient(config.API_URL,config.SECRET_KEY||config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const result=[];async function user(label){const email='pilot-'+label+'-'+randomBytes(4).toString('hex')+'@example.test',password='Pilot'+randomBytes(12).toString('hex');const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'Pilot '+label}});assert.ifError(error);return{id:data.user.id,email,password,jar:new Map()};}
async function req(who,path,body,storeId){const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:[...who.jar].map(([k,v])=>k+'='+v).join('; '),'x-ct-account-id':who.id,...(storeId?{'x-ct-store-id':storeId}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});for(const raw of response.headers.getSetCookie()){const [pair]=raw.split(';'),index=pair.indexOf('=');who.jar.set(pair.slice(0,index),pair.slice(index+1));}let data;try{data=await response.json();}catch{data={};}return {status:response.status,data};}
const owner=await user('owner'),staff=await user('staff');
for(const who of [owner,staff]){const response=await req(who,'/api/auth/login',{email:who.email,password:who.password,remember:false});assert.equal(response.status,200,JSON.stringify(response));}
const requestId=randomUUID(),first=await req(owner,'/api/account/stores',{name:'Synthetic pilot A',requestId});assert.equal(first.status,200,JSON.stringify(first));const storeId=first.data.storeId;
assert.deepEqual((await req(owner,'/api/account/stores',{name:'Synthetic pilot A',requestId})).data,first.data);result.push('create/replay same store');
const second=await req(owner,'/api/account/stores',{name:'Synthetic pilot B',requestId:randomUUID()});assert.equal(second.status,200,JSON.stringify(second));result.push('second store');
const invite=await req(owner,'/api/backend/store-invitations',{requestId:randomUUID()},storeId);assert.equal(invite.status,200,JSON.stringify(invite));
assert.equal((await req(staff,'/api/backend/state',undefined,storeId)).status,403);result.push('outsider state denied');
const application=await req(staff,'/api/account/store-invitations',{token:invite.data.token,requestId:randomUUID()});assert.equal(application.status,200,JSON.stringify(application));
const review=await req(owner,'/api/backend/store-applications',{id:application.data.id,requestId:randomUUID(),action:'approve',role:'viewer'},storeId);assert.equal(review.status,200,JSON.stringify(review));result.push('invite/application/approval');
assert.equal((await req(staff,'/api/backend/state',undefined,storeId)).status,200);assert.equal((await req(staff,'/api/backend/state',undefined,second.data.storeId)).status,403);assert.equal((await req(owner,'/api/backend/state')).status,400);result.push('approved A/other B denied/missing explicit store denied');
const usage=await req(owner,'/api/backend/store-usage',undefined,storeId);assert.equal(usage.status,200,JSON.stringify(usage));assert.equal(usage.data.memberCount,2);result.push('quota usage');
fs.writeFileSync('.company-tmp/multistore-pilot-20261017/fixture.private.json',JSON.stringify({owner:{...owner,jar:[...owner.jar]},staff:{...staff,jar:[...staff.jar]},storeId,secondStoreId:second.data.storeId}));
fs.writeFileSync('.company-tmp/multistore-pilot-20261017/api-flow.json',JSON.stringify({checks:result},null,2));console.log(result);
