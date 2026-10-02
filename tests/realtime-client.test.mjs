import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createContext,runInContext} from 'node:vm';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../lib/backend/realtime-client.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(){
  const sources=[],timers=new Map();let seq=0,reads=0;
  class FakeSource{constructor(url){this.url=url;this.events={};this.closed=false;sources.push(this);}addEventListener(name,fn){this.events[name]=fn;}close(){this.closed=true;}emit(name){this.events[name]?.();}}
  const document={visibilityState:'visible'},navigator={onLine:true};
  const context=createContext({exports:{},EventSource:FakeSource,document,navigator,Event,
    setTimeout:(fn,delay)=>{timers.set(++seq,{fn,delay});return seq;},clearTimeout:id=>timers.delete(id),Math});
  runInContext(compiled,context);const updates=context.exports.startRealtimeUpdates(()=>reads++);
  const flush=(max=Infinity)=>{const pending=[...timers].filter(([,x])=>x.delay<=max);for(const [id,{fn}] of pending){timers.delete(id);fn();}};
  return{sources,timers,document,navigator,updates,flush,reads:()=>reads};
}
test('连接成功补查，重复通知合并为一次授权读取',()=>{const h=harness();assert.equal(h.sources[0].url,'/api/backend/events');h.sources[0].emit('ready');for(let i=0;i<30;i++)h.sources[0].emit('invalidate');assert.equal(h.updates.isConnected(),true);h.flush(80);assert.equal(h.reads(),1);h.updates.stop();});
test('断开后退避重连，旧连接迟到消息不能刷新新范围',()=>{const h=harness(),old=h.sources[0];old.emit('ready');h.flush(80);old.onerror();assert(old.closed);assert.equal(h.updates.isConnected(),false);assert.equal(h.timers.size,1);h.flush();assert.equal(h.sources.length,2);old.emit('invalidate');h.flush(80);assert.equal(h.reads(),1);h.sources[1].emit('ready');h.flush(80);assert.equal(h.reads(),2);h.updates.stop();});
test('隐藏或离线关闭流，恢复重新订阅并补查',()=>{const h=harness();h.sources[0].emit('ready');h.document.visibilityState='hidden';h.updates.reconcile();h.flush();assert.equal(h.reads(),0);assert(h.sources[0].closed);h.document.visibilityState='visible';h.navigator.onLine=false;h.updates.reconcile();assert.equal(h.sources.length,1);h.navigator.onLine=true;h.updates.reconcile();assert.equal(h.sources.length,2);h.sources[1].emit('ready');h.flush(80);assert.equal(h.reads(),1);h.updates.stop();});
test('权限变更提示触发重新授权并关闭旧流',()=>{const h=harness();h.sources[0].emit('ready');h.flush(80);h.sources[0].emit('access-changed');assert(h.sources[0].closed);h.flush(80);assert.equal(h.reads(),2);h.updates.stop();h.flush();assert.equal(h.sources.length,1);});
test('身份卸载取消待执行通知及重连',()=>{const h=harness();h.sources[0].emit('ready');h.sources[0].onerror();h.updates.stop();h.sources[0].emit('invalidate');h.flush();assert.equal(h.reads(),0);assert.equal(h.timers.size,0);assert.equal(h.sources.length,1);});
