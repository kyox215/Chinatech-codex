import'server-only';
import{BackendError}from'./database';
/** Bounded same-origin JSON for reads whose original field values exceed URLs. */
export async function readJsonBody(request:Request,maxBytes=65536):Promise<unknown>{
 const origin=process.env.APP_ORIGIN||(process.env.NODE_ENV!=='production'?new URL(request.url).origin:'');
 if(!origin||request.headers.get('origin')!==origin)throw new BackendError('请求来源无效。',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new BackendError('请求格式无效。',415);
 const reader=request.body?.getReader();if(!reader)throw new BackendError('请求资料为空。',400);
 const chunks:Uint8Array[]=[];let bytes=0;
 try{for(;;){const{done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new BackendError('提交资料过大。',413);}chunks.push(value);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
 catch(error){if(error instanceof BackendError)throw error;throw new BackendError('请求资料无效。',400);}
}
