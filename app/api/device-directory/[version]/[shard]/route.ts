import { deviceDirectoryResource, directoryResponse, directoryError } from '@/lib/server/device-directory';
import { directoryVersion, directoryShardKey } from '@/lib/device-directory';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{version:string;shard:string}> }) {
  const {version,shard} = await params;
  if (!directoryVersion.test(version) || (shard !== 'package' && !directoryShardKey.test(shard))) return directoryError(404);
  try { const body = await deviceDirectoryResource(version,shard); return body ? directoryResponse(body,true) : directoryError(404); } catch { return directoryError(); }
}
