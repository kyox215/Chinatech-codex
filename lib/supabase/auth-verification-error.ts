/** The private brand originates only from an actual Auth GET /user response.
 * SDKs may discard HTTP status when a rejection body is not JSON. Preserve it
 * on the parse error itself; no token, identity, response body or global cache
 * is retained, and success/temporary responses receive no such brand. */
class AuthProviderRejection extends Error {
 constructor(readonly status:401|403,cause:unknown){super('Auth provider rejected this verification response.',{cause});}
}
export function preserveAuthRejection(response:Response):Response{
 if(response.status!==401&&response.status!==403)return response;
 const status=response.status,json=response.json.bind(response);
 response.json=async()=>{try{return await json();}catch(reason){throw new AuthProviderRejection(status,reason);}};
 return response;
}
function providerRejected(error:unknown):boolean{
 const pending=[error],seen=new Set<object>();
 for(let depth=0;pending.length&&depth<8;depth++){
  const current=pending.pop();if(!current||typeof current!=='object'||seen.has(current))continue;
  if(current instanceof AuthProviderRejection)return true;
  seen.add(current);const next=current as{originalError?:unknown;cause?:unknown};pending.push(next.originalError,next.cause);
 }
 return false;
}
/** Only provider-confirmed authentication loss may clear a current identity.
 * Network, upstream parsing, rate-limit and unknown failures remain retryable.
 * These values come from SDK calls, never request headers or decoded claims.
 */
export function authVerificationFailure(...errors:unknown[]):401|503|null{
 const failures=errors.filter(error=>error!==null&&error!==undefined);
 if(!failures.length)return null;
 const revokedCodes=new Set(['bad_jwt','invalid_jwt','session_not_found','refresh_token_not_found','refresh_token_already_used','user_not_found','user_banned','email_not_confirmed','invalid_credentials']);
 const rejected=failures.some(error=>{
  if(typeof error!=='object'||error===null)return false;
  const value=error as{status?:unknown;code?:unknown;name?:unknown};
  return providerRejected(error)||value.status===401||value.status===403||value.name==='AuthSessionMissingError'||typeof value.code==='string'&&revokedCodes.has(value.code);
 });
 return rejected?401:503;
}
