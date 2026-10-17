import {NextResponse} from "next/server";
import {BackendError} from "@/lib/backend/database";
import {backendProcurementListsEnabled,getV2Access,loadProcurementBatchPage} from "@/lib/backend/page-state";
import {procurementBatchQuery} from "@/lib/backend/procurement-batch-contract";
import {isSupabaseMode} from "@/lib/supabase/config";
export const dynamic="force-dynamic";
async function read(request:Request,ids?:string[]) {
 const started=performance.now();
 function respond(value:unknown,status=200){return NextResponse.json(value,{status,headers:{"Cache-Control":"private, no-store","Vary":"Cookie, x-ct-store-id","X-Content-Type-Options":"nosniff","Server-Timing":`total;dur=${(performance.now()-started).toFixed(1)}`}});}
 if(!isSupabaseMode()||!backendProcurementListsEnabled())return respond({message:"正式后台未启用。"},404);
 try{
  const params=new URL(request.url).searchParams;
  if([...params.keys()].some(key=>!["kind","q","repairId","supplierId","cursor","seek"].includes(key))||params.get("cursor")&&params.get("cursor")!.length>2048||params.has("seek")&&!/^\d+$/.test(params.get("seek")!))throw new BackendError("请求资料无效。",400);
  let query;try{query=procurementBatchQuery(Object.fromEntries([...params].filter(([key])=>!["cursor","seek"].includes(key))));}catch{throw new BackendError("请求资料无效。",400);}
  if(ids&&query.kind!=="rows")throw new BackendError("请求资料无效。",400);
  const access=await getV2Access(request);
  return respond(await loadProcurementBatchPage(access,query,{ids,cursor:params.get("cursor")??undefined,seek:params.has("seek")?Number(params.get("seek")):undefined,expectedScope:request.headers.get("x-ct-read-scope")??undefined}));
 }catch(error){return respond({message:error instanceof BackendError?error.message:"后台暂时不可用，请稍后重试。",code:error instanceof BackendError?error.code:undefined},error instanceof BackendError?error.status:503);}
}
export async function GET(request:Request){return read(request);}
export async function POST(request:Request){
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
 const origin=process.env.APP_ORIGIN||(process.env.NODE_ENV!=="production"?new URL(request.url).origin:"");
 if(!origin||request.headers.get("origin")!==origin)return NextResponse.json({message:"请求来源无效。"},{status:403,headers});
 if(!request.headers.get("content-type")?.startsWith("application/json"))return NextResponse.json({message:"请求格式无效。"},{status:415,headers});
 const reader=request.body?.getReader();if(!reader)return NextResponse.json({message:"请求资料无效。"},{status:400,headers});
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();return NextResponse.json({message:"提交资料过大。"},{status:413,headers});}chunks.push(value);}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{return NextResponse.json({message:"请求资料无效。"},{status:400,headers});}
 if(!body||Object.keys(body).length!==1||!Array.isArray(body.ids)||body.ids.length>100||body.ids.some((id:unknown)=>typeof id!=="string"||!id||id.length>100))return NextResponse.json({message:"请求资料无效。"},{status:400,headers});
 return read(request,body.ids);
}
