import {AsyncLocalStorage} from "node:async_hooks";

type Sample={milliseconds:number;calls:number};
type Observation={samples:Map<string,Sample>};
const observations=new AsyncLocalStorage<Observation>();
const names=new Set(["command_lock","command_dependencies","command_apply","command_receipt","command_legacy_snapshot","command_serialize","command_total","operation_total","auth_user","auth_refresh","auth_keys","auth_other","db_acquire","db_session","db_lock","db_live","db_work","db_finish","db_query","db_retry","db_total","db_40001","db_40p01","db_error","db_enroll","db_enroll_40001","db_enroll_40p01","db_enroll_needed"]);
// Only fixed names and numeric aggregates enter diagnostics. SQL, parameters,
// URLs, cookies, identities and response bodies are deliberately excluded.
export function observe(name:string,milliseconds:number,calls=1){
 const current=observations.getStore();if(!current||!names.has(name))return;
 const previous=current.samples.get(name)??{milliseconds:0,calls:0};
 current.samples.set(name,{milliseconds:previous.milliseconds+Math.max(0,milliseconds),calls:previous.calls+calls});
}
export async function observeTime<T>(name:string,run:()=>Promise<T>):Promise<T>{const started=performance.now();try{return await run();}finally{observe(name,performance.now()-started);}}
function timing(value:Observation,prefix=""){return [...value.samples].map(([name,sample])=>`${prefix}${name};dur=${sample.milliseconds.toFixed(1)};desc="${sample.calls} calls"`).join(", ");}
export async function withObservation<T>(run:()=>Promise<T>){const value:Observation={samples:new Map()};const result=await observations.run(value,run);return{result,timing:timing(value)};}
export async function observeRoute(request:Request,run:(request:Request)=>Promise<Response>){
 const {result,timing:own}=await withObservation(()=>run(request));
 const proxy=request.headers.get("x-ct-observe-proxy")??"";
 // These are observations, never authorization input. The proxy overwrites the
 // header; validate it here as well so direct invocation cannot inject headers.
 const safeProxy=proxy.length<=2048&&/^(?:[a-z][a-z0-9_]*;dur=\d+(?:\.\d)?;desc="\d+ calls"(?:, )?)*$/.test(proxy)?proxy:"";
 const measured=safeProxy.replace(/(^|, )([a-z][a-z0-9_]*);/g,"$1proxy_$2;");
 const previous=result.headers.get("Server-Timing");
 result.headers.set("Server-Timing",[previous,measured,own].filter(Boolean).join(", "));
 return result;
}
export const observedAuthFetch:typeof fetch=async(input,init)=>{
 const path=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url).pathname;
 const name=path.endsWith("/auth/v1/user")?"auth_user":path.endsWith("/auth/v1/token")?"auth_refresh":path.endsWith("/.well-known/jwks.json")?"auth_keys":"auth_other";
 return observeTime(name,()=>fetch(input,{...init,cache:"no-store"}));
};
/** Preserve the driver's lazy Query, fragment and chaining semantics. Only a
 * query that is actually awaited/executed is counted, once. No SQL is retained. */
export function observedTransaction<T extends (...args:never[])=>unknown>(sql:T):T {
 if(!observations.getStore())return sql;
 function query<T>(value:T):T{
  if(!value||typeof value!=="object"||!("then" in value)||typeof value.then!=="function")return value;
  let started:number|undefined,recorded=false;
  const begin=()=>{started??=performance.now();};
  const finish=()=>{if(!recorded){recorded=true;observe("db_query",performance.now()-(started??performance.now()));}};
  const queryProxy=new Proxy(value,{get(target,key){const member=Reflect.get(target,key,target);
   if(key==="then"&&typeof member==="function")return(resolve:unknown,reject:unknown)=>{begin();return member.call(target,(result:unknown)=>{finish();return typeof resolve==="function"?resolve(result):result;},(error:unknown)=>{finish();if(typeof reject==="function")return reject(error);throw error;});};
   if(key==="catch")return(reject:unknown)=>Promise.resolve(queryProxy).catch(typeof reject==="function"?error=>reject(error):undefined);
   if(key==="finally")return(done:unknown)=>Promise.resolve(queryProxy).finally(typeof done==="function"?()=>done():undefined);
   if(typeof member!=="function")return member;
   return(...args:unknown[])=>{if(key==="execute")begin();const result=member.apply(target,args);return result===target?queryProxy:result;};
  }}) as T;
  // All fluent methods above return this same proxy. Initialized before any
  // caller can execute them, including execute()/values()/simple().
  return queryProxy;
 }
 return new Proxy(sql,{apply(target,thisArg,args){return query(Reflect.apply(target,thisArg,args));},get(target,key){const member=Reflect.get(target,key,target);return typeof member==="function"?(...args:unknown[])=>query(member.apply(target,args)):member;}});
}
