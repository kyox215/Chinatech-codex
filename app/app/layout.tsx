import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { ProcurementProvider } from "@/components/procurement/procurement-provider";
import { RetailProvider } from "@/components/retail/retail-provider";
import { isPreviewLoginAvailable, PREVIEW_SESSION_COOKIE, PREVIEW_SESSION_VALUE } from "@/lib/preview-auth";
import { isSupabaseMode } from "@/lib/supabase/config";
import { getServerAccess, memberInTransaction } from "@/lib/backend/context";
import { withDatabase, BackendError } from "@/lib/backend/database";
import { loadState, projectState } from "@/lib/backend/state";
import { BackendProvider } from "@/components/backend-provider";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  if(isSupabaseMode()) {
    let access;
    try {access=await getServerAccess();}
    catch(error) {if(error instanceof BackendError && error.status===401) redirect("/login");return <div className="module-empty" role="alert">后台暂不可用，请稍后重试。</div>;}
    if(!access) redirect("/account/pending");
    const initial=await withDatabase(access.identity,access.storeId,async tx=>{const fresh=await memberInTransaction(tx,access.storeId,access.identity.userId);return projectState(await loadState(tx,access.storeId,fresh),fresh);});
    return <BackendProvider initial={initial}><ProcurementProvider><RetailProvider><AppShell>{children}</AppShell></RetailProvider></ProcurementProvider></BackendProvider>;
  }
  const cookieStore = await cookies();
  if (!isPreviewLoginAvailable() || cookieStore.get(PREVIEW_SESSION_COOKIE)?.value !== PREVIEW_SESSION_VALUE) {
    redirect("/login");
  }
  return <ProcurementProvider><RetailProvider><AppShell>{children}</AppShell></RetailProvider></ProcurementProvider>;
}
