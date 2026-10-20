import { redirect } from "next/navigation";
import { isSupabaseMode } from "@/lib/supabase/config";
import { backendV2ReadsEnabled, getPageAccess, loadPageState } from "@/lib/backend/page-state";
import type { PageReadPlan } from "@/lib/backend/read-plan";
import { BackendPageData } from "./backend-page-data";
import { CatalogInitialDataProvider } from "./catalog/catalog-initial-data";

export async function BackendPageFrame({ plan, children }: { plan: PageReadPlan; children: React.ReactNode }) {
  if (!isSupabaseMode() || !backendV2ReadsEnabled()) return children;
  const access = await getPageAccess();
  if (!access) redirect("/account/pending");
  // Catalog control/first-50 data start beside the page bootstrap. A failed
  // optional seed leaves the ordinary authenticated API and local retry intact.
  const seed = plan.kind === "catalog" ? import("@/lib/server/device-catalog").then(module => module.catalogInitialPage(access.identity, access.storeId)).catch(() => undefined) : undefined;
  const [initial, catalog] = await Promise.all([loadPageState(access, plan,undefined,undefined,2), seed]);
  if ("unchanged" in initial) throw new Error("后台资料暂不可用。");
  return <BackendPageData initial={initial}>{plan.kind === "catalog" ? <CatalogInitialDataProvider initial={catalog}>{children}</CatalogInitialDataProvider> : children}</BackendPageData>;
}
