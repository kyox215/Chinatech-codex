import { NextRequest, NextResponse } from 'next/server';
import { requireAccountSession } from '@/lib/server/account-auth';
import { copyAuthCookies } from '@/lib/server/auth-flows';
import { readAuthBody, requireSameOrigin } from '@/lib/supabase/server';
import { desktopFailure } from '@/lib/toolbox/office-desktop-server';
import { officeResponse } from '@/lib/toolbox/office-server';
import { DesktopError } from '@/lib/toolbox/office-desktop-token';
import { getAdminV3, changeAdminV3 } from '@/lib/toolbox/office-desktop-v3-admin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: NextRequest, changing: boolean) {
 const cookies = officeResponse(NextResponse.json({}));
 try {
  if (request.nextUrl.search) throw new DesktopError('INVALID_REQUEST');
  if (changing) requireSameOrigin(request);
  const { identity } = await requireAccountSession(request, cookies, true);
  if (request.headers.get('x-ct-session-id') !== identity.sessionId) throw new DesktopError('SESSION_INVALID',409);
  const result = changing ? await changeAdminV3(identity, await readAuthBody(request,['enabled','minimumVersion','expectedRevision','requestId'])) : await getAdminV3(identity);
  return copyAuthCookies(cookies,officeResponse(NextResponse.json(result)));
 } catch(error) { return copyAuthCookies(cookies,desktopFailure(error)); }
}
export async function GET(request: NextRequest) { return handle(request,false); }
export async function PATCH(request: NextRequest) { return handle(request,true); }
