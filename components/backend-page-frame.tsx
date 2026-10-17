import { redirect } from "next/navigation";
import { isSupabaseMode } from "@/lib/supabase/config";
import { backendV2ReadsEnabled, getPageAccess, loadPageState } from "@/lib/backend/page-state";
import type { PageReadPlan } from "@/lib/backend/read-plan";
import { BackendPageData } from "./backend-page-data";

export async function BackendPageFrame({ plan, children }: { plan: PageReadPlan; children: React.ReactNode }) {
  if (!isSupabaseMode() || !backendV2ReadsEnabled()) return children;
  const access = await getPageAccess();
  if (!access) redirect("/account/pending");
  const initial = await loadPageState(access, plan);
  if ("unchanged" in initial) throw new Error("后台资料暂不可用。");
  return <BackendPageData initial={initial}>{children}</BackendPageData>;
}
