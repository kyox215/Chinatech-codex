import { NextRequest, NextResponse } from 'next/server';
import { requireAccountSession } from '@/lib/server/account-auth';
import { copyAuthCookies } from '@/lib/server/auth-flows';
import { readAuthBody, requireSameOrigin } from '@/lib/supabase/server';
import { isSupabaseMode } from '@/lib/supabase/config';
import { DesktopError } from '@/lib/toolbox/office-desktop-token';
import { desktopFailure, getDesktopLicenses, createDesktopLicense, changeDesktopLicense } from '@/lib/toolbox/office-desktop-server';
import { officeResponse } from '@/lib/toolbox/office-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:NextRequest,mode:'read'|'create'|'change') {
  const cookies=officeResponse(NextResponse.json({}));
  try {
    if(!isSupabaseMode())throw new DesktopError('SERVICE_UNAVAILABLE',404);
    if(mode!=='read')requireSameOrigin(request);
    const {identity}=await requireAccountSession(request,cookies,mode!=='read');
    if(mode!=='read' && request.headers.get('x-ct-session-id')!==identity.sessionId)throw new DesktopError('SESSION_INVALID',409);
    const result=mode==='read'?await getDesktopLicenses(identity):mode==='create'?await createDesktopLicense(identity,await readAuthBody(request,['requestId','label','expiresAt','maxDevices','actions'])):await changeDesktopLicense(identity,await readAuthBody(request,['licenseId','requestId','expectedRevision','enabled']));
    return copyAuthCookies(cookies,officeResponse(NextResponse.json(result)));
  }catch(error){return copyAuthCookies(cookies,desktopFailure(error));}
}
export async function GET(request:NextRequest){return handle(request,'read');}
export async function POST(request:NextRequest){return handle(request,'create');}
export async function PATCH(request:NextRequest){return handle(request,'change');}
