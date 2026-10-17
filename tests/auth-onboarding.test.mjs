import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
function harness(result) {
 const calls=[],exports={};
 runInContext(ts.transpileModule(readFileSync('lib/auth-request.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,createContext({exports,AbortSignal,fetch:async(...args)=>{calls.push(args);return result(...args);}}));
 return {...exports,calls};
}
test('auth submit preserves one exact request and a real bounded cancellation signal',async()=>{
 for(const action of ['register','login','resend']){
  const h=harness(async()=>new Response(JSON.stringify({ok:true,message:'Synthetic accepted'})));const body={email:'synthetic@example.test',password:'Synthetic-only-123'};
  assert.equal((await h.submitAuth(action,body)).message,'Synthetic accepted');assert.equal(h.calls.length,1);const[url,init]=h.calls[0];assert.equal(url,'/api/auth/'+action);assert.equal(init.method,'POST');assert.equal(init.cache,'no-store');assert.equal(init.body,JSON.stringify(body));assert.equal(init.headers['Content-Type'],'application/json');assert(init.signal instanceof AbortSignal);
 }
});
test('wrong password and rate limits are confirmed failures, unavailable results remain uncertain',async()=>{
 for(const status of [400,401,429,500,503]){
  const h=harness(async()=>new Response(JSON.stringify({message:'Synthetic rejected'}),{status}));await assert.rejects(h.submitAuth('login',{}),e=>e instanceof h.AuthSubmissionError&&e.status===status&&e.uncertain===(status>=500)&&e.message==='Synthetic rejected');assert.equal(h.calls.length,1);
 }
});
test('network loss, cancellation and undecodable results never automatically repeat an auth mutation',async()=>{
 for(const result of [async()=>{throw new TypeError('Synthetic offline')},async()=>{throw new DOMException('Synthetic timeout','TimeoutError')},async()=>new Response('not JSON'),async()=>new Response('null'),async()=>new Response('[]'),async()=>new Response('"unexpected"')]){
  const h=harness(result);await assert.rejects(h.submitAuth('register',{email:'synthetic@example.test'}),e=>e instanceof h.AuthSubmissionError&&e.uncertain);assert.equal(h.calls.length,1);
 }
});
