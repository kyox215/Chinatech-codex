import{NextResponse}from'next/server';
import{observeRoute}from'@/lib/backend/request-observation';
import{BackendError}from'@/lib/backend/database';
import{readJsonBody}from'@/lib/backend/read-json-body';
import{retailFormCandidateQuery}from'@/lib/backend/retail-form-contract';
import{backendRetailFormsEnabled,getV2Access,loadRetailFormCandidatePage}from'@/lib/backend/page-state';
import{isSupabaseMode}from'@/lib/supabase/config';
export const dynamic='force-dynamic';
async function read(request:Request){
 const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','Vary':'Cookie, x-ct-store-id','X-Content-Type-Options':'nosniff'}});
 if(!isSupabaseMode()||!backendRetailFormsEnabled())return respond({message:'正式后台未启用。'},404);
 try{let query;try{query=retailFormCandidateQuery(await readJsonBody(request));}catch(error){if(error instanceof BackendError)throw error;throw new BackendError('请求资料无效。',400);}
  const value=await loadRetailFormCandidatePage(await getV2Access(request),query,request.headers.get('x-ct-read-scope')??undefined);
  return respond('items'in value?value:{scope:value.scope,items:[value]});
 }catch(error){return respond({message:error instanceof BackendError?error.message:'后台暂时不可用，请稍后重试。',code:error instanceof BackendError?error.code:undefined},error instanceof BackendError?error.status:503);}
}
export async function POST(request:Request){return observeRoute(request,read);}
