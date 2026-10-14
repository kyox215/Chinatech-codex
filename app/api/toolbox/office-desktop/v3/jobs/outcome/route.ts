import { NextRequest } from 'next/server';
import { handleV3 } from '@/lib/toolbox/office-desktop-v3-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) { return handleV3(request, 'outcome'); }
