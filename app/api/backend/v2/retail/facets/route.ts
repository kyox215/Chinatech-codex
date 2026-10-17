import{observeRoute}from'@/lib/backend/request-observation';
import{NextResponse}from'next/server';
import{BackendError}from'@/lib/backend/database';
import{backendRetailListsEnabled,getV2Access,loadRetailFacetPage}from'@/lib/backend/page-state';
import{retailFacetQuery}from'@/lib/backend/retail-list-contract';
import{isSupabaseMode}from'@/lib/supabase/config';
export const dynamic='force-dynamic';
async function read(request:Request){
 if(!isSupabaseMode()||!backendRetailListsEnabled())return NextResponse.json({message:'正式后台未启用。'},{status:404});
 try{
  const params=new URL(request.url).searchParams;if([...params.keys()].some(key=>!['view','kind','q','key'].includes(key)))throw new BackendError('请求资料无效。',400);
  let query;try{query=retailFacetQuery(Object.fromEntries(params));}catch{throw new BackendError('请求资料无效。',400);}
  const access=await getV2Access(request),value=await loadRetailFacetPage(access,query,request.headers.get('x-ct-read-scope')??undefined);
  return NextResponse.json(value,{headers:{'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','Vary':'Cookie, x-ct-store-id','X-Content-Type-Options':'nosniff'}});
 }catch(error){return NextResponse.json({message:error instanceof BackendError?error.message:'后台暂时不可用，请稍后重试。',code:error instanceof BackendError?error.code:undefined},{status:error instanceof BackendError?error.status:503,headers:{'Cache-Control':'private, no-store'}});}
}
export async function GET(request:Request){return observeRoute(request,read);}
