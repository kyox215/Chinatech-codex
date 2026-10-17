import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseMode } from '@/lib/supabase/config';
import { authFailure, AuthRequestError, preventAuthCaching, readAuthBody, requireSameOrigin } from '@/lib/supabase/server';
import { readInvitationContext, setInvitationContext, validInvitationToken } from '@/lib/server/store-invitation-context';

export const dynamic = 'force-dynamic';

// This endpoint only stores a device-held candidate. It neither looks up a shop
// nor creates an application, session or membership. No anonymous token GET.
export async function POST(request: NextRequest) {
  if (!isSupabaseMode()) return authFailure(null, '正式后台未启用。', 404);
  try {
    requireSameOrigin(request);
    const body = await readAuthBody(request, ['token']);
    if (!validInvitationToken(body.token)) throw new AuthRequestError('邀请无效或已过期。', 400);
    const previous = readInvitationContext(request);
    // A second POST proves that the browser actually sent the cookie back.
    // Until this is true the caller retains the original fragment URL.
    const response = preventAuthCaching(NextResponse.json({ stored: previous?.token === body.token }));
    setInvitationContext(response, body.token, previous);
    return response;
  } catch (error) { return authFailure(error, '暂时无法保存邀请，请保留原邀请链接后重试。'); }
}
