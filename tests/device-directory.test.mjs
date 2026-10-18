import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {directory as d,client as c,storage as s,catalog,makePackage} from './helpers/directory-modules.mjs';
const model={id:'phone-fixture-1',category:'phone',brand:'Apple',family:'iPhone',name:'iPhone fixture',releasedAt:null,year:null,network:'5G',platform:'iOS',modelCodes:['A0001'],aliases:['fixture'],status:'verified'};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function harness(pack,{stored=null,timeoutMs=1000}={}){let time=1000000,current=pack;const calls=[],saved=[];let handler;
 const client=c.createDeviceDirectoryClient({now:()=>time,timeoutMs,store:{load:async()=>stored,save:async value=>{saved.push(value);}},fetch:async(url,init)=>{calls.push({url,init});if(handler)return handler(url,init);return new Response(url.endsWith('/manifest')?current.manifest:url.endsWith('/package')?JSON.stringify({manifest:current.manifest,shards:current.shards}):current.shards[url.split('/').at(-1)],{status:200});}});
 return {client,calls,saved,setPack:value=>current=value,handler:value=>handler=value,advance:()=>time+=d.directoryTTL+1};}
const q={category:'phone'};
test('all 3476 packaged whitelist models parse and full categories exceed the former 3000 cap',async()=>{
 const rows=JSON.parse(readFileSync('data/device-catalog/catalog.json','utf8')).filter(r=>r.enabled).map(catalog.catalogPickerModel),pack=await makePackage(rows);
 const result=await d.validateDirectoryPackage(pack);assert.equal(result.models.length,3476);assert.equal(result.manifest.shards.length,56);
 const h=harness(pack);await h.client.ensure();assert.equal(h.client.read({category:''}).data.models.length,3476);assert.equal(h.calls.length,2);assert.ok(result.bytes<1024*1024);
 for(const call of h.calls){assert.equal(call.init.credentials,'omit');assert.equal(call.init.headers,undefined);}
});
test('strict schema/hash/count reject private fields, corrupt shards, wrong brands and manifest categories',async()=>{
 const pack=await makePackage([model]);const descriptor=JSON.parse(pack.manifest).shards[0];
 for(const patch of [{supplier:'secret'},{brand:'Other'},{id:'../bad'},{aliases:[1]}])assert.throws(()=>d.parseDirectoryShard(JSON.stringify({formatVersion:1,category:'phone',brand:'Apple',models:[{...model,...patch}]}),descriptor));
 await assert.rejects(d.validateDirectoryPackage({...pack,shards:{...pack.shards,[descriptor.key]:pack.shards[descriptor.key]+' '}}));
 const manifest=JSON.parse(pack.manifest);manifest.shards[0].category='tablet';assert.throws(()=>d.parseDirectoryManifest(JSON.stringify(manifest)));
});
test('cold storage waiting is real loading and retained complete versions are immediately selectable without network',async()=>{
 const pack=await makePackage([model],'1',1000000),pending=deferred();
 const client=c.createDeviceDirectoryClient({fetch:()=>assert.fail('fresh cache must not fetch'),store:{load:()=>pending.promise,save:async()=>{}},now:()=>1000000});
 const loading=client.ensure();assert.equal(client.read(q).loading,true);pending.resolve(pack);await loading;assert.equal(client.read(q).ready,true);assert.equal(client.read(q).data.models[0].id,model.id);
});
test('cold fetch and stalled body deadlines finish even when abort is ignored; late results never commit',async()=>{
 for(const body of [false,true]){
  const pack=await makePackage([model]),wait=deferred(),h=harness(pack,{timeoutMs:20});h.handler(()=>body?{ok:true,headers:new Headers(),text:()=>wait.promise}:wait.promise);
  await h.client.ensure();assert.equal(h.client.read(q).loading,false);assert.equal(h.client.read(q).error,d.directoryTimeout);
  wait.resolve(body?pack.manifest:new Response(pack.manifest));await sleep(10);assert.equal(h.client.read(q).ready,false);
 }
});
test('background errors retain options, suppress loading, coalesce events and throttle failed checks for five minutes',async()=>{
 const pack=await makePackage([model]),h=harness(pack);await h.client.ensure();h.advance();let resolve;const pending=new Promise(r=>resolve=r);h.handler(()=>pending);
 const a=h.client.ensure(),b=h.client.ensure();assert.equal(a,b);assert.equal(h.client.read(q).loading,false);resolve(new Response('',{status:503}));await a;assert.equal(h.client.read(q).ready,true);assert.equal(h.client.read(q).data.models.length,1);
 const count=h.calls.length;await h.client.ensure();await h.client.ensure();assert.equal(h.calls.length,count);await h.client.ensure(true);assert.equal(h.calls.at(-1).init.cache,'reload');
});
test('version switching is atomic, reuses hashes and caps incremental concurrency at three',async()=>{
 const initial=await makePackage([model]),h=harness(initial);await h.client.ensure();
 const rows=[model,...Array.from({length:8},(_,i)=>({...model,id:'other-'+i,brand:'Brand '+i,name:'New '+i}))];const next=await makePackage(rows,'2');h.setPack(next);let inflight=0,max=0;
 h.handler(async url=>{if(url.endsWith('/manifest'))return new Response(next.manifest);inflight++;max=Math.max(max,inflight);assert.equal(h.client.read(q).data.models.length,1);await sleep(5);inflight--;return new Response(next.shards[url.split('/').at(-1)]);});
 h.advance();await h.client.ensure();assert.equal(max,3);assert.equal(h.client.read(q).data.models.length,9);assert.equal(h.calls.filter(r=>r.url.endsWith('/package')).length,1);assert.equal(h.calls.length,11);
});
test('older manifests cannot roll memory back and same revision conflicts retain the complete version',async()=>{
 const one=await makePackage([model],'1'),two=await makePackage([{...model,name:'new'}],'2'),conflict=await makePackage([{...model,name:'collision'}],'2');const h=harness(two);await h.client.ensure();
 h.setPack(one);await h.client.ensure(true);assert.equal(h.client.read(q).data.models[0].name,'new');h.setPack(conflict);await h.client.ensure(true);assert.equal(h.client.read(q).error,d.directoryFailure);assert.equal(h.client.read(q).data.models[0].name,'new');
});
test('force while a normal check runs queues at most one forced recheck',async()=>{
 const pack=await makePackage([model]),h=harness(pack);await h.client.ensure();h.advance();const gate=deferred();let n=0;h.handler(()=>++n===1?gate.promise:Promise.resolve(new Response(pack.manifest)));
 const run=h.client.ensure();for(let i=0;i<5;i++)h.client.ensure(true);gate.resolve(new Response(pack.manifest));await run;await sleep(5);assert.equal(n,2);assert.equal(h.calls.at(-1).init.cache,'reload');
});
test('failed/corrupt package never partially replaces old directory and explicit retry recovers',async()=>{
 const one=await makePackage([model]),two=await makePackage([{...model,name:'new'}],'2'),h=harness(one);await h.client.ensure();h.setPack(two);h.handler(url=>Promise.resolve(new Response(url.endsWith('/manifest')?two.manifest:'{}')));await h.client.ensure(true);assert.equal(h.client.read(q).data.models[0].name,model.name);h.handler(null);await h.client.ensure(true);assert.equal(h.client.read(q).data.models[0].name,'new');
});
// A minimal controllable IDB transaction implementation exercises timing and atomic
// conditional writes; browser tests additionally use the engine's native IndexedDB.
function fakeIDB(){let value=null,hang=false,active=0,max=0,aborts=0;return {get value(){return value;},set hang(v){hang=v;},get stats(){return {max,aborts};},open(){const req={};queueMicrotask(()=>{req.result={close(){},transaction(){active++;max=Math.max(max,active);const tx={objectStore(){return {get(){const op={};setTimeout(()=>{op.result=value;op.onsuccess?.();if(!hang&&!tx.aborted)setTimeout(()=>{if(tx.aborted)return;if(tx.next)value=tx.next;active--;tx.oncomplete?.();},1);},1);return op;},put(next){tx.next=next;}};},abort(){if(tx.aborted)return;tx.aborted=true;active--;aborts++;tx.onabort?.();}};return tx;}};req.onsuccess?.();});return req;}};}
test('IDB timeout aborts active write before serial next write; cross-tab old revisions cannot overwrite newer',async()=>{
 const one=await makePackage([model],'1',10),two=await makePackage([{...model,name:'new'}],'2',20),factory=fakeIDB();const store=s.createDeviceDirectoryStorage(()=>factory,20);
 factory.hang=true;const old=store.save(one);await sleep(5);const later=store.save(two);await old;factory.hang=false;await later;assert.equal(factory.stats.aborts,1);assert.equal(factory.stats.max,1);assert.equal(factory.value.manifest,two.manifest);
 const other=s.createDeviceDirectoryStorage(()=>factory,20);await other.save(one);assert.equal(factory.value.manifest,two.manifest);
});
test('storage unavailable degrades to memory without failing a complete directory',async()=>{const store=s.createDeviceDirectoryStorage(()=>undefined,5);assert.equal(await store.load(),null);await store.save(await makePackage([model]));});

