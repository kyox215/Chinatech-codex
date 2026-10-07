import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function policy() { const exports={};let now=Date.now();class Clock extends Date {static now(){return now;}}
const context=createContext({exports,require,Buffer,Date:Clock,process:{env:{NODE_ENV:'production',APP_DATABASE_URL:'synthetic-login-policy-secret'}}});runInContext(ts.transpileModule(readFileSync('lib/server/login-policy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);return {...exports,now:()=>now,advance:ms=>now+=ms};}
test('temporary cookies remove all persistence, including when policy is absent or tampered',()=>{const p=policy();const temporary=p.signLoginValue({sessionId:'s',remember:false,expires:Math.floor(p.now()/1000)+600});for(const marker of [temporary,undefined,temporary+'broken']){const result=p.sessionCookieOptions('ct_rebuild_auth',{maxAge:99999,expires:new Date()},marker);assert.equal(result.maxAge,undefined);assert.equal(result.expires,undefined);}});
test('refresh keeps the idle deadline unchanged; persistent cookie retention is separate from authorization',()=>{const p=policy();const marker=p.signLoginValue({sessionId:'s',remember:true,expires:Math.floor(p.now()/1000)+600});const a=p.sessionCookieOptions('ct_rebuild_auth.0',{maxAge:99999},marker);assert.equal(a.maxAge,p.COOKIE_RETENTION_SECONDS);p.advance(200000);assert.equal(p.sessionCookieOptions('ct_rebuild_auth.1',{},marker).maxAge,p.COOKIE_RETENTION_SECONDS);p.advance(400000);assert.equal(p.sessionCookieOptions('ct_rebuild_auth',{},marker).maxAge,p.COOKIE_RETENTION_SECONDS);assert.equal(p.readLoginPolicy(marker).expires,Math.floor(p.now()/1000));});
test('cookie policy cannot be replayed onto a different session; unordered chunks are bound correctly',()=>{const p=policy();const marker=p.signLoginValue({sessionId:'one',remember:true,expires:Math.floor(p.now()/1000)+600});const encoded=id=>'base64-'+Buffer.from(JSON.stringify({access_token:'e.'+Buffer.from(JSON.stringify({session_id:id})).toString('base64url')+'.s'})).toString('base64url');const cookies=id=>[{name:'ct_login_policy',value:marker},{name:'ct_rebuild_auth',value:encoded(id)}];assert.equal(p.matchingLoginPolicy(cookies('one')),marker);assert.equal(p.matchingLoginPolicy(cookies('two')),undefined);const session=encoded('one'),cut=Math.floor(session.length/2);assert.equal(p.matchingLoginPolicy([{name:'ct_login_policy',value:marker},{name:'ct_rebuild_auth.1',value:session.slice(cut)},{name:'ct_rebuild_auth.0',value:session.slice(0,cut)}]),marker);});
test('deletion and PKCE verifier expiration remain intact',()=>{const p=policy();assert.equal(p.sessionCookieOptions('ct_rebuild_auth',{maxAge:0}).maxAge,0);assert.equal(p.sessionCookieOptions('ct_rebuild_auth-code-verifier',{maxAge:600}).maxAge,600);});
test('route refresh persists every chunk after whole-cookie to chunked-cookie transition',async()=>{
 const p=policy(),{NextRequest,NextResponse}=require('next/server');let configured;
 const exports={};const context=createContext({exports,Buffer,URL,process:{env:{NODE_ENV:'production'}},fetch:()=>{},require:name=>{
 if(name==='@/lib/server/login-policy')return p;
 if(name==='./config')return {getSupabaseConfig:()=>({url:'https://synthetic.example.test',publishableKey:'sb_publishable_synthetic'})};
 if(name==='@supabase/ssr')return {createServerClient:(_u,_k,options)=>{configured=options;return {};}};
 if(name==='next/headers')return {};
 return require(name);
 }});runInContext(ts.transpileModule(readFileSync('lib/supabase/server.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 const marker=p.signLoginValue({sessionId:'chunk-session',remember:true,expires:Math.floor(p.now()/1000)+600});
 const encoded='base64-'+Buffer.from(JSON.stringify({access_token:'e.'+Buffer.from(JSON.stringify({session_id:'chunk-session'})).toString('base64url')+'.s'})).toString('base64url');
 const request=new NextRequest('https://synthetic.example.test/api/auth/account',{headers:{cookie:'ct_login_policy='+marker+'; ct_rebuild_auth='+encoded}});const response=NextResponse.json({});exports.createSupabaseRouteClient(request,response);
 const cut=Math.floor(encoded.length/2);
 configured.cookies.setAll([{name:'ct_rebuild_auth',value:'',options:{maxAge:0}},{name:'ct_rebuild_auth.0',value:encoded.slice(0,cut),options:{maxAge:99999}},{name:'ct_rebuild_auth.1',value:encoded.slice(cut),options:{maxAge:99999}}],{});
 assert.equal(response.cookies.get('ct_rebuild_auth').maxAge,0);
 assert.equal(response.cookies.get('ct_rebuild_auth.0').maxAge,p.COOKIE_RETENTION_SECONDS);assert.equal(response.cookies.get('ct_rebuild_auth.1').maxAge,p.COOKIE_RETENTION_SECONDS);assert.equal(response.cookies.get('ct_rebuild_auth.0').httpOnly,true);
});
