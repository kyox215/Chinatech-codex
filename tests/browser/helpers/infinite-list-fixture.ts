import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import ts from "typescript";
import type { Page } from "@playwright/test";

// Only platform/identity and HTTP are synthetic. React, list window/footer,
// device-session panel, catalog reader and activity feedback execute actual source.
const adapter = String.raw`
import {useSyncExternalStore} from 'react';
const listeners=new Set();let generation=1;
let member={id:'DEMO-OWNER',revision:1,role:'owner',accountStatus:'active',membershipStatus:'active',permissions:[]};
let data={currentId:member.id,members:[member,{...member,id:'DEMO-STAFF',name:'DEMO staff'}]};
let snapshot={storeId:'DEMO-STORE',staff:data};let staff={member,data,ready:true,error:'',can:()=>true};
const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
const api=window.infiniteFixture={calls:[],releases:[],failOffset:null,holdOffset:null,failStatus:503,ready:false};
api.setIdentity=()=>{generation++;member={...member,revision:member.revision+1};data={...data,members:[member,data.members[1]]};snapshot={...snapshot,staff:data};staff={...staff,member,data};listeners.forEach(fn=>fn());};
export const useStaff=()=>useSyncExternalStore(subscribe,()=>staff,()=>staff);
export const useBackendState=()=>{const current=useSyncExternalStore(subscribe,()=>snapshot,()=>snapshot);return{snapshot:current,formal:true,active:true};};
export const useBackendMode=()=>true;
export const backendSnapshot=()=>snapshot;export const backendReadGeneration=()=>generation;
export const isBackendClient=()=>true;export const readStaffSnapshot=()=>staff;export const subscribeStaff=subscribe;
export const clearBackend=()=>{api.cleared=true;};
const router={replace:value=>api.navigation=value,refresh:()=>{}};export const useRouter=()=>router;
api.fetch=async(url,options={})=>{
 const parsed=new URL(url,'https://fixture.invalid');const offset=Number(parsed.searchParams.get('offset')||0);const selected=parsed.searchParams.get('memberId')||'self';
 if(parsed.pathname.includes('/revoke'))throw Error('Writes forbidden in list acceptance');
 api.calls.push({offset,selected});
 if(api.holdOffset===offset)await new Promise(resolve=>api.releases.push(resolve));
 if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
 if(api.failOffset===offset){api.failOffset=null;return new Response(JSON.stringify({message:'登录设备暂不可用，请稍后重试。'}),{status:api.failStatus,headers:{'Content-Type':'application/json'}});}
 return new Response(JSON.stringify({accountId:'DEMO-ACCOUNT-'+generation,sessionId:'DEMO-SESSION-'+generation,actionableCount:65,nextOffset:offset+20<65?offset+20:null,devices:Array.from({length:Math.min(20,65-offset)},(_,i)=>({id:selected+'-'+(offset+i),browser:'DEMO Browser '+(offset+i),os:'DEMO OS',createdAt:'2026-10-17T10:00:00Z',lastActiveAt:'2026-10-17T10:00:00Z',remember:false,current:offset+i===0,revoked:false,revision:1}))}),{headers:{'Content-Type':'application/json'}});
};
`;
const entry = String.raw`
import React,{StrictMode,useEffect,useState} from 'react';import{createRoot}from'react-dom/client';
import{ListPagination,useListWindow}from'@/components/list-pagination';
import{LanguageProvider,useLanguage}from'@/components/language-provider';
import{LoginDevicesPanel}from'@/components/account/login-devices';
import{ContentProgress,OperationFeedbackProvider}from'@/components/operation-feedback';
import'virtual:adapter';
const api=window.infiniteFixture;window.fetch=api.fetch;let root;
function Locale({locale,children}){const{setLocale}=useLanguage();useEffect(()=>setLocale(locale),[locale,setLocale]);return children;}
function List({name,short}){const window=useListWindow(175,'');return<section aria-label={name}><h2>{name}</h2><div data-rows={name}>{Array.from({length:window.limit},(_,i)=><div key={i} style={{height:short?'0px':'44px',overflow:short?'hidden':undefined}}>DEMO row {i+1}</div>)}</div><ListPagination shown={window.limit} total={175} hasMore={window.limit<175} onLoadMore={window.loadMore} resetKey={window.resetKey} label={name+' footer'}/></section>;}
function Cases({kind}){return kind==='sessions'?<LoginDevicesPanel/>:kind==='staff'?<LoginDevicesPanel storeMode/>:<><List name="DEMO A" short={kind==='short'}/><List name="DEMO B" short={kind==='short'}/></>;}
api.mount=(kind='lists',locale='zh-CN')=>{root?.unmount();document.getElementById('root').replaceChildren();root=createRoot(document.getElementById('root'));root.render(<StrictMode><LanguageProvider><Locale locale={locale}><OperationFeedbackProvider><ContentProgress/><Cases kind={kind}/></OperationFeedbackProvider></Locale></LanguageProvider></StrictMode>);};api.unmount=()=>root?.unmount();api.ready=true;
`;

