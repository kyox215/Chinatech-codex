import {observedAuthFetch} from "../backend/request-observation";
/** One read-only Supabase client, one HTTP request. Both getUser and the
 * getClaims HS fallback still validate through Auth; identical GET responses
 * are shared only for their exact URL and effective headers, including token.
 * Never use this fetch across requests or on a client that edits Auth users. */
export function createRequestAuthReadFetch(supabaseUrl:string):typeof fetch {
 const userUrl=supabaseUrl.replace(/\/$/,"")+"/auth/v1/user",responses=new Map<string,Promise<Response>>();
 return async(input,init)=>{
  // Independent cancellation and arbitrary Request bodies keep native fetch
  // semantics. Auth SDK's getUser requests have neither a body nor a signal.
  if(input instanceof Request||init?.signal)return observedAuthFetch(input,init);
  const request=new Request(input,init);
  if(request.method!=="GET"||request.url!==userUrl||!request.headers.get("authorization"))return observedAuthFetch(input,init);
  const key=JSON.stringify([request.method,request.url,[...request.headers].sort(([a],[b])=>a.localeCompare(b)),request.credentials]);
  let result=responses.get(key);
  if(!result){if(responses.size>=4)return observedAuthFetch(input,init);result=observedAuthFetch(input,init);responses.set(key,result);}
  return (await result).clone();
 };
}
