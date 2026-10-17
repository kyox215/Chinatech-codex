import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import ts from 'typescript';
const native=createRequire(import.meta.url),{NextRequest,NextResponse}=native('next/server');
const userA='11111111-1111-4111-8111-111111111111',userB='22222222-2222-4222-8222-222222222222',storeA='33333333-3333-4333-8333-333333333333',token='A'.repeat(43);
function harness(){
 const state={now:Date.now(),user:userA,verified:true,live:true,lookups:[],error:null};
 class Clock extends Date{static now(){return state.now;}}
 class BackendError extends Error{constructor(message,status=400){super(message);this.status=status;}}
 const cache=new Map(),env={NODE_ENV:'production',BACKEND_MODE:'supabase',APP_ORIGIN:'https://shop.example.test',SUPABASE_URL:'https://project.example.test',SUPABASE_PUBLISHABLE_KEY:'synthetic-publishable',APP_DATABASE_URL:'synthetic-database-url-unused-for-signing',STORE_ADMISSION_SIGNING_KEY:'a'.repeat(64)};
 function load(path){
  path=resolve(path);if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);
  const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const require=name=>{
   if(name==='server-only')return {};
   if(name==='@/lib/backend/database')return {BackendError};
   if(name==='./store-rate')return {enforceStoreRate:async()=>{}};
   if(name==='./account-auth')return {requireAccountSession:async(request,_response,expected)=>{const {AuthRequestError}=load('lib/supabase/server.ts');if(!state.verified||!state.live)throw new AuthRequestError('invalid',401);if(expected&&request.headers.get('x-ct-account-id')!==state.user)throw new AuthRequestError('changed',409);return {identity:{userId:state.user,sessionId:'session-a'}};}};
   if(name==='@/lib/server/stores'||name==='./stores')return {requiredUuid:value=>value,invitationAction:async(identity,value,id)=>{state.lookups.push({identity,value,id});if(state.error)throw new BackendError('unavailable',state.error);assert.equal(value,token);return {storeName:'Synthetic A',expiresAt:new Clock(state.now+6*3600000).toISOString(),applied:false,...(id?{id,status:'pending'}:{})};}};
   if(name==='@/lib/server/auth-flows')return {copyAuthCookies:(_source,target)=>target};
   if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
   if(name.startsWith('.'))return load(resolve(dirname(path),name+'.ts'));
   return native(name);
  };
  runInContext(code,createContext({exports,require,process:{env},Buffer,Date:Clock,URL,Headers,AbortSignal}),{filename:path});return exports;
 }
 const context=()=>load('lib/server/store-invitation-context.ts');
 function request(path,body,cookie='',origin=env.APP_ORIGIN){return new NextRequest(env.APP_ORIGIN+path,{method:body===undefined?'GET':'POST',headers:{origin,'content-type':'application/json','x-ct-account-id':state.user,cookie},body:body===undefined?undefined:JSON.stringify(body)});}
 const publicPost=(body,cookie='',origin)=>load('app/api/auth/store-invitation/route.ts').POST(request('/api/auth/store-invitation',body,cookie,origin));
 function issue(accountId,expiresAt){const response=NextResponse.json({});context().setInvitationContext(response,token,null,accountId,expiresAt);const cookie=response.cookies.get(context().STORE_INVITATION_COOKIE);return {cookie,header:cookie.name+'='+cookie.value};}
 return {state,env,load,context,request,publicPost,issue};
}
test('invitation candidate only clears its fragment after a cookie roundtrip, with host-only secure limits',async()=>{
 const h=harness(),first=await h.publicPost({token});assert.deepEqual(await first.json(),{stored:false});
 const cookie=first.cookies.get(h.context().STORE_INVITATION_COOKIE);assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);assert.equal(cookie.sameSite,'lax');assert.equal(cookie.path,'/');assert.equal(cookie.domain,undefined);assert.equal(cookie.maxAge,604800);
 h.state.now+=30000;const second=await h.publicPost({token},cookie.name+'='+cookie.value);assert.deepEqual(await second.json(),{stored:true});assert.equal(second.cookies.get(cookie.name).maxAge,604770);assert.match(second.headers.get('cache-control'),/no-store/);assert.equal(h.state.lookups.length,0);
 const blocked=await h.publicPost({token});assert.deepEqual(await blocked.json(),{stored:false});
});
test('public candidate rejects foreign origin, invalid lengths and privilege fields without lookup',async()=>{
 const h=harness();assert.equal((await h.publicPost({token},'','https://foreign.invalid')).status,403);
 for(const body of [{token:'A'.repeat(42)},{token:token+'A'},{token:'../'+token},{token,role:'owner'},{token,accountId:userA}]){const response=await h.publicPost(body);assert.equal(response.status,400);assert.equal(response.cookies.getAll().length,0);}
 assert.equal(h.state.lookups.length,0);assert.equal(h.load('app/api/auth/store-invitation/route.ts').GET,undefined);
});
test('candidate rejects tampering, cross-purpose signatures and expiry',()=>{
 const h=harness(),{header,cookie}=h.issue();assert.equal(h.context().readInvitationContext(h.request('/',undefined,header)).token,token);
 assert.equal(h.context().readInvitationContext(h.request('/',undefined,header+'x')),null);
 const wrong=h.load('lib/server/store-tokens.ts').signStoreValue('store-page',{token,issuedAt:Math.floor(h.state.now/1000),expiresAt:Math.floor(h.state.now/1000)+10});assert.equal(h.context().readInvitationContext(h.request('/',undefined,cookie.name+'='+wrong)),null);
 h.state.now+=604800000;assert.equal(h.context().readInvitationContext(h.request('/',undefined,header)),null);
});
test('only verified live account can read held shop; successful read binds account and actual invitation expiry',async()=>{
 const h=harness(),{header,cookie}=h.issue(),route=h.load('app/api/account/store-invitations/route.ts');
 for(const field of ['verified','live']){h.state[field]=false;const r=await route.GET(h.request('/api/account/store-invitations',undefined,header));assert.equal(r.status,401);assert.equal(h.state.lookups.length,0);h.state[field]=true;}
 const r=await route.GET(h.request('/api/account/store-invitations',undefined,header));const body=await r.json();assert.equal(body.storeName,'Synthetic A');assert.equal(body.hasInvitation,true);assert.equal(JSON.stringify(body).includes(token),false);const bound=r.cookies.get(cookie.name);assert.equal(bound.maxAge,21600);const value=h.context().readInvitationContext(h.request('/',undefined,bound.name+'='+bound.value));assert.equal(value.accountId,userA);
});
test('a different login cannot receive the previous account bound candidate or application facts',async()=>{
 const h=harness(),{header,cookie}=h.issue(userA);h.state.user=userB;const r=await h.load('app/api/account/store-invitations/route.ts').GET(h.request('/api/account/store-invitations',undefined,header));assert.deepEqual(await r.json(),{hasInvitation:false});assert.equal(r.cookies.get(cookie.name).maxAge,0);assert.equal(h.state.lookups.length,0);
});
test('manual apply reuses original request ID, clears only on success and preserves unknown-result cookie',async()=>{
 const h=harness(),{header,cookie}=h.issue(userA),route=h.load('app/api/account/store-invitations/route.ts'),id='44444444-4444-4444-8444-444444444444';
 h.state.error=503;let r=await route.POST(h.request('/api/account/store-invitations',{useContext:true,requestId:id},header));assert.equal(r.status,503);assert.equal(r.cookies.get(cookie.name),undefined);
 h.state.error=null;r=await route.POST(h.request('/api/account/store-invitations',{useContext:true,requestId:id},header));assert.equal(r.status,200);assert.equal((await r.json()).status,'pending');assert.equal(r.cookies.get(cookie.name).maxAge,0);assert.deepEqual(h.state.lookups.map(row=>row.id),[id,id]);
});
test('explicitly expired or unavailable held invitation is cleared; mixed token/context injection is rejected',async()=>{
 const h=harness(),{header,cookie}=h.issue(userA),route=h.load('app/api/account/store-invitations/route.ts');h.state.error=410;
 const expired=await route.GET(h.request('/api/account/store-invitations',undefined,header));assert.equal(expired.status,410);assert.equal(expired.cookies.get(cookie.name).maxAge,0);
 h.state.error=null;const mixed=await route.POST(h.request('/api/account/store-invitations',{useContext:true,token},header));assert.equal(mixed.status,410);assert.equal(h.state.lookups.length,1);
});
test('pagination cursor binds identity, session, store, status and membership revision',()=>{
 const h=harness(),p=h.load('lib/server/store-admission-page.ts'),identity={userId:userA,sessionId:'session-a'},scope=p.pageScope(identity,'applications',storeA,'pending',3);
 const rows=Array.from({length:26},(_,n)=>({id:'00000000-0000-4000-8000-'+String(n+1).padStart(12,'0'),created_at:new Date(1700000000000-n*1000),cursor_created_at:new Date(1700000000000-n*1000).toISOString().replace('.000Z','.000000Z')}));const result=p.storePage(rows,51,scope);assert.equal(result.items.length,25);assert.equal(result.page.totalCount,51);assert.equal(result.page.hasMore,true);assert.equal(p.decodeStoreCursor(result.page.nextCursor,scope).id,rows[24].id);
 for(const badScope of [p.pageScope({...identity,userId:userB},'applications',storeA,'pending',3),p.pageScope({...identity,sessionId:'other'},'applications',storeA,'pending',3),p.pageScope(identity,'applications',userB,'pending',3),p.pageScope(identity,'applications',storeA,'history',3),p.pageScope(identity,'applications',storeA,'pending',4)])assert.throws(()=>p.decodeStoreCursor(result.page.nextCursor,badScope),/分页/);
 assert.throws(()=>p.decodeStoreCursor(result.page.nextCursor+'x',scope),/分页/);assert.equal(p.storePage(rows.slice(0,1),51,scope).page.hasMore,false);
});
test('pagination rejects malformed dates, IDs, duplicate and unsupported query fields',()=>{
 const h=harness(),p=h.load('lib/server/store-admission-page.ts'),sign=h.load('lib/server/store-tokens.ts').signStoreValue;
 for(const cursor of [{scope:'s',createdAt:'2026-02-30T00:00:00.000001Z',id:userA},{scope:'s',createdAt:'2026-01-01T00:00:00.000001Z',id:'other'},{scope:'s',createdAt:'2026-01-01T00:00:00.000001Z',id:userA,extra:true}])assert.throws(()=>p.decodeStoreCursor(sign('store-page',cursor),'s'),/分页/);
 for(const query of ['applicationStatus=all','applicationStatus=pending&applicationStatus=history','limit=99999'])assert.throws(()=>p.admissionQuery(new URL('https://shop.example.test/?'+query)),/分页/);
 assert.equal(p.admissionQuery(new URL('https://shop.example.test/?applicationStatus=history')).applicationStatus,'history');
});

