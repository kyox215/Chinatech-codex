import { NextRequest, NextResponse } from 'next/server';
import { copyAuthCookies } from '@/lib/server/auth-flows';
import { catalogAccess,catalogFailure,catalogResponse,readCatalogQuery,boundedCatalogBody,catalogRevision,catalogRequestId } from '@/lib/server/device-catalog-http';
import { catalogGroups,catalogState,queryCatalog,previewCatalog,applyCatalog,catalogHistory,restoreCatalogPreview,initialCatalog } from '@/lib/server/device-catalog';
import { CatalogError,catalogQueryPage,catalogBrandAliases,catalogQueryCategories,catalogSearchTerms,catalogSearchText } from '@/lib/device-catalog';
import { isSupabaseMode } from '@/lib/supabase/config';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(request:NextRequest) {
  const response=catalogResponse(NextResponse.json({}));
  try {
    const query=readCatalogQuery(request.nextUrl); const kind=request.nextUrl.searchParams.get('kind') ?? 'models';
    let result:unknown;
    if(!isSupabaseMode()) {
      // Only the already enabled local preview session may use the packaged seed.
      const { isPreviewLoginAvailable,PREVIEW_SESSION_COOKIE,PREVIEW_SESSION_VALUE }=await import('@/lib/preview-auth');
      if(!isPreviewLoginAvailable() || request.cookies.get(PREVIEW_SESSION_COOKIE)?.value!==PREVIEW_SESSION_VALUE)throw new CatalogError('请先登录后查看设备目录。',401);
      if(kind==='state') result={revision:'seed',canManage:false,accountId:'preview',sessionId:'preview',storeId:'preview'};
      else if(kind==='groups') {
        const categories=catalogQueryCategories(query.category ?? ''); const matching=initialCatalog.rows.filter(row=>row.enabled&&categories.includes(row.category)&&catalogSearchTerms(query.q??'').every(term=>catalogSearchText(row).includes(term)));
        const group=(field:'brand'|'family',rows:typeof matching)=>[...new Set(rows.map(row=>row[field]))].sort().map(value=>({value,total:rows.filter(row=>row[field]===value).length,aliases:field==='brand'?catalogBrandAliases(value):[]}));
        result={revision:'seed',brands:group('brand',matching),families:group('family',matching.filter(row=>!query.brand||catalogBrandAliases(row.brand).some(value=>value.toLowerCase()===query.brand?.toLowerCase())))};
      } else if(kind==='models')result=catalogQueryPage(initialCatalog.rows,query,'seed');
      else throw new CatalogError('此操作仅在正式后台开放。',404);
    } else {
      const access=await catalogAccess(request,response);
      if(kind==='state')result=await catalogState(access);
      else if(kind==='groups')result=await catalogGroups(access,query.category ?? '',query.brand ?? '',query.q ?? '');
      else if(kind==='models')result=await queryCatalog(access,query);
      else if(kind==='history')result=await catalogHistory(access);
      else if(kind==='coverage') { const state=await catalogState(access);if(!state.canManage)throw new CatalogError('你没有设备目录维护权限。',403);result={sources:initialCatalog.sources,coverage:initialCatalog.coverage}; }
      else throw new CatalogError('目录查询类型无效。');
    }
    return copyAuthCookies(response,catalogResponse(NextResponse.json(result)));
  }catch(error){return catalogFailure(error,response);}
}
export async function POST(request:NextRequest) {
  const response=catalogResponse(NextResponse.json({}));
  try {
    const access=await catalogAccess(request,response,true);
    const permissionState=await catalogState(access);if(!permissionState.canManage)throw new CatalogError('你没有设备目录维护权限。',403);
    let body:Record<string,unknown>;try{body=JSON.parse((await boundedCatalogBody(request)).toString('utf8'));}catch(error){if(error instanceof CatalogError)throw error;throw new CatalogError('请求格式无效。');}
    if(!body||typeof body!=='object'||Array.isArray(body))throw new CatalogError('请求格式无效。');
    const allowed=body.action==='apply'?['action','rows','revision','digest','requestId']:body.action==='restore'?['action','revision','targetRevision']:['action','rows','revision'];
    if(Object.keys(body).some(key=>!allowed.includes(key)))throw new CatalogError('请求包含未知字段。');
    const revision=catalogRevision(body.revision); let result:unknown;
    if(body.action==='preview')result=await previewCatalog(access,body.rows,revision);
    else if(body.action==='restore')result=await restoreCatalogPreview(access,catalogRevision(body.targetRevision),revision);
    else if(body.action==='apply') { if(typeof body.digest!=='string'||!/^[a-f0-9]{64}$/.test(body.digest))throw new CatalogError('导入摘要无效。');result=await applyCatalog(access,body.rows,revision,body.digest,catalogRequestId(body.requestId)); }
    else throw new CatalogError('目录操作无效。');
    return copyAuthCookies(response,catalogResponse(NextResponse.json(result)));
  }catch(error){return catalogFailure(error,response);}
}