export function buildInfiniteListFixture(source = process.cwd(), custom?: {adapter:string;entry:string;seams:string[]}) {
  const native = createRequire(resolve(source, "package.json"));
  const seams = new Set(custom?.seams ?? ["components/backend-snapshot", "components/staff/use-staff", "lib/backend/client", "lib/staff-client"]);
  const modules: string[] = [], ids = new Map<string, number>();
  function pathFor(request: string, parent: string): string {
    if (request === "virtual:adapter" || request === "next/navigation" || request === "next/link" && seams.has("next/link")) return "virtual:adapter.tsx";
    const rel = request.startsWith("@/") ? request.slice(2) : request.startsWith(".") ? resolve(dirname(parent), request).slice(source.length + 1) : null;
    if (rel && seams.has(rel)) return "virtual:adapter.tsx";
    if (request === "lucide-react") return "virtual:icons";
    if (request.endsWith(".css")) return "virtual:css";
    const file = request.startsWith("@/") ? resolve(source, request.slice(2)) : request.startsWith(".") ? resolve(dirname(parent), request) : native.resolve(request);
    if (existsSync(file) && extname(file)) return file;
    for (const ending of [".tsx", ".ts", ".js", "/index.js"]) if (existsSync(file + ending)) return file + ending;
    throw new Error(`Cannot resolve ${request} from ${parent}`);
  }
  function add(file: string): number {
    if (ids.has(file)) return ids.get(file)!;
    const id = modules.length; ids.set(file, id); modules.push("");
    let code: string;
    if (file === "virtual:icons") code = 'module.exports=new Proxy({},{get:(_t,name)=>props=>require("react").createElement("svg",{...props,"data-icon":String(name)})});';
    else if (file === "virtual:css") code = 'module.exports={__esModule:true,default:new Proxy({},{get:(_t,name)=>String(name)})};';
    else if (file.endsWith(".json")) code = "module.exports=" + readFileSync(file, "utf8");
    else {
      const raw = file === "virtual:adapter.tsx" ? custom?.adapter ?? adapter : file === "virtual:entry.tsx" ? custom?.entry ?? entry : readFileSync(file, "utf8");
      code = /\.tsx?$/.test(file) ? ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText : raw;
      code = code.replaceAll("process.env.NODE_ENV", '"development"');
    }
    code = code.replace(/require\(["']([^"']+)["']\)/g, (_match, name) => `__require(${add(pathFor(name, file))})`);
    modules[id] = `function(module,exports,__require){${code}\n}`; return id;
  }
  const root = add("virtual:entry.tsx");
  return `(()=>{const modules=[${modules.join(",\n")}],cache={};function __require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,__require);return m.exports;}__require(${root});})();`;
}
export async function mountInfiniteListFixture(page: Page, compiledCss = false) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let css = compiledCss ? readdirSync(resolve(process.env.CT_PERF_BUILD_DIR??".next","static/chunks")).filter(file => file.endsWith(".css")).map(file => readFileSync(resolve(process.env.CT_PERF_BUILD_DIR??".next","static/chunks", file), "utf8")).find(css => css.includes(".list-pagination")) : readFileSync(resolve("app/globals.css"), "utf8");
  if (!css) throw new Error("The built CSS containing the real list footer is missing");
  css = css.replace(/url\((["']?)\/fonts\/([^"')]+)\1\)/g, (_match, _quote, file) => `url(data:font/woff2;base64,${readFileSync(resolve("public/fonts", file)).toString("base64")})`);
  css += readFileSync(resolve("components/account/login-devices.module.css"), "utf8");
  await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div>`);
  await page.addScriptTag({ content: 'const nativeIO=IntersectionObserver;const active=new Set();window.IntersectionObserver=class extends nativeIO{observe(node){active.add(this);return super.observe(node)}disconnect(){active.delete(this);return super.disconnect()}};window.infiniteObservers=()=>active.size;' });
  await page.addScriptTag({ content: buildInfiniteListFixture() });
  return errors;
}
