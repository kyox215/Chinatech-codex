import assert from'node:assert/strict';
import{test}from'node:test';
import{AuthApiError,AuthRetryableFetchError,AuthSessionMissingError,AuthInvalidJwtError,AuthUnknownError}from'@supabase/supabase-js';
import{sourceLoader}from'./helpers/typescript-source.mjs';
const user={id:'DEMO-user',email_confirmed_at:'2026-10-17T00:00:00Z'},claims={sub:user.id,session_id:'DEMO-session'};
class Failure extends Error{constructor(message,status){super(message);this.status=status;}}
for(const target of['backend','account'])test(target+' identity preserves retryable provider failures and prioritizes real rejection, including SDK throws',async()=>{
 const cases=[
  {userError:new AuthRetryableFetchError('DEMO unavailable',503),status:503},
  {claimsError:new AuthRetryableFetchError('DEMO network',0),status:503},
  {userError:new AuthApiError('DEMO rate limit',429,'over_request_rate_limit'),status:503},
  {userError:new AuthUnknownError('DEMO parsing',new SyntaxError('DEMO malformed')),status:503},
  {claimsError:new AuthUnknownError('DEMO parsing',new SyntaxError('DEMO malformed')),throws:true,status:503},
  {claimsError:new AuthInvalidJwtError('DEMO signature'),throws:true,status:401},
  {userError:new AuthSessionMissingError(),status:401},
  {userError:new AuthApiError('DEMO invalid',403,'bad_jwt'),claimsError:new AuthRetryableFetchError('DEMO network',0),status:401},
  {userError:new AuthRetryableFetchError('DEMO unavailable',503),claimsError:new AuthInvalidJwtError('DEMO invalid'),throws:true,status:401},
 ];
 for(const sample of cases){
  let calls=0;const client={auth:{getUser:async()=>{calls++;return{data:{user:sample.userError?null:user},error:sample.userError??null};},getClaims:async()=>{calls++;if(sample.throws)throw sample.claimsError;return{data:sample.claimsError?null:{claims},error:sample.claimsError??null};}}};
  const load=sourceLoader(process.cwd(),{'next/headers':{cookies:async()=>{throw Error('No cookie reads in SDK boundary test');}},'next/server':{},'../supabase/server':{createSupabaseServerClient:async()=>client},'@/lib/supabase/server':{createSupabaseRouteClient:()=>client,AuthRequestError:Failure},'@/lib/backend/database':{BackendError:Failure},'./database':{BackendError:Failure},'./request-observation':{}});
  await assert.rejects(target==='backend'?load('./lib/backend/context').getAuthIdentity():load('./lib/server/account-auth').requireAccountIdentity({headers:new Headers()},{},false),error=>error.status===sample.status);assert.equal(calls,2);
 }
});
