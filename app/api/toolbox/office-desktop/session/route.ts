import { NextRequest, NextResponse } from 'next/server';
import { desktopBody, desktopFailure, openDesktopSession } from '@/lib/toolbox/office-desktop-server';
import { officeResponse } from '@/lib/toolbox/office-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request: NextRequest) {
  try { return officeResponse(NextResponse.json(await openDesktopSession(await desktopBody(request,['mode','requestId','appVersion','key','installationId','language'])))); }
  catch(error) { return desktopFailure(error); }
}
