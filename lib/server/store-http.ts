import { NextRequest,NextResponse } from 'next/server';
import {isSupabaseMode} from '@/lib/supabase/config';
import { BackendError } from '@/lib/backend/database';
import { requireAccountSession } from './account-auth';
import { copyAuthCookies } from './auth-flows';
import { AuthRequestError,preventAuthCaching,readAuthBody,requireSameOrigin } from '@/lib/supabase/server';
import type { AuthIdentity } from '@/lib/backend/database';
import {enforceStoreRate} from './store-rate';
import { requiredUuid } from './stores';
export async function storeHttp(request:NextRequest,write:boolean,fields:readonly string[],run:(identity:AuthIdentity,body:Record<string,unknown>)=>Promise<unknown>){
 if(!isSupabaseMode())return preventAuthCaching(NextResponse.json({message:'正式后台未启用。'},{status:404}));
 const response=preventAuthCaching(NextResponse.json({}));
 try{
  if(write)requireSameOrigin(request);
  const {identity}=await requireAccountSession(request,response,write||request.headers.has('x-ct-account-id'));
  await enforceStoreRate(request,identity,write);
  const body=write?await readAuthBody(request,fields):{};
  const result=await run(identity,body);
  return copyAuthCookies(response,preventAuthCaching(NextResponse.json(result)));
 }catch(error){
  const known=error instanceof BackendError||error instanceof AuthRequestError;
  const code=error&&typeof error==='object'&&'code'in error?String(error.code):'';
  const quota=error instanceof Error&&/limit|quota/i.test(error.message);
  return copyAuthCookies(response,preventAuthCaching(NextResponse.json({message:known?error.message:quota?'门店容量或内测名额已满。':code==='P0001'?'邀请无效、已过期或状态已变化。':'暂时无法完成操作，请保留原请求后重试。',code:known&&'code'in error?error.code:undefined},{status:known?error.status:quota?409:code==='42501'?403:code==='P0001'?410:code==='22023'||code==='23505'?409:503})));
 }
}
export function requestStore(request:NextRequest){return requiredUuid(request.headers.get('x-ct-store-id')??request.nextUrl.searchParams.get('storeId'));}
