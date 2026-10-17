import {NextResponse} from 'next/server';
import {getServerAccess,memberInTransaction} from '@/lib/backend/context';
import {BackendError,withDatabase} from '@/lib/backend/database';
import {can} from '@/lib/staff';
import {downloadStoredPhoto} from '@/lib/server/attachment-storage';
import {requiredUuid} from '@/lib/server/stores';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'};
export async function GET(request:Request){try{
 const id=requiredUuid(new URL(request.url).searchParams.get('photo')),unitId=requiredUuid(new URL(request.url).searchParams.get('unit'));
 const access=await getServerAccess(request);if(!access)throw new BackendError('当前账号没有获授权的门店。',403);
 const mime=await withDatabase(access.identity,access.storeId,async tx=>{
  const member=await memberInTransaction(tx,access.storeId,access.identity.userId);if(!can(member,'retail.view'))throw new BackendError('当前账号没有查看权限。',403);
  const [row]=await tx`select u.mime from chinatech_v2_private.attachment_usage u join chinatech_v2_private.retail_units r on r.store_id=u.store_id where u.store_id=${access.storeId} and u.id=${id} and r.id=${unitId} and r.data->'photos' @> ${tx.json(['ct-photo:'+id])}`;
  if(!row)throw new BackendError('照片不存在。',404);return row.mime as string;
 });
 const data=await downloadStoredPhoto(access.storeId,id);return new NextResponse(data.buffer,{headers:{...headers,'Content-Type':mime}});
 }catch(error){return NextResponse.json({message:error instanceof BackendError?error.message:'照片暂不可用，请稍后重试。'},{status:error instanceof BackendError?error.status:503,headers});}}
