import { NextRequest, NextResponse } from 'next/server';
import { requireAccountSession } from '@/lib/server/account-auth';
import { copyAuthCookies } from '@/lib/server/auth-flows';
import { readAuthBody, requireSameOrigin } from '@/lib/supabase/server';
import { isSupabaseMode } from '@/lib/supabase/config';
import { DesktopError } from '@/lib/toolbox/office-desktop-token';
import { desktopFailure } from '@/lib/toolbox/office-desktop-server';
import { getDesktopAdmission, changeDesktopAdmission } from '@/lib/toolbox/office-desktop-admission';
import { officeResponse } from '@/lib/toolbox/office-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: NextRequest, changing: boolean) {
  const cookies = officeResponse(NextResponse.json({}));
  try {
    if (!isSupabaseMode()) throw new DesktopError('SERVICE_UNAVAILABLE', 404);
    if (changing) requireSameOrigin(request);
    const { identity } = await requireAccountSession(request, cookies, changing);
    if (changing && request.headers.get('x-ct-session-id') !== identity.sessionId) throw new DesktopError('SESSION_INVALID', 409);
    const result = changing ? await changeDesktopAdmission(identity, await readAuthBody(request, ['enabled', 'minimumVersion', 'expectedRevision', 'requestId'])) : await getDesktopAdmission(identity);
    return copyAuthCookies(cookies, officeResponse(NextResponse.json(result)));
  } catch (error) {
    return copyAuthCookies(cookies, desktopFailure(error));
  }
}
export async function GET(request: NextRequest) { return handle(request, false); }
export async function PATCH(request: NextRequest) { return handle(request, true); }
