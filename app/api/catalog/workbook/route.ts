import { NextRequest,NextResponse } from 'next/server';
import { copyAuthCookies } from '@/lib/server/auth-flows';
import { catalogAccess,catalogResponse,catalogFailure,boundedCatalogBody,readCatalogQuery,catalogRevision } from '@/lib/server/device-catalog-http';
import { catalogState,exportCatalog,previewCatalog } from '@/lib/server/device-catalog';
import { isLocale } from '@/lib/i18n/locale';
import { CatalogError } from '@/lib/device-catalog';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:NextRequest) { const response=catalogResponse(NextResponse.json({}));try {
  const access=await catalogAccess(request,response);const data=await exportCatalog(access,readCatalogQuery(request.nextUrl));
  const {writeCatalogWorkbook,writeCatalogCsv}=await import('@/lib/device-catalog-workbook');const csv=request.nextUrl.searchParams.get('format')==='csv';
  const chosen=request.nextUrl.searchParams.get('locale');const locale=isLocale(chosen)?chosen:'zh-CN';const body=csv?writeCatalogCsv(data.rows,locale):Buffer.from(writeCatalogWorkbook(data.rows,data.revision,locale));
  return copyAuthCookies(response,catalogResponse(new NextResponse(body,{headers:{'Content-Type':csv?'text/csv; charset=utf-8':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="device-catalog-r${data.revision}.${csv?'csv':'xlsx'}"`,'X-CT-Catalog-Revision':data.revision}})));
}catch(error){return catalogFailure(error,response);}}
export async function POST(request:NextRequest) { const response=catalogResponse(NextResponse.json({}));try {
  const access=await catalogAccess(request,response,true);const state=await catalogState(access);if(!state.canManage)throw new CatalogError('你没有设备目录维护权限。',403);
  const revision=catalogRevision(request.headers.get('x-ct-catalog-revision'));const bytes=await boundedCatalogBody(request,4*1024*1024);
  const {readCatalogWorkbook}=await import('@/lib/device-catalog-workbook');const parsed=readCatalogWorkbook(bytes);
  if(parsed.errors.length)return copyAuthCookies(response,catalogResponse(NextResponse.json({revision,rows:[],changes:[],errors:parsed.errors,digest:''})));
  return copyAuthCookies(response,catalogResponse(NextResponse.json(await previewCatalog(access,parsed.rows,revision))));
}catch(error){return catalogFailure(error,response);}}
