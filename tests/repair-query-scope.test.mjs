import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import ts from 'typescript';
function harness(){
  let snapshot={scope:'/app/repairs?page_ready=2',storeId:'store',staff:{currentId:'member'}};
  const calls=[];const window={location:{href:'http://localhost/app/repairs'}};
  const js=ts.transpileModule(readFileSync(new URL('../components/backend-query.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
  const context=createContext({exports:{},window,require:path=>path==='@/lib/backend/client'?{backendSnapshot:()=>snapshot,requestBackendScope:scope=>{calls.push(scope);snapshot={...snapshot,scope};return Promise.resolve();}}:{}});
  runInContext(js,context);
  return {begin:context.exports.beginTemporaryPageScope,calls,window,set:value=>{snapshot={...snapshot,...value};},get:()=>snapshot};
}
test('临时批量scope关闭恢复原筛选分页；读取失败尚未发布也能恢复',()=>{
  for(const publish of [true,false]){const h=harness();const release=h.begin('/app/procurement-batch?action=ordered');if(publish)h.set({scope:'/app/procurement-batch?action=ordered'});release();assert.deepEqual(h.calls,['/app/repairs?page_ready=2']);release();assert.equal(h.calls.length,1);}
});
test('导航、身份变化和新的页面scope不被旧弹窗cleanup覆盖',()=>{
  for(const change of ['navigation','identity','page']){const h=harness();const release=h.begin('/app/procurement-batch?action=ordered');h.set({scope:'/app/procurement-batch?action=ordered'});if(change==='navigation')h.window.location.href='http://localhost/app/retail';else if(change==='identity')h.set({staff:{currentId:'new-member'}});else h.set({scope:'/app/repairs?q=new'});release();assert.equal(h.calls.length,0);}
});

test('供应商/页码切换后关闭仍恢复弹窗打开前的原列表scope',()=>{
  const h=harness();const origin=h.get();const first=h.begin('/app/procurement-batch?action=ordered',origin);h.set({scope:'/app/procurement-batch?action=ordered'});first();
  const second=h.begin('/app/procurement-batch?action=ordered&supplier=A&page=2',origin);h.set({scope:'/app/procurement-batch?action=ordered&supplier=A&page=2'});second();
  assert.equal(h.calls.at(-1),origin.scope);
});

test('选择本页累计跨页记录、保留原核对版本和到货量，超过100条整页拒绝',()=>{
  const js=ts.transpileModule(readFileSync(new URL('../components/procurement/supplier-batch-dialog.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
  const context=createContext({exports:{},require:()=>({})});runInContext(js,context);
  const merge=context.exports.mergeBatchPageSelection;
  const rows=Array.from({length:120},(_,i)=>({id:'PO-'+i,events:[{id:'cart'}]}));
  const first=merge({},rows.slice(0,50));first['PO-0'].quantity='2';
  const second=merge(first,rows.slice(50,100));assert.equal(Object.keys(second).length,100);assert.equal(second['PO-0'],first['PO-0']);
  const repeated=merge(second,[{...rows[0],events:[{id:'cart'},{id:'changed'}]}]);assert.equal(repeated['PO-0'].revision,1);assert.equal(repeated['PO-0'].quantity,'2');
  assert.throws(()=>merge(second,rows.slice(100)),/最多100条/);assert.equal(Object.keys(second).length,100);assert.equal(second['PO-100'],undefined);
});
