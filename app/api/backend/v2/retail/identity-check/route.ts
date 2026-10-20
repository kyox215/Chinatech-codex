import{NextResponse}from'next/server';
import{observeRoute}from'@/lib/backend/request-observation';
import{BackendError}from'@/lib/backend/database';
import{readJsonBody}from'@/lib/backend/read-json-body';
import{backendRetailFormsEnabled,getV2Access,loadRetailIdentityCheck}from'@/lib/backend/page-state';
import{isSupabaseMode}from'@/lib/supabase/config';
import type{RetailUnit}from'@/lib/retail';
export const dynamic='force-dynamic';
async function read(request:Request){
 const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','Vary':'Cookie, x-ct-store-id','X-Content-Type-Options':'nosniff'}});
 if(!isSupabaseMode()||!backendRetailFormsEnabled())return respond({message:'正式后台未启用。'},404);
 try{const query=await readJsonBody(request);return respond(await loadRetailIdentityCheck(await getV2Access(request),query as Pick<RetailUnit,'id'|'code'|'brand'|'serial'|'imei1'|'imei2'>,request.headers.get('x-ct-read-scope')??undefined));}
 catch(error){return respond({message:error instanceof BackendError?error.message:'后台暂时不可用，请稍后重试。',code:error instanceof BackendError?error.code:undefined},error instanceof BackendError?error.status:503);}
}
export async function POST(request:Request){return observeRoute(request,read);}