test('cancelling before the work microtask starts performs no storage or network IO',async()=>{
 const calls=[];const client=c.createDeviceDirectoryClient({store:{load:async()=>{calls.push('load');return null;},save:async()=>{}},fetch:async()=>{calls.push('fetch');throw Error();}});
 const run=client.ensure();assert.equal(client.isFetching(),true);client.cancel();await run;
 assert.deepEqual(calls,[]);assert.equal(client.isFetching(),false);assert.deepEqual(client.read(q),{data:null,loading:false,error:'',ready:false});
});
test('cancel settles an ignored-abort manifest and drops queued force; old finally cannot clear a new flight',async()=>{
 const pack=await makePackage([model]),h=harness(pack),old=deferred(),fresh=deferred();let manifests=0;
 h.handler(url=>url.endsWith('/manifest')?(++manifests===1?old.promise:fresh.promise):Promise.resolve(new Response(JSON.stringify({manifest:pack.manifest,shards:pack.shards}))));
 const first=h.client.ensure();await sleep(1);h.client.ensure(true);h.client.cancel();assert.equal(h.calls[0].init.signal.aborted,true);
 const next=h.client.ensure();await first;assert.equal(h.client.isFetching(),true);assert.equal(h.client.read(q).loading,true);
 old.resolve(new Response(pack.manifest));await sleep(1);assert.equal(h.client.isFetching(),true);assert.equal(h.client.read(q).ready,false);assert.equal(h.calls.length,2);
 fresh.resolve(new Response(pack.manifest));await next;assert.equal(h.client.read(q).data.models[0].name,model.name);assert.equal(h.calls.length,3);assert.equal(manifests,2);assert.equal(h.client.read(q).error,'');
});
test('cancel during stalled body prevents package fetch and can retry immediately without five-minute suppression',async()=>{
 const pack=await makePackage([model]),h=harness(pack),body=deferred();h.handler(()=>Promise.resolve({ok:true,headers:new Headers(),text:()=>body.promise}));
 const first=h.client.ensure();await sleep(1);h.client.cancel();await first;assert.equal(h.client.read(q).error,'');
 body.resolve(pack.manifest);await sleep(1);assert.equal(h.calls.length,1);assert.equal(h.client.read(q).ready,false);
 h.handler(null);await h.client.ensure();assert.equal(h.client.read(q).ready,true);assert.equal(h.calls.length,3);
});
test('cancelled storage restore cannot adopt late data or suppress a new generation',async()=>{
 const oldPack=await makePackage([{...model,name:'late old storage'}],'9',1000000),freshPack=await makePackage([model]),stored=deferred();let loads=0;
 const client=c.createDeviceDirectoryClient({now:()=>1000000,store:{load:()=>++loads===1?stored.promise:Promise.resolve(null),save:async()=>{}},fetch:async url=>new Response(url.endsWith('/manifest')?freshPack.manifest:JSON.stringify({manifest:freshPack.manifest,shards:freshPack.shards}))});
 const first=client.ensure();await sleep(1);client.cancel();await first;await client.ensure();stored.resolve(oldPack);await sleep(1);
 assert.equal(loads,2);assert.equal(client.read(q).data.models[0].name,model.name);assert.equal(client.read(q).error,'');
});
test('background cancellation preserves the complete selectable version and restores stale-check eligibility',async()=>{
 const pack=await makePackage([model]),h=harness(pack);await h.client.ensure();const saved=h.saved.length;h.advance();const pending=deferred();h.handler(()=>pending.promise);
 const run=h.client.ensure();await sleep(1);assert.equal(h.client.isFetching(),true);assert.equal(h.client.read(q).loading,false);h.client.cancel();await run;
 assert.equal(h.client.read(q).ready,true);assert.equal(h.client.read(q).data.models[0].name,model.name);assert.equal(h.client.read(q).error,'');assert.equal(h.saved.length,saved);
 h.handler(null);await h.client.ensure();assert.equal(h.client.isFetching(),false);assert.equal(h.calls.length,4);pending.resolve(new Response(pack.manifest));await sleep(1);assert.equal(h.calls.length,4);
});
test('same-version verification and background cancellation preserve stable snapshots and index references',async()=>{
 const pack=await makePackage([model]),h=harness(pack);await h.client.ensure();const prior=h.client.read(q);
 await h.client.ensure(true);assert.equal(h.client.read(q),prior);assert.equal(h.client.read(q).data,prior.data);
 const gate=deferred();h.handler(()=>gate.promise);const run=h.client.ensure(true);await sleep(1);assert.equal(h.client.read(q),prior);h.client.cancel();await run;
 assert.equal(h.client.read(q),prior);assert.equal(h.client.read(q).data,prior.data);
 h.handler(()=>Promise.resolve(new Response('',{status:503})));await h.client.ensure(true);assert.equal(h.client.read(q).data,prior.data);assert.ok(h.client.read(q).error);
 gate.resolve(new Response(pack.manifest));await sleep(1);assert.equal(h.client.read(q).data,prior.data);
});
test('cold failure followed by forced retry cancellation does not retain the failed-attempt TTL lock',async()=>{
 const pack=await makePackage([model]),h=harness(pack);h.handler(()=>Promise.resolve(new Response('',{status:503})));await h.client.ensure();assert.ok(h.client.read(q).error);
 const pending=deferred();h.handler(()=>pending.promise);const retry=h.client.ensure(true);await sleep(1);h.client.cancel();await retry;assert.equal(h.client.read(q).error,'');assert.equal(h.client.read(q).ready,false);
 h.handler(null);await h.client.ensure();assert.equal(h.client.read(q).ready,true);assert.equal(h.calls.length,4);pending.resolve(new Response(pack.manifest));await sleep(1);assert.equal(h.calls.length,4);
});
