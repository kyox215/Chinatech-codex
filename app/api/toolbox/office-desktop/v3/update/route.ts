import { NextRequest, NextResponse } from 'next/server';
import { sourceHashV3, updateV3 } from '@/lib/toolbox/office-desktop-v3-server';
import { requestRateV3 } from '@/lib/toolbox/office-desktop-v3-database';
import { desktopFailure } from '@/lib/toolbox/office-desktop-server';
import { DesktopError } from '@/lib/toolbox/office-desktop-token';
import { officeResponse } from '@/lib/toolbox/office-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) { try {
  if (request.nextUrl.search) throw new DesktopError('INVALID_REQUEST');
  await requestRateV3('source', sourceHashV3(request), 180);
  return officeResponse(NextResponse.json(await updateV3()));
} catch (error) { return desktopFailure(error); } }
