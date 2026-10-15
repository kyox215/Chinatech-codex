import 'server-only';
import type {TransactionSql} from 'postgres';
import {withDatabase,type AuthIdentity} from '@/lib/backend/database';
import {DesktopError,desktopUuid} from './office-desktop-token';
import {hashV3,signingReadyV3} from './office-desktop-v3-token';
import {lockV3,transactionV3} from './office-desktop-v3-database';
import {isToolId,type ToolState,type ToolRelease,type ToolId} from './tool-registry';

type Row={tool_id:ToolId;active_release_id:string|null;enabled:boolean;ready:boolean;revision:string;manifest:ToolRelease|null};
const projection=(r:Row):ToolState=>({toolId:r.tool_id,activeReleaseId:r.active_release_id,enabled:r.enabled,ready:r.ready,revision:r.revision,release:r.manifest});
export async function readTool(tx:TransactionSql,toolId:ToolId):Promise<ToolState>{
 const [r]=await tx<Row[]>`select t.tool_id,t.active_release_id,t.enabled,t.revision::text,coalesce(r.ready,false) as ready,r.manifest from chinatech_v2_private.toolbox_tools t left join chinatech_v2_private.toolbox_releases r on r.tool_id=t.tool_id and r.release_id=t.active_release_id where t.tool_id=${toolId}`;
 if(!r)throw new DesktopError('SERVICE_UNAVAILABLE',503);return projection(r);
}
export async function toolStatus(toolId:ToolId){return transactionV3(null,'','tool-status','',tx=>readTool(tx,toolId));}
async function admin(tx:TransactionSql,identity:AuthIdentity){const [r]=await tx<{allowed:boolean}[]>`select chinatech_v2_private.office_desktop_admin() as allowed`;if(!r?.allowed)throw new DesktopError('NO_ACCESS',403);void identity;}
async function listing(tx:TransactionSql){const rows=await tx<Row[]>`select t.tool_id,t.active_release_id,t.enabled,t.revision::text,coalesce(r.ready,false) as ready,r.manifest from chinatech_v2_private.toolbox_tools t left join chinatech_v2_private.toolbox_releases r on r.tool_id=t.tool_id and r.release_id=t.active_release_id order by t.position`;return rows.map(projection);}
export async function adminTools(identity:AuthIdentity,body?:Record<string,unknown>){return withDatabase(identity,null,async tx=>{
 await admin(tx,identity);
 if(body){
  if(!isToolId(body.toolId)||typeof body.enabled!=='boolean'||typeof body.expectedRevision!=='string'||!/^\d{1,18}$/.test(body.expectedRevision))throw new DesktopError('INVALID_REQUEST');
  const requestId=desktopUuid(body.requestId),fingerprint=hashV3(JSON.stringify([body.toolId,body.enabled,body.expectedRevision]));
  // Same lock as Office commit: pause/publish cannot race an uncommitted new job.
  await lockV3(tx,'control');await tx`select pg_advisory_xact_lock(hashtextextended('toolbox-controls',140))`;
  const [receipt]=await tx<{fingerprint:string;actor_id:string;session_id:string}[]>`select fingerprint,actor_id,session_id from chinatech_v2_private.toolbox_admin_receipts where request_id=${requestId}`;
  if(receipt){if(receipt.fingerprint!==fingerprint||receipt.actor_id!==identity.userId||receipt.session_id!==identity.sessionId)throw new DesktopError('REQUEST_CONFLICT',409);}
  else{
   const state=await readTool(tx,body.toolId);
   if(state.revision!==body.expectedRevision)throw new DesktopError('REQUEST_CONFLICT',409);
   if(body.enabled&&(!state.ready||!state.activeReleaseId||(body.toolId==='office'&&!signingReadyV3())))throw new DesktopError('SERVICE_UNAVAILABLE',503);
   if(body.toolId==='office')await tx`update chinatech_v2_private.office_v3_control set enabled=${body.enabled},revision=revision+1,updated_by=${identity.userId},updated_at=now() where singleton`;
   await tx`update chinatech_v2_private.toolbox_tools set enabled=${body.enabled},revision=revision+1,updated_by=${identity.userId},updated_at=now() where tool_id=${body.toolId}`;
   await tx`insert into chinatech_v2_private.toolbox_admin_receipts(request_id,actor_id,session_id,fingerprint) values(${requestId},${identity.userId},${identity.sessionId},${fingerprint})`;
  }
 }
 return {accountId:identity.userId,sessionId:identity.sessionId,tools:await listing(tx)};
});}
