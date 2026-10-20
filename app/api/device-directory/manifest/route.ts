import { deviceDirectoryResource, directoryResponse, directoryError } from '@/lib/server/device-directory';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { try { const body = await deviceDirectoryResource(); return body ? directoryResponse(body) : directoryError(); } catch { return directoryError(); } }
