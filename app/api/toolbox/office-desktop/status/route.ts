import { NextResponse } from 'next/server';
import { readOfficeDesktopAdmission } from '@/lib/backend/database';
import { isSupabaseMode } from '@/lib/supabase/config';
import { DesktopError } from '@/lib/toolbox/office-desktop-token';
import { desktopFailure } from '@/lib/toolbox/office-desktop-server';
import { officeResponse } from '@/lib/toolbox/office-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!isSupabaseMode()) throw new DesktopError('SERVICE_UNAVAILABLE', 404);
    return officeResponse(NextResponse.json(await readOfficeDesktopAdmission()));
  } catch (error) {
    return desktopFailure(error);
  }
}
