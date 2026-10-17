import {NextResponse} from 'next/server';
import {getAuthIdentity,memberInTransaction} from '@/lib/backend/context';
import {queryOperationV2,cancelOperationV2} from '@/lib/backend/commands';
import {BackendError,withDatabase} from '@/lib/backend/database';
import {backendIdentityChangedCode} from '@/lib/backend/read-plan';
import {readCommandEffects} from '@/lib/backend/command-result';
import {commandResponseHeaders,readCommandBody} from '@/lib/backend/command-http';
import {isSupabaseMode} from '@/lib/supabase/config';
import {observeRoute,observeTime} from '@/lib/backend/request-observation';
export const dynamic='force-dynamic';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
async function read(request:Request){
 if(!isSupabaseMode())return NextResponse.json({message:'正式后台未启用。'},{status:404,headers:commandResponseHeaders});
 try{const params=new URL(request.url).searchParams,storeId=params.get('storeId')??'',memberId=params.get('memberId')??'',requestId=params.get('requestId')??'',identity=await getAuthIdentity();
  if(params.get('effects')==='1'){
   if(!uuid.test(storeId)||!uuid.test(requestId)||params.has('offset')&&!/^\d{1,3}$/.test(params.get('offset')!))throw new BackendError('请求标识无效。');
   const result=await withDatabase(identity,storeId,async tx=>{const member=await memberInTransaction(tx,storeId,identity.userId);if(member.id!==memberId)throw new BackendError('登录身份已变化。',409,backendIdentityChangedCode);return readCommandEffects(tx,identity,storeId,requestId,member,Number(params.get('offset')??0));});return NextResponse.json(result,{headers:commandResponseHeaders});
  }
  return NextResponse.json(await queryOperationV2(identity,storeId,memberId,requestId),{headers:commandResponseHeaders});
 }catch(error){return NextResponse.json({message:error instanceof BackendError?error.message:'暂时无法核对提交结果。',code:error instanceof BackendError?error.code:undefined},{status:error instanceof BackendError?error.status:503,headers:commandResponseHeaders});}
}
async function cancel(request:Request){
 if(!isSupabaseMode())return NextResponse.json({message:'正式后台未启用。'},{status:404,headers:commandResponseHeaders});
 try{const body=await readCommandBody(request,1024);if(Object.keys(body).some(key=>!['storeId','memberId','requestId'].includes(key)))throw new BackendError('请求格式无效。');return NextResponse.json(await cancelOperationV2(await getAuthIdentity(),String(body.storeId),String(body.memberId),String(body.requestId)),{headers:commandResponseHeaders});}
 catch(error){return NextResponse.json({message:error instanceof BackendError?error.message:'撤销尚未确认，请继续核对原提交。',code:error instanceof BackendError?error.code:undefined},{status:error instanceof BackendError?error.status:503,headers:commandResponseHeaders});}
}
export function GET(request:Request){return observeRoute(request,current=>observeTime("operation_total",()=>read(current)));}
export function POST(request:Request){return observeRoute(request,current=>observeTime("operation_total",()=>cancel(current)));}
