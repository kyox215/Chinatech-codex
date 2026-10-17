import assert from'node:assert/strict';import{test}from'node:test';import{createClient}from'@supabase/supabase-js';import{sourceLoader}from'./helpers/typescript-source.mjs';
const load=sourceLoader(),{createRequestAuthReadFetch,createAuthVerificationFetch}=load('./lib/supabase/request-auth-fetch'),{authVerificationFailure}=load('./lib/supabase/auth-verification-error'),url='https://auth.example.invalid',user=url+'/auth/v1/user';
function mock(run){return async()=>{const original=globalThis.fetch,calls=[];globalThis.fetch=async(input,init)=>{calls.push({url:String(input),headers:new Headers(init?.headers),method:init?.method??'GET'});await new Promise(resolve=>setTimeout(resolve,1));return new Response(JSON.stringify({user:new Headers(init?.headers).get('authorization')}),{status:new Headers(init?.headers).get('authorization')==='denied'?401:200});};try{await run(calls);}finally{globalThis.fetch=original;}};}
test('one verified-token network response supplies independent bodies to concurrent and later identical SDK reads',mock(async calls=>{const read=createRequestAuthReadFetch(url),init={headers:{authorization:'Bearer DEMO-A',apikey:'DEMO-key'}};const [a,b]=await Promise.all([read(user,init),read(user,init)]);assert.notEqual(a,b);assert.deepEqual(await a.json(),{user:'Bearer DEMO-A'});assert.deepEqual(await b.json(),{user:'Bearer DEMO-A'});assert.deepEqual(await(await read(user,init)).json(),{user:'Bearer DEMO-A'});assert.equal(calls.length,1);}));
test('different requests, identities, refreshed tokens and effective headers never reuse another validation',mock(async calls=>{const a=createRequestAuthReadFetch(url),b=createRequestAuthReadFetch(url);await Promise.all([a(user,{headers:{authorization:'Bearer A'}}),b(user,{headers:{authorization:'Bearer B'}})]);await a(user,{headers:{authorization:'Bearer A-refreshed'}});await a(user,{headers:{authorization:'Bearer A',apikey:'different-project'}});assert.equal(calls.length,4);assert.deepEqual(calls.map(row=>row.headers.get('authorization')),['Bearer A','Bearer B','Bearer A-refreshed','Bearer A']);}));
test('denials remain denials; refresh, other endpoints, missing authorization and explicit cancellation are never memoized',mock(async calls=>{const read=createRequestAuthReadFetch(url),denial={headers:{authorization:'denied'}};for(let i=0;i<2;i++)assert.equal((await read(user,denial)).status,401);for(let i=0;i<2;i++){await read(url+'/auth/v1/token',{method:'POST',headers:{authorization:'Bearer A'}});await read(user);await read(user,{headers:{authorization:'Bearer A'},signal:new AbortController().signal});}assert.equal(calls.length,7);}));

