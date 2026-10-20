import{observeRoute}from'@/lib/backend/request-observation';
import{NextResponse}from'next/server';
import{BackendError}from'@/lib/backend/database';
import{backendRetailListsEnabled,getV2Access,loadRetailScanPage}from'@/lib/backend/page-state';
import{retailScanQuery}from'@/lib/backend/retail-scan-contract';
import{isSupabaseMode}from'@/lib/supabase/config';
export const dynamic='force-dynamic';
async function read(request:Request){
 if(!isSupabaseMode()||!backendRetailListsEnabled())return NextResponse.json({message:'正式后台未启用。'},{status:404});
 try{
  const params=new URL(request.url).searchParams;if([...params.keys()].some(key=>!['raw','cursor','seek'].includes(key)))throw new BackendError('请求资料无效。',400);
  let query;try{const raw=params.get('raw');if(!raw||raw.length>512)throw new Error('请求资料无效。');query=retailScanQuery(JSON.parse(raw));}catch(error){throw new BackendError(error instanceof Error?error.message:'请求资料无效。',400);}
  const seek=params.has('seek')?Number(params.get('seek')):undefined;if(seek!==undefined&&(!/^\d+$/.test(params.get('seek')!)||!Number.isSafeInteger(seek)||seek>1000000))throw new BackendError('请求资料无效。',400);
  const access=await getV2Access(request),value=await loadRetailScanPage(access,query,{cursor:params.get('cursor')??undefined,seek,expectedScope:request.headers.get('x-ct-read-scope')??undefined});
  return NextResponse.json(value,{headers:{'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','Vary':'Cookie, x-ct-store-id','X-Content-Type-Options':'nosniff'}});
 }catch(error){return NextResponse.json({message:error instanceof BackendError?error.message:'后台暂时不可用，请稍后重试。',code:error instanceof BackendError?error.code:undefined},{status:error instanceof BackendError?error.status:503,headers:{'Cache-Control':'private, no-store'}});}
}
export async function GET(request:Request){return observeRoute(request,read);}
