import{observeRoute}from'@/lib/backend/request-observation';import{NextResponse}from'next/server';import{BackendError}from'@/lib/backend/database';import{backendRepairListsEnabled,getV2Access,loadIntakeDraftPage}from'@/lib/backend/page-state';import{isSupabaseMode}from'@/lib/supabase/config';
export const dynamic='force-dynamic';
async function read(request:Request){const started=performance.now();const respond=(value:unknown,status=200)=>{const body=JSON.stringify(value);return new NextResponse(body,{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','Vary':'Cookie, x-ct-store-id','X-Content-Type-Options':'nosniff','X-CT-Body-Bytes':String(Buffer.byteLength(body)),'Server-Timing':`total;dur=${(performance.now()-started).toFixed(1)}`}});};
 if(!isSupabaseMode()||!backendRepairListsEnabled())return respond({message:'正式后台未启用。'},404);
 try{const params=new URL(request.url).searchParams;if([...params.keys()].some(key=>key!=='id')||!params.has('id'))throw new BackendError('请求资料无效。',400);const access=await getV2Access(request);return respond(await loadIntakeDraftPage(access,params.get('id')!,request.headers.get('x-ct-read-scope')??undefined));
 }catch(error){return respond({message:error instanceof BackendError?error.message:'后台暂时不可用，请稍后重试。',code:error instanceof BackendError?error.code:undefined},error instanceof BackendError?error.status:503);}
}
export async function GET(request:Request){return observeRoute(request,read);}
