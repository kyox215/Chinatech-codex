import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {setImmediate} from 'node:timers/promises';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../components/use-device-draft.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function harness(){let cursor=0, effects=[], cells=[],current={name:''},value;const saved=new Map(),pending=[],listeners=new Map();let delay=false;
 const store={draftScope:()=> 'store:member:permissions',listDeviceDrafts:async()=>[],saveDeviceDraft:async row=>{if(delay)await new Promise(resolve=>pending.push(resolve));saved.set(row.id,structuredClone(row));},removeDeviceDraft:async id=>{saved.delete(id);}};
 const react={useRef:v=>{const i=cursor++;cells[i]??={current:v};return cells[i];},useState:v=>{const i=cursor++;if(!(i in cells))cells[i]=typeof v==='function'?v():v;return[cells[i],next=>{cells[i]=typeof next==='function'?next(cells[i]):next;}];},useEffect:(fn,deps)=>{const i=cursor++;if(!deps||!cells[i]||deps.some((d,n)=>!Object.is(d,cells[i][n]))){cells[i]=deps;effects.push(fn);}}};
 const context=createContext({exports:{},crypto:{randomUUID:()=> 'draft-id'},structuredClone,queueMicrotask,window:{addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:()=>{}},require:name=>name==='react'?react:name==='react/jsx-runtime'?{}:name.includes('recovery-store')?store:name.includes('backend/react')?{useBackendState:()=>({}),useBackendMode:()=>true}:name.includes('backend/client')?{backendSnapshot:()=>({}),isBackendClient:()=>true}: {}});
 runInContext(compiled,context);
 function render(next=current,active=true){current=next;cursor=0;effects=[];value=context.exports.useDeviceDraft('form',next,()=>{},active);for(const f of effects)f();return value;}
 render();return{render,saved,pending,delay:()=>{delay=true;},flush:async()=>{delay=false;while(pending.length){pending.shift()();await setImmediate();}await setImmediate();},leaving:()=>{let prevented=false;listeners.get('beforeunload')({preventDefault:()=>prevented=true});return prevented;}};
}
test('慢写入期间 A→B→A，最终落盘必须是 A',async()=>{const h=harness();h.render({name:'A'});await h.flush();h.delay();h.render({name:'B'});await setImmediate();h.render({name:'A'});await h.flush();assert.equal(h.saved.get('draft-id').data.name,'A');assert.equal(h.leaving(),false);});
test('慢写入期间改回初始值，旧草稿删除且离开提示解除',async()=>{const h=harness();h.render({name:'A'});await h.flush();h.delay();h.render({name:'B'});await setImmediate();h.render({name:''});await h.flush();assert.equal(h.saved.size,0);assert.equal(h.leaving(),false);});
test('业务成功清理与随后新输入交错，清理不得删除新输入',async()=>{const h=harness();h.delay();const draft=h.render({name:'A'});await setImmediate();const clear=draft.clear();h.render({name:'C'});await h.flush();await clear;assert.equal(h.saved.get('draft-id').data.name,'C');assert.equal(h.leaving(),false);});
test('保存成功后改动再回到刚保存值，不恢复中间旧输入',async()=>{const h=harness();let draft=h.render({name:'A'});await h.flush();await draft.clear();h.delay();h.render({name:'B'});await setImmediate();h.render({name:'A'});await h.flush();assert.equal(h.saved.size,0);assert.equal(h.leaving(),false);});
