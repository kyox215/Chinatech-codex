import { NextRequest, NextResponse } from 'next/server';
import { sourceHashV3, statusV3 } from '@/lib/toolbox/office-desktop-v3-server';
import { requestRateV3 } from '@/lib/toolbox/office-desktop-v3-database';
import { desktopFailure } from '@/lib/toolbox/office-desktop-server';
import { officeResponse } from '@/lib/toolbox/office-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) { try { await requestRateV3('source', sourceHashV3(request), 180); return officeResponse(NextResponse.json(await statusV3())); } catch (error) { return desktopFailure(error); } }