const token=[{alg:'HS256',typ:'JWT'},{sub:'00000000-0000-4000-8000-000000000001',session_id:'00000000-0000-4000-8000-000000000002',exp:4102444800},'DEMO-signature'].map((v,i)=>i===2?v:Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
test('installed SDK preserves exact provider denial after nonJSON parsing while temporary and success parse failures stay retryable',async()=>{
 const original=globalThis.fetch;
 try{for(const sample of[{status:401,body:'<html>DEMO denied</html>',expected:401},{status:403,body:'',expected:401},{status:429,body:'DEMO rate limit',expected:503},{status:503,body:'<html>DEMO unavailable</html>',expected:503},{status:500,body:'<html>DEMO failure</html>',expected:503},{status:200,body:'not json',expected:503},{status:401,body:JSON.stringify({msg:'DEMO invalid'}),expected:401},{status:200,body:JSON.stringify({id:'00000000-0000-4000-8000-000000000001',email_confirmed_at:'2026-10-17T00:00:00Z'}),expected:null}]){
  let calls=0;globalThis.fetch=async()=>{calls++;return new Response(sample.body,{status:sample.status,headers:{'x-demo-original':'retained'}});};
  const client=createClient(url,'DEMO-anon',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:createRequestAuthReadFetch(url)}});
  const results=await Promise.all([client.auth.getUser(token),client.auth.getClaims(token)]);
  assert.equal(authVerificationFailure(...results.map(result=>result.error)),sample.expected,JSON.stringify(sample));assert.equal(calls,1);
  if(sample.expected===null){assert.equal(results[0].data.user.id,results[1].data.claims.sub);assert.equal(typeof results[1].data.claims.session_id,'string');}
 }}finally{globalThis.fetch=original;}
});
test('trusted parse status is limited to the exact configured GET user verification response and effective authorization',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('DEMO HTML',{status:401,headers:{'x-demo-original':'retained'}});
 try{const read=createAuthVerificationFetch(url);for(const[input,init,expected]of[[user,{headers:{authorization:'Bearer DEMO'}},401],[new Request(user,{headers:{authorization:'Bearer DEMO'}}),{},401],[user,{headers:{authorization:'Bearer DEMO'},method:'POST'},503],[url+'/auth/v1/settings',{headers:{authorization:'Bearer DEMO'}},503],['https://other.invalid/auth/v1/user',{headers:{authorization:'Bearer DEMO'}},503],[user,{},503],[new Request(user,{headers:{authorization:'Bearer DEMO'}}),{headers:{}},503]]){
  const response=await read(input,init);assert.equal(response.status,401);assert.equal(response.headers.get('x-demo-original'),'retained');assert.equal(await response.clone().text(),'DEMO HTML');let error;try{await response.json();}catch(reason){error=reason;}assert(error);assert.equal(authVerificationFailure(error),expected);
 }}finally{globalThis.fetch=original;}
});
test('activity uses the same installed SDK classifier and does not touch session activity on any verification failure',async()=>{
 const original=globalThis.fetch;
 try{for(const sample of[{status:401,expected:401},{status:403,expected:401},{status:429,expected:503},{status:503,expected:503},{status:200,expected:503}]){
  globalThis.fetch=async()=>new Response('<html>DEMO provider response</html>',{status:sample.status});let transactions=0;
  class Failure extends Error{constructor(message,status=400){super(message);this.status=status;}}
  const route=sourceLoader(process.cwd(),{'next/server':{NextResponse:{json:(body,init)=>new Response(JSON.stringify(body),init)}},'@/lib/backend/database':{BackendError:Failure,withDatabase:async()=>{transactions++;throw Error('Denied verification must not write activity');}},'@/lib/backend/context':{},'@/lib/server/login-policy':{readAuthAccessToken:()=>token},'@/lib/supabase/config':{getSupabaseConfig:()=>({url,publishableKey:'DEMO-anon'})},'@/lib/supabase/server':{AuthRequestError:Failure,requireSameOrigin:()=>url,readAuthBody:async()=>({store:false}),preventAuthCaching:value=>value,authFailure:error=>new Response('{}',{status:error.status??503})}})('./app/api/auth/activity/route');
  const response=await route.POST({cookies:{getAll:()=>[]}});assert.equal(response.status,sample.expected);assert.equal(transactions,0);
 }}finally{globalThis.fetch=original;}
});

test('provider status branding cannot be forged by names or nested fields and does not carry into refreshed-token validation',async()=>{
 const cycle={name:'AuthUnknownError'};cycle.originalError=cycle;cycle.cause=cycle;
 for(const value of[new SyntaxError('DEMO bad JSON'),{name:'AuthProviderRejection'},{name:'AuthUnknownError',originalError:{name:'AuthProviderRejection',status:401}},{cause:{name:'AuthProviderRejection',status:403}},cycle])assert.equal(authVerificationFailure(value),503);
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(_input,init)=>{calls++;const fresh=new Headers(init.headers).get('authorization')==='Bearer DEMO-refreshed';return new Response(fresh?JSON.stringify({ok:true}):'DEMO HTML denied',{status:fresh?200:401});};
 try{const read=createRequestAuthReadFetch(url),denied=await read(user,{headers:{authorization:'Bearer DEMO-old'}});await assert.rejects(denied.json(),error=>authVerificationFailure(error)===401);const refreshed=await read(user,{headers:{authorization:'Bearer DEMO-refreshed'}});assert.deepEqual(await refreshed.json(),{ok:true});assert.equal(authVerificationFailure(null,null),null);assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
