import { isRepairDeskE2eAuthBypassEnabled } from "@/shared/lib/e2e-auth-bypass";
import { hasSupabaseConfig } from "@/server/supabase";

export async function kioskPublicSource() {
  if (hasSupabaseConfig() && !isRepairDeskE2eAuthBypassEnabled()) {
    return import("@/features/kiosk/server/kiosk.service");
  }
  return import("@/features/kiosk/testing/mock-api");
}
