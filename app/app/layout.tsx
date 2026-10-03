import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { BackendDomainsProvider } from "@/components/backend-domains-provider";
import dynamicImport from "next/dynamic";
const PreviewProviders=dynamicImport(()=>import("@/components/preview-providers"));
import { isPreviewLoginAvailable, PREVIEW_SESSION_COOKIE, PREVIEW_SESSION_VALUE } from "@/lib/preview-auth";
import { isSupabaseMode } from "@/lib/supabase/config";
import { getServerAccess, memberInTransaction } from "@/lib/backend/context";
import { withDatabase, BackendError } from "@/lib/backend/database";
import { loadPageState } from "@/lib/backend/page-state";
import { BackendProvider, BackendSyncNotice } from "@/components/backend-provider";

// Authenticated snapshots are request-scoped and must never be prerendered.
export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  if(isSupabaseMode()) {
    let access;
    try {access=await getServerAccess();}
    catch(error) {if(error instanceof BackendError && error.status===401) redirect("/login");throw error;}
    if(!access) redirect("/account/pending");
    const initial=await withDatabase(access.identity,access.storeId,async tx=>{const fresh=await memberInTransaction(tx,access.storeId,access.identity.userId);return loadPageState(tx,access.storeId,fresh,"/app/shell");});
    return <BackendProvider initial={initial}><BackendDomainsProvider><AppShell><BackendSyncNotice/>{children}</AppShell></BackendDomainsProvider></BackendProvider>;
  }
  const cookieStore = await cookies();
  if (!isPreviewLoginAvailable() || cookieStore.get(PREVIEW_SESSION_COOKIE)?.value !== PREVIEW_SESSION_VALUE) {
    redirect("/login");
  }
  return <PreviewProviders><AppShell>{children}</AppShell></PreviewProviders>;
}
