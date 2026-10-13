import { NextResponse } from 'next/server';
import { readOfficeDesktopAdmission } from '@/lib/backend/database';
import { isSupabaseMode } from '@/lib/supabase/config';
import { DesktopError } from '@/lib/toolbox/office-desktop-token';
import { desktopFailure } from '@/lib/toolbox/office-desktop-server';
import { officeResponse } from '@/lib/toolbox/office-server';
import { previousPublishedVersion } from '@/lib/toolbox/office-desktop-release-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!isSupabaseMode()) throw new DesktopError('SERVICE_UNAVAILABLE', 404);
    const { acceptingNewSessions, minimumVersion, releaseReady, verifiedVersion } = await readOfficeDesktopAdmission();
    return officeResponse(NextResponse.json({ acceptingNewSessions, minimumVersion, currentVersion: releaseReady && verifiedVersion ? verifiedVersion : previousPublishedVersion }));
  } catch (error) {
    return desktopFailure(error);
  }
}
