import assert from'node:assert/strict';
import{test}from'node:test';
import{readFileSync}from'node:fs';
import ts from'typescript';
import{sourceLoader}from'./helpers/typescript-source.mjs';
const file='components/account/login-devices.tsx',source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes={};
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='load'&&node.initializer&&ts.isCallExpression(node.initializer))nodes.load=node.initializer.arguments[0];if(ts.isFunctionDeclaration(node)&&node.name?.text==='revoke')nodes.revoke=node;ts.forEachChild(node,visit);}visit(source);assert(nodes.load&&nodes.revoke);
const decode=sourceLoader()('./lib/backend/read-response').readResponseObject;
function harness(kind,{status=200,body='{}',type='application/json',storeMode=false,late=false,refreshFails=false}={}){
 const initial={accountId:'DEMO-account',sessionId:'DEMO-session',actionableCount:1,devices:[{id:'DEMO-original'}],nextOffset:null},operation={requestId:'DEMO-original-request',scope:'one',sessionId:'DEMO-other',revision:1};
 const state={data:initial,loading:false,busy:false,error:'',message:'',confirmation:operation,key:'DEMO-view',clear:0,redirects:[],notified:0,loads:0,closed:0},loadedWindow={current:{key:'DEMO-view',data:initial}},retry={current:{operation,accountId:initial.accountId,sessionId:initial.sessionId}},abort={current:null},epoch={current:1},inFlight={current:false};
 const bindings={data:initial,confirmation:operation,loadedWindow,retry,abort,epoch,inFlight,viewKey:'DEMO-view',reading:{current:false},allowed:true,storeMode,selected:storeMode?'DEMO-member':'',endpoint:'/DEMO-memory-only',identityScope:{current:'DEMO-account:DEMO-session'},dialog:{current:{close:()=>{state.closed++;}}},router:{replace:path=>state.redirects.push(path),refresh:()=>{}},clearBackend:()=>{state.clear++;},notifyAuthChanged:()=>{state.notified++;},readResponseObject:decode,load:async()=>{state.loads++;if(refreshFails)throw Error('登录设备暂不可用，请稍后重试。');},fetch:async()=>{if(late){epoch.current++;abort.current?.abort();}return new Response(body,{status,headers:{'Content-Type':type}});}};
 for(const[field,key]of[['Data','data'],['DataKey','key'],['Loading','loading'],['Busy','busy'],['Error','error'],['Message','message'],['Confirmation','confirmation'],['Foreground','foreground']])bindings['set'+field]=value=>{state[key]=value;};
 const statement=kind==='load'?'const actual='+nodes.load.getText(source)+';return actual;':nodes.revoke.getText(source)+';return revoke;',compiled=ts.transpileModule(statement,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,run=new Function(...Object.keys(bindings),compiled)(...Object.values(bindings));
 return{run,state,initial,loadedWindow,retry,epoch};
}
test('account and staff device reads clear current non-JSON denial, preserve temporary data and reject malformed success',async()=>{
 for(const storeMode of[false,true])for(const status of[200,401,403,409,503]){
  const h=harness('load',{storeMode,status,type:'text/html',body:'<html>DEMO upstream error</html>'});await h.run(true,false);assert.equal(h.state.loading,false);
  if([401,403,409].includes(status)){assert.equal(h.state.data,null);assert.equal(h.loadedWindow.current,null);assert.equal(h.retry.current,null);assert.equal(h.state.confirmation,null);}else assert.equal(h.state.data,h.initial);
  if(status===401){assert.equal(h.state.clear,1);assert.deepEqual(h.state.redirects,['/login']);}else{assert.equal(h.state.clear,0);assert.match(h.state.error,/[\u3400-\u9fff]/u);assert(!h.state.error.includes('<html>'));}
 }
 const malformed=harness('load');await malformed.run();assert.equal(malformed.state.data,malformed.initial);assert.match(malformed.state.error,/登录设备暂不可用/);
 const stale=harness('load',{status:401,late:true});await stale.run();assert.equal(stale.state.clear,0);assert.equal(stale.state.data,stale.initial);
});
test('revocation unreadable success preserves the exact intent; only verified ok confirms, and late denial cannot clear another scope',async()=>{
 for(const storeMode of[false,true])for(const sample of[{status:200,body:'<html>DEMO</html>'},{status:200,body:'{}'},{status:503,body:'{DEMO malformed'}]){
  const h=harness('revoke',{storeMode,...sample});await h.run();assert.equal(h.retry.current.operation.requestId,'DEMO-original-request');assert.equal(h.state.confirmation.requestId,'DEMO-original-request');assert.equal(h.state.clear,0);assert.equal(h.state.notified,0);assert.equal(h.state.busy,false);assert.match(h.state.error,/[\u3400-\u9fff]/u);
  if(sample.status===200)assert.match(h.state.error,/结果尚未确认/);
 }
 const confirmed=harness('revoke',{body:'{"ok":true,"currentRevoked":false}',refreshFails:true});await confirmed.run();assert.equal(confirmed.retry.current,null);assert.equal(confirmed.state.confirmation,null);assert.equal(confirmed.state.notified,1);assert.equal(confirmed.state.loads,1);assert.match(confirmed.state.message,/已退出/);assert(!confirmed.state.error.includes('结果尚未确认'));
 for(const status of[401,403,409]){const h=harness('revoke',{status,body:'<html>DEMO denial</html>'});await h.run();assert.equal(h.state.data,null);assert.equal(h.loadedWindow.current,null);assert.equal(h.retry.current,null);assert.equal(h.state.clear,status===401?1:0);}
 const stale=harness('revoke',{status:401,late:true});await stale.run();assert.equal(stale.state.clear,0);assert.equal(stale.state.data,stale.initial);assert.equal(stale.retry.current.operation.requestId,'DEMO-original-request');
});
