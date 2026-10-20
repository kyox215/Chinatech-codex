import assert from'node:assert/strict';import{test}from'node:test';import{sourceLoader}from'./helpers/typescript-source.mjs';
const {observe,observeTime,withObservation,observeRoute,observedAuthFetch}=sourceLoader()('./lib/backend/request-observation');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('parallel request aggregates remain isolated and never contain caller data',async()=>{
 const[a,b]=await Promise.all([withObservation(async()=>{observe('auth_user',1);await sleep(8);observe('db_query',4,3);observe('secret SQL and identity',9);return'A';}),withObservation(async()=>{observe('auth_refresh',2);await sleep(1);observe('db_query',6,5);return'B';})]);
 assert.match(a.timing,/auth_user;dur=1.0;desc="1 calls"/);assert.match(a.timing,/db_query;dur=4.0;desc="3 calls"/);assert(!a.timing.includes('secret'));assert(!a.timing.includes('auth_refresh'));assert.match(b.timing,/db_query;dur=6.0;desc="5 calls"/);assert(!b.timing.includes('auth_user'));
});
test('failed operations retain elapsed time and counts; incoming diagnostics do not authorize a read',async()=>{
 const response=await observeRoute(new Request('http://localhost/api',{headers:{'x-ct-observe-proxy':'identity=owner;untrusted=true'}}),async()=>{await assert.rejects(observeTime('db_live',async()=>{await sleep(4);throw Error('denied');}));return new Response('denied',{status:401});});
 assert.equal(response.status,401);assert.match(response.headers.get('server-timing'),/db_live;dur=[1-9][\d.]*;desc="1 calls"/);assert(!response.headers.get('server-timing').includes('owner'));
});
test('actual fetch attempts are counted separately, including failure, without recording token or URL',async()=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=async(input,init)=>{calls++;assert.equal(init.cache,'no-store');if(calls===2)throw Error('network');return new Response('{}');};
 try{const value=await withObservation(async()=>{await observedAuthFetch('http://localhost/auth/v1/user',{headers:{authorization:'secret-token'}});await assert.rejects(observedAuthFetch('http://localhost/auth/v1/user'));await observedAuthFetch('http://localhost/auth/v1/token?grant_type=refresh_token');});assert.match(value.timing,/auth_user;dur=[\d.]+;desc="2 calls"/);assert.match(value.timing,/auth_refresh;dur=[\d.]+;desc="1 calls"/);assert(!value.timing.includes('secret'));assert.equal(calls,3);}finally{globalThis.fetch=previous;}
});
