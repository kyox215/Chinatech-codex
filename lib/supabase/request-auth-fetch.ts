import {observedAuthFetch} from "../backend/request-observation";
import{preserveAuthRejection}from"./auth-verification-error";
/** Uncached clients retain mutation, refresh and cancellation semantics. Only
 * the exact configured Auth verification endpoint may brand a denial. */
export function createAuthVerificationFetch(supabaseUrl:string,base:typeof fetch=observedAuthFetch):typeof fetch{
 const userUrl=supabaseUrl.replace(/\/$/,"")+"/auth/v1/user";
 return async(input,init)=>{
  const response=await base(input,init);
  const requestUrl=typeof input==="string"?input:input instanceof URL?input.href:input.url,method=(init?.method??(input instanceof Request?input.method:"GET")).toUpperCase(),headers=new Headers(init?.headers??(input instanceof Request?input.headers:undefined));
  return requestUrl===userUrl&&method==="GET"&&headers.has("authorization")?preserveAuthRejection(response):response;
 };
}
/** One read-only Supabase client, one HTTP request. Both getUser and the
 * getClaims HS fallback still validate through Auth; identical GET responses
 * are shared only for their exact URL and effective headers, including token.
 * Never use this fetch across requests or on a client that edits Auth users. */
export function createRequestAuthReadFetch(supabaseUrl:string):typeof fetch {
 const exactFetch=createAuthVerificationFetch(supabaseUrl),userUrl=supabaseUrl.replace(/\/$/,"")+"/auth/v1/user",responses=new Map<string,Promise<Response>>();
 return async(input,init)=>{
  // Independent cancellation and arbitrary Request bodies keep native fetch
  // semantics. Auth SDK's getUser requests have neither a body nor a signal.
  if(input instanceof Request||init?.signal)return exactFetch(input,init);
  const request=new Request(input,init);
  if(request.method!=="GET"||request.url!==userUrl||!request.headers.get("authorization"))return exactFetch(input,init);
  const key=JSON.stringify([request.method,request.url,[...request.headers].sort(([a],[b])=>a.localeCompare(b)),request.credentials]);
  let result=responses.get(key);
  if(!result){if(responses.size>=4)return exactFetch(input,init);result=exactFetch(input,init);responses.set(key,result);}
  return preserveAuthRejection((await result).clone());
 };
}
