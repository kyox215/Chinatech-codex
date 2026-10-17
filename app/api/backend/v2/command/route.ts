import {enforceStoreRate} from '@/lib/server/store-rate';
import {NextResponse} from 'next/server';
import {getAuthIdentity} from '@/lib/backend/context';
import {executeCommandV2} from '@/lib/backend/commands';
import {commandHttpError,commandResponseHeaders,readBackendCommand} from '@/lib/backend/command-http';
import {isSupabaseMode} from '@/lib/supabase/config';
import {observeRoute,observeTime,observe} from '@/lib/backend/request-observation';
export const dynamic='force-dynamic';
function response(value:unknown,status=200){const started=performance.now(),body=JSON.stringify(value);observe('command_serialize',performance.now()-started);return new NextResponse(body,{status,headers:{...commandResponseHeaders,'Content-Type':'application/json','X-CT-Body-Bytes':String(Buffer.byteLength(body))}});}
async function write(request:Request){
 if(!isSupabaseMode())return response({message:'正式后台未启用。'},404);
 try{const command=await readBackendCommand(request),identity=await getAuthIdentity();await enforceStoreRate(request,identity,true);const result=await executeCommandV2(identity,command);return response(result);}
 catch(error){const failure=commandHttpError(error);return response(failure.body,failure.status);}
}
export function POST(request:Request){return observeRoute(request,current=>observeTime("command_total",()=>write(current)));}
