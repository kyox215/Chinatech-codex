import { NextRequest, NextResponse } from 'next/server';
import { requireAccountSession } from '@/lib/server/account-auth';
import { copyAuthCookies } from '@/lib/server/auth-flows';
import { DesktopError } from '@/lib/toolbox/office-desktop-token';
import { desktopFailure } from '@/lib/toolbox/office-desktop-server';
import { officeResponse } from '@/lib/toolbox/office-server';
import { getJobsV3 } from '@/lib/toolbox/office-desktop-v3-admin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const cookies = officeResponse(NextResponse.json({}));
  try {
    if (request.nextUrl.search) throw new DesktopError('INVALID_REQUEST');
    const { identity } = await requireAccountSession(request, cookies, true);
    if (request.headers.get('x-ct-session-id') !== identity.sessionId) throw new DesktopError('SESSION_INVALID', 409);
    return copyAuthCookies(cookies, officeResponse(NextResponse.json(await getJobsV3(identity))));
  } catch (error) { return copyAuthCookies(cookies, desktopFailure(error)); }
}
