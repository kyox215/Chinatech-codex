import { NextRequest, NextResponse } from 'next/server';
import { desktopBody, desktopFailure, desktopPackage } from '@/lib/toolbox/office-desktop-server';
import { officeResponse } from '@/lib/toolbox/office-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request: NextRequest) {
  try { return officeResponse(NextResponse.json(await desktopPackage(request,await desktopBody(request,['action','requestId'])))); }
  catch(error) { return desktopFailure(error); }
}
