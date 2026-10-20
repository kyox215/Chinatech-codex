import {BackendError} from './database';
import type {BackendCommand} from './contracts';
export function requireCommandOrigin(request:Request){const origin=process.env.APP_ORIGIN||(process.env.NODE_ENV!=='production'?new URL(request.url).origin:'');if(!origin||request.headers.get('origin')!==origin)throw new BackendError('请求来源无效。',403);if(!request.headers.get('content-type')?.startsWith('application/json'))throw new BackendError('请求格式无效。',415);}
export async function readCommandBody(request:Request,limit=3*1024*1024){
 requireCommandOrigin(request);const reader=request.body?.getReader();if(!reader)throw new BackendError('请求资料为空。');
 const chunks:Uint8Array[]=[];let size=0;while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new BackendError('提交资料过大。',413);}chunks.push(value);}
 let value:unknown;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new BackendError('请求资料无效。');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new BackendError('请求资料无效。');return value as Record<string,unknown>;
}
export async function readBackendCommand(request:Request):Promise<BackendCommand>{const body=await readCommandBody(request);if(Object.keys(body).some(key=>!['kind','payload','storeId','requestId','memberId'].includes(key)))throw new BackendError('请求字段无效。');return body as BackendCommand;}
export function commandHttpError(error:unknown){const code=typeof error==='object'&&error!==null&&'code'in error?error.code:null;return{body:{code:error instanceof BackendError?error.code:undefined,message:error instanceof BackendError?error.message:code==='40001'?'后台繁忙，本次结果请通过原请求核对。':error instanceof Error&&!code?error.message:'保存失败，请重试。'},status:error instanceof BackendError?error.status:code?503:400};}
export const commandResponseHeaders={'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
