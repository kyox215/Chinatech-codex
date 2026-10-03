import { isSupabaseMode } from "@/lib/supabase/config";
import { getServerAccess, memberInTransaction } from "@/lib/backend/context";
import { withDatabase, BackendError } from "@/lib/backend/database";
import { loadPageState } from "@/lib/backend/page-state";
import { BackendPageProvider } from "@/lib/backend/react";
import { BackendDomainsProvider } from "./backend-domains-provider";

export async function BackendPage({ scope, children }: { scope: string; children: React.ReactNode }) {
  if (!isSupabaseMode()) return children;
  const access = await getServerAccess(); if (!access) throw new BackendError("当前账号尚未获得门店授权。", 403);
  const initial = await withDatabase(access.identity, access.storeId, async tx => loadPageState(tx, access.storeId, await memberInTransaction(tx, access.storeId, access.identity.userId), scope));
  return <BackendPageProvider initial={initial}><BackendDomainsProvider>{children}</BackendDomainsProvider></BackendPageProvider>;
}
