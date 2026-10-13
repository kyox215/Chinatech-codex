import 'server-only';
import postgres, { type TransactionSql } from 'postgres';
import { DesktopError } from './office-desktop-token';
import type { V3Proof } from './office-desktop-v3-token';

let connection: ReturnType<typeof postgres> | undefined;
function databaseV3() {
  const value = process.env.APP_DATABASE_URL;
  if (!value) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
  const url = new URL(value), user = decodeURIComponent(url.username);
  const projectRef = new URL(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost').hostname.split('.')[0];
  if (user !== 'chinatech_runtime' && user !== 'chinatech_runtime.' + projectRef) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
  connection ??= postgres(value, { max: 5, prepare: false, idle_timeout: 20, connect_timeout: 10, ssl: ['127.0.0.1', 'localhost'].includes(url.hostname) ? false : 'require' });
  return connection;
}
export async function transactionV3<T>(body: V3Proof | null, keyHash: string, op: string, sourceHash: string, run: (tx: TransactionSql) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await databaseV3().begin('isolation level read committed', async tx => {
      await tx`select set_config('request.jwt.claims','{"role":"anon"}',true),set_config('app.store_id','',true),set_config('app.office_desktop_grant_id','',true),set_config('app.office_desktop_public_issue','false',true),set_config('app.office_desktop_key_hash','',true),set_config('app.office_desktop_installation','',true),set_config('statement_timeout','10000',true)`;
      await tx`select set_config('app.office_v3_installation',${body?.installationId ?? ''},true),set_config('app.office_v3_key_hash',${keyHash},true),set_config('app.office_v3_request',${body?.requestId ?? ''},true),set_config('app.office_v3_job',${typeof body?.jobId === 'string' ? body.jobId : ''},true),set_config('app.office_v3_source_hash',${sourceHash},true),set_config('app.office_v3_op',${op},true),set_config('app.office_v3_rate_kind','',true),set_config('app.office_v3_rate_key','',true)`;
      return run(tx);
    }) as T; } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
      if (!['40001', '40P01'].includes(String(code)) || attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}
export async function lockV3(tx: TransactionSql, scope: string) { await tx`select pg_advisory_xact_lock(hashtextextended(${`office-v3:${scope}`},140))`; }
export async function requestRateV3(kind: 'source' | 'instance', keyHash: string, limit: number) {
  if (!['source', 'instance'].includes(kind) || !/^[a-f0-9]{64}$/.test(keyHash) || !Number.isInteger(limit) || limit < 1 || limit > 10000) throw new DesktopError('INVALID_REQUEST');
  const accepted = await transactionV3(null, '', 'request-rate', '', async tx => {
    await tx`select set_config('app.office_v3_rate_kind',${kind},true),set_config('app.office_v3_rate_key',${keyHash},true)`;
    const [row] = await tx<{ requests: number }[]>`insert into chinatech_v2_private.office_v3_rate_buckets as r(kind,key_hash,minute,requests)
      values(${kind},${keyHash},floor(extract(epoch from statement_timestamp())/60)::bigint,1)
      on conflict(kind,key_hash) do update set minute=excluded.minute,
      requests=case when r.minute=excluded.minute then least(r.requests+1,1000000) else 1 end returning requests`;
    return row.requests <= limit;
  });
  // Throw after the separate counter transaction commits, so denied requests count too.
  if (!accepted) throw new DesktopError('RATE_LIMITED', 429);
}
