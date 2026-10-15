import {toolUpdate,toolOperation} from '@/lib/toolbox/tool-client-server';
import {NextRequest,NextResponse} from 'next/server';
import {isToolId} from '@/lib/toolbox/tool-registry';
import {toolStatus} from '@/lib/toolbox/tool-registry-server';
import {handleV3,statusV3,updateV3,sourceHashV3,type V3Operation} from '@/lib/toolbox/office-desktop-v3-server';
import {requestRateV3} from '@/lib/toolbox/office-desktop-v3-database';
import {officeResponse} from '@/lib/toolbox/office-server';
import {desktopFailure} from '@/lib/toolbox/office-desktop-server';
import {DesktopError} from '@/lib/toolbox/office-desktop-token';
export const runtime='nodejs';export const dynamic='force-dynamic';
type Context={params:Promise<{toolId:string;operation:string[]}>};
export async function GET(request:NextRequest,context:Context){try{
 await requestRateV3('source',sourceHashV3(request),180);
 const {toolId,operation}=await context.params;if(!isToolId(toolId)||request.nextUrl.search)throw new DesktopError('INVALID_REQUEST');
 const op=operation.join('/');if(toolId==='office'&&op==='status')return officeResponse(NextResponse.json(await statusV3()));
 if(toolId==='office'&&op==='update')return officeResponse(NextResponse.json(await updateV3()));
 if(op==='status'){const tool=await toolStatus(toolId);return officeResponse(NextResponse.json({...tool,acceptingNewJobs:tool.enabled&&tool.ready,code:tool.ready?'CURRENT_RELEASE':'INTEGRATION_PENDING',updateUrl:'https://www.chinatech.in/toolbox'}));}
 if(op==='update')return officeResponse(NextResponse.json(await toolUpdate(toolId)));
 return officeResponse(NextResponse.json({code:'INTEGRATION_PENDING'}, {status:409}));
}catch(error){return desktopFailure(error);}}
export async function POST(request:NextRequest,context:Context){try{
 const {toolId,operation}=await context.params,op=operation.join('/');if(!isToolId(toolId)||request.nextUrl.search)throw new DesktopError('INVALID_REQUEST');
 const map:Record<string,V3Operation>={session:'session',admission:'admission','jobs/start':'start','jobs/commit':'commit','jobs/resume':'resume','jobs/activity':'activity','jobs/outcome':'outcome'};
 if(toolId==='office'&&Object.hasOwn(map,op))return handleV3(request,map[op],true);
 if(['windows-check','phone-assistant'].includes(toolId)&&['jobs/start','jobs/resume','jobs/outcome'].includes(op))return toolOperation(request,toolId,op==='jobs/start'?'start':op==='jobs/resume'?'resume':'outcome');
 return officeResponse(NextResponse.json({code:'INTEGRATION_PENDING'}, {status:409}));
}catch(error){return desktopFailure(error);}}