test('signing requires the dedicated valid project key and never falls back to DB credentials',()=>{
 for(const value of [undefined,'', 'A'.repeat(64),'a'.repeat(63),'z'.repeat(64)]){const h=harness();h.env.STORE_ADMISSION_SIGNING_KEY=value;assert.throws(()=>h.issue(),/认证服务暂不可用/);}
 const h=harness(),{header}=h.issue();h.env.APP_DATABASE_URL='different-db-credential';assert.equal(h.context().readInvitationContext(h.request('/',undefined,header)).token,token);
 h.env.STORE_ADMISSION_SIGNING_KEY='b'.repeat(64);assert.equal(h.context().readInvitationContext(h.request('/',undefined,header)),null);
});
test('cursor preserves six microseconds without changing its existing display date',()=>{
 const h=harness(),p=h.load('lib/server/store-admission-page.ts'),rows=Array.from({length:26},(_,n)=>({id:'00000000-0000-4000-8000-'+String(n+1).padStart(12,'0'),created_at:new Date('2026-01-01T00:00:00.000Z'),cursor_created_at:'2026-01-01T00:00:00.'+String(900-n).padStart(6,'0')+'Z'}));
 const result=p.storePage(rows,51,'micro');assert.equal(result.items[24].created_at,rows[24].created_at);assert.equal(p.decodeStoreCursor(result.page.nextCursor,'micro').createdAt,rows[24].cursor_created_at);
});


test('limited manager viewer defaults and changed grants contain only visible delegable permissions', () => {
 const code=ts.transpileModule(readFileSync('lib/store-review.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, exports={};runInContext(code,createContext({exports}));const select=exports.reviewPermissions;
 const viewer=['retail.view','repairs.view','customers.view'];assert.deepEqual(Array.from(select(viewer,['repairs.view','staff.manage'],false)),['repairs.view']);
 assert.deepEqual(Array.from(select(['staff.manage','repairs.view'],['staff.manage','repairs.view'],false)),['repairs.view']);
 assert.deepEqual(Array.from(select(viewer,[],false)),[]);assert.deepEqual(Array.from(select(['staff.manage'],['staff.manage'],true)),['staff.manage']);
});
