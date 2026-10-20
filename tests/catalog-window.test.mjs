import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceLoader } from './helpers/typescript-source.mjs';
const { mergeCatalogWindow } = sourceLoader()('./lib/catalog-window');
const page = (number, revision='1') => ({ page:number, pageSize:50, revision, total:3476, rows:Array.from({length:Math.min(50,3476-(number-1)*50)},(_,i)=>({id:'DEMO-'+((number-1)*50+i),notes:'DEMO full original '+('字'.repeat(1000)),version:1})) });
test('all 3476 rows retain exact total while only ten contiguous full-row batches stay cached', () => {
 let pages=[];
 for(let number=1;number<=70;number++) {const incoming=page(number);pages=mergeCatalogWindow(pages,incoming);assert(pages.length<=10);assert(pages.reduce((n,page)=>n+page.rows.length,0)<=500);assert.equal(pages.at(-1),incoming);assert.equal(pages.at(-1).rows[0],incoming.rows[0]);assert(pages.every((page,index)=>page.page===pages[0].page+index));}
 assert.deepEqual(pages.map(value=>value.page),[61,62,63,64,65,66,67,68,69,70]);assert.equal(pages.at(-1).rows.at(-1).id,'DEMO-3475');
});
test('reverse merges and explicit re-fetches of evicted windows remain bounded without dropping fields or duplicate IDs', () => {
 let pages=Array.from({length:10},(_,i)=>page(i+11));
 for(let number=10;number>=1;number--){const incoming=page(number);pages=mergeCatalogWindow(pages,incoming);assert.equal(pages[0],incoming);assert.equal(pages.flatMap(page=>page.rows).length,500);assert.equal(new Set(pages.flatMap(page=>page.rows.map(row=>row.id))).size,500);}
 const distant=page(50);assert.deepEqual(mergeCatalogWindow(pages,distant),[distant]);
});
test('changed versions/counts reset the window, and malformed successful page metadata is rejected', () => {
 const current=[page(1)],changed=page(2,'2');assert.deepEqual(mergeCatalogWindow(current,changed),[changed]);
 const count={...page(2),total:3477};assert.deepEqual(mergeCatalogWindow(current,count),[count]);
 for(const value of[{...page(1),page:0},{...page(1),pageSize:500},{...page(1),total:-1},{...page(1),rows:[{id:'DEMO'},{id:'DEMO'}]},{...page(1),rows:Array.from({length:51},(_,i)=>({id:String(i)}))}])assert.throws(()=>mergeCatalogWindow([],value));
});
