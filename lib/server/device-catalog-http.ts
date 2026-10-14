import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { requireAccountIdentity, requireAccountSession } from './account-auth';
import { copyAuthCookies } from './auth-flows';
import { AuthRequestError, requireSameOrigin } from '@/lib/supabase/server';
import { withDatabase, BackendError } from '@/lib/backend/database';
import { CatalogError, catalogCategories, catalogQueryCategories, catalogPickerScopeKey, type CatalogQuery } from '@/lib/device-catalog';
import { isSupabaseMode } from '@/lib/supabase/config';
import { withCatalogRead, catalogReadScope } from './device-catalog';
export function catalogResponse<T extends NextResponse>(response: T): T {
  response.headers.set('Cache-Control','private, no-store, max-age=0'); response.headers.set('CDN-Cache-Control','no-store'); response.headers.set('Vercel-CDN-Cache-Control','no-store'); response.headers.set('X-Content-Type-Options','nosniff'); return response;
}
export function catalogFailure(error: unknown, response: NextResponse) {
  const known = error instanceof CatalogError || error instanceof BackendError || error instanceof AuthRequestError;
  if(!known)console.error('device_catalog_failure',{name:error instanceof Error?error.name:'unknown',code:typeof error==='object'&&error!==null&&'code' in error?String(error.code):'unknown',permission:typeof error==='object'&&error!==null&&'code' in error&&error.code==='42501'&&error instanceof Error?error.message:undefined});
  return copyAuthCookies(response,catalogResponse(NextResponse.json({ message: known ? error.message : '设备目录暂不可用，请稍后重试。' }, { status: known ? error.status : 503 })));
}
export async function catalogAccess(request: NextRequest, response: NextResponse, write = false) {
  if (!isSupabaseMode()) throw new CatalogError('此操作仅在正式后台开放。',404);
  if (write) requireSameOrigin(request);
  const { identity } = await requireAccountSession(request,response,write);
  if (write && request.headers.get('x-ct-session-id') !== identity.sessionId) throw new CatalogError('登录会话已变化，请刷新后重试。',409);
  const selected = request.headers.get('x-ct-store-id') ?? request.cookies.get('ct_store')?.value;
  if (selected && !/^[a-f0-9-]{36}$/i.test(selected)) throw new CatalogError('目录门店范围无效。');
  const storeId = await withDatabase(identity,null, async tx => {
    const rows = selected
      ? await tx`select store_id from chinatech_v2.store_memberships where user_id=${identity.userId} and store_id=${selected} and membership_status='active' limit 1`
      : await tx`select store_id from chinatech_v2.store_memberships where user_id=${identity.userId} and membership_status='active' order by store_id limit 1`;
    return rows[0]?.store_id;
  });
  if (!storeId) throw new CatalogError('当前账号没有获授权的门店。',403);
  return { identity, storeId: storeId as string };
}
export async function catalogReadAccess<T>(request: NextRequest, response: NextResponse, run: Parameters<typeof withCatalogRead<T>>[2]): Promise<T> {
  if (!isSupabaseMode()) throw new CatalogError('此操作仅在正式后台开放。',404);
  const started = performance.now(); let identityFinished: number | undefined; let databaseStarted: number | undefined;
  try {
    const { identity } = await requireAccountIdentity(request, response, request.headers.has('x-ct-account-id'));
    identityFinished = performance.now();
    if (request.headers.has('x-ct-session-id') && request.headers.get('x-ct-session-id') !== identity.sessionId) throw new CatalogError('登录会话已变化，请刷新后重试。',409);
    const selected = request.headers.get('x-ct-store-id') ?? request.cookies.get('ct_store')?.value;
    if (selected && !/^[a-f0-9-]{36}$/i.test(selected)) throw new CatalogError('目录门店范围无效。');
    databaseStarted = performance.now();
    return await withCatalogRead(identity, selected, async access => {
      const scope = request.headers.get('x-ct-catalog-scope');
      if (scope !== null && scope !== catalogPickerScopeKey(catalogReadScope(access))) throw new CatalogError('目录授权范围已变化，请刷新后重试。',409);
      return run(access);
    });
  } finally {
    const ended = performance.now();
    response.headers.set('Server-Timing', `auth;dur=${((identityFinished ?? ended)-started).toFixed(1)}, catalog;dur=${(databaseStarted === undefined ? 0 : ended-databaseStarted).toFixed(1)}`);
  }
}
export function readCatalogQuery(url: URL): CatalogQuery {
  const q=url.searchParams.get('q') ?? ''; const brand=url.searchParams.get('brand') ?? ''; const family=url.searchParams.get('family') ?? ''; const category=url.searchParams.get('category') ?? ''; const page=Number(url.searchParams.get('page') ?? 1);
  if(q.length>160 || brand.length>60 || family.length>100 || (category && !catalogQueryCategories(category).length) || !Number.isSafeInteger(page) || page<1 || page>2000) throw new CatalogError('目录查询条件无效。');
  return { q,brand,family,category,page,familyExact:url.searchParams.get('familyExact')==='1',includeDisabled:url.searchParams.get('disabled')==='true' };
}
export function readCatalogPickerQuery(url: URL): CatalogQuery {
  const query = readCatalogQuery(url);
  if (![...catalogCategories, 'computer'].includes(query.category as typeof catalogCategories[number] | 'computer') || query.includeDisabled || query.q || query.page !== 1) throw new CatalogError('目录查询条件无效。');
  return query;
}
export async function boundedCatalogBody(request: NextRequest, max = 12*1024*1024) {
  const reader=request.body?.getReader(); if(!reader) throw new CatalogError('请求内容为空。');
  const chunks: Uint8Array[]=[]; let size=0;
  try { while(true){ const part=await reader.read(); if(part.done)break; size+=part.value.byteLength;if(size>max){await reader.cancel();throw new CatalogError('导入文件或请求超过允许大小。',413);}chunks.push(part.value);} }
  finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export function catalogRevision(value: unknown): string {
  if(typeof value!=='string' || !/^(0|[1-9][0-9]{0,18})$/.test(value) || BigInt(value)>BigInt('9223372036854775807'))throw new CatalogError('目录版本无效。'); return value;
}
export function catalogRequestId(value: unknown): string { if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value))throw new CatalogError('目录请求编号无效。');return value; }
