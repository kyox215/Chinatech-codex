import assert from 'node:assert/strict';
import test from 'node:test';
import {sourceLoader} from './helpers/typescript-source.mjs';
const load=sourceLoader(),{acceptRepairWindow,emptyRepairWindowCache,mergeRepairWindows,repairGroupWindow}=load('./lib/backend/repair-list-window'),{safeRepairListLocation,repairListLocation}=load('./lib/repair-list-location'),{repairListQuery}=load('./lib/backend/repair-list-contract');
function page(group,start=0,size=50,token='a'){return{stateToken:token,generation:token==='new'?'2':'1',observedRevision:token==='new'?'2':'1',group,startIndex:start,items:Array.from({length:size},(_,n)=>({id:group+'-'+(start+n)})),groups:['processing','ready','purchase','rework'].map(key=>({key,visibleCount:1200,count:1200}))};}
test('all repair groups share exactly ten bounded batches and500 summaries; a focused page consumes a slot',()=>{
 let cache=emptyRepairWindowCache(),last;
 for(let i=0;i<15;i++){last=page(i%2?'ready':'processing',Math.floor(i/2)*50);cache=acceptRepairWindow(cache,last,'processing-0');assert(cache.pages.length<=10);assert(cache.pages.reduce((sum,page)=>sum+page.items.length,0)<=500);}
 assert(cache.pages.some(page=>page.items.some(row=>row.id==='processing-0')));
 const current=repairGroupWindow(cache,last,'processing');assert(current.items.length<=450);assert(current.items.some(row=>row.id==='processing-399'));
 assert.equal(cache.pages.reduce((sum,page)=>sum+page.items.length,0),500);
});
test('smaller multilingual byte-budget batches still consume one batch; older gaps requery rather than fabricate rows',()=>{
 let cache=emptyRepairWindowCache();for(let i=0;i<14;i++)cache=acceptRepairWindow(cache,page('processing',i*22,22));
 assert.equal(cache.pages.length,10);assert.equal(cache.pages.reduce((sum,page)=>sum+page.items.length,0),220);
 let window=repairGroupWindow(cache,page('processing'),'processing');assert.equal(window.startIndex,88);assert.equal(window.items[0].id,'processing-88');assert.equal(window.items.at(-1).id,'processing-307');
 cache=acceptRepairWindow(cache,page('processing',0,22));window=repairGroupWindow(cache,page('processing'),'processing');assert.equal(window.startIndex,0);assert.equal(window.items.length,22);assert.equal(window.nextCursor!==null,true);
});
test('new generations discard old summaries, retain numeric placeholder extents, and reauthorize only actual returned windows',()=>{
 let cache=acceptRepairWindow(emptyRepairWindowCache(),page('processing',700));
 cache=acceptRepairWindow(cache,page('ready',0,50,'new'));assert(cache.pages.every(page=>page.group==='ready'));assert.equal(cache.extents.processing,750);
 const empty=repairGroupWindow(cache,page('ready',0,50,'new'),'processing');assert.deepEqual(empty.items,[]);assert.equal(empty.startIndex,750);
});
test('late cross-group generations and older same-generation configuration never evict a newer shared cache',()=>{
 const first={...page('ready'),generation:'9007199254740994',observedRevision:'9007199254740994',stateToken:'newer'};let cache=acceptRepairWindow(emptyRepairWindowCache(),first);
 assert.strictEqual(acceptRepairWindow(cache,{...page('processing'),generation:'9007199254740993',observedRevision:'9007199254740993',stateToken:'old'}),cache);
 assert.strictEqual(acceptRepairWindow(cache,{...page('processing'),generation:first.generation,observedRevision:'9007199254740993',stateToken:'old-config'}),cache);
 assert.strictEqual(acceptRepairWindow(cache,{...page('processing'),generation:first.generation,observedRevision:first.observedRevision,stateToken:'unorderable-config'}),cache);
 cache=acceptRepairWindow(cache,{...page('processing'),generation:first.generation,observedRevision:'9007199254740995',stateToken:'new-config'});assert.equal(cache.token,'new-config');assert.equal(cache.pages[0].group,'processing');
});
test('a refresh merges newer same-token group reads and respects the shared budget and current focus',()=>{
 let built=acceptRepairWindow(emptyRepairWindowCache(),page('processing',0,50,'new'));built=acceptRepairWindow(built,page('ready',0,50,'new'));
 const latest=acceptRepairWindow(emptyRepairWindowCache(),page('ready',500,50,'new')),merged=mergeRepairWindows(built,latest,'ready-525');assert.equal(merged.pages.length,3);assert.equal(merged.heads.ready,500);assert(merged.pages.some(page=>page.items.some(row=>row.id==='processing-0')));assert(merged.pages.some(page=>page.items.some(row=>row.id==='ready-525')));
 for(let i=0;i<12;i++)built=acceptRepairWindow(built,page('processing',i*50,50,'new'));const capped=mergeRepairWindows(built,merged,'ready-525');assert.equal(capped.pages.length,10);assert.equal(capped.pages.reduce((sum,page)=>sum+page.items.length,0),500);assert(capped.pages.some(page=>page.items.some(row=>row.id==='ready-525')));
});
test('repair return URLs preserve raw legal Unicode and only permit this same list, known conditions, IDs and bounded pixels',()=>{
 const query=repairListQuery({q:'İ'.repeat(100)}),safe=safeRepairListLocation(repairListLocation(query,'processing','LOCAL-ABC',123));
 assert(safe.includes('anchor=LOCAL-ABC'));assert(safe.includes('offset=123'));assert.equal(new URL(safe,'https://local.invalid').searchParams.get('q'),query.q);
 for(const raw of ['https://evil.invalid/app/repairs','/app/customers','/app/repairs?admin=1','/app/repairs?group=evil','/app/repairs?q='+('A'.repeat(161))])assert.equal(safeRepairListLocation(raw),'/app/repairs');
});
