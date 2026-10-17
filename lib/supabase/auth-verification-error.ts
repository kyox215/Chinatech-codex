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
  return value.status===401||value.status===403||value.name==='AuthSessionMissingError'||typeof value.code==='string'&&revokedCodes.has(value.code);
 });
 return rejected?401:503;
}
