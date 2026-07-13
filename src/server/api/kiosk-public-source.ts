import { isRepairDeskE2eAuthBypassEnabled } from "@/shared/lib/e2e-auth-bypass";
import { resolveRepairDeskSourceMode } from "@/server/repairdesk-source-mode";
import { hasSupabaseConfig } from "@/server/supabase";

export async function kioskPublicSource() {
  const mode = resolveRepairDeskSourceMode({
    hasSupabaseConfig: hasSupabaseConfig(),
    e2eAuthBypass: isRepairDeskE2eAuthBypassEnabled(),
  });
  if (mode === "supabase") {
    return import("@/features/kiosk/server/kiosk.service");
  }
  return import("@/features/kiosk/testing/mock-api");
}
