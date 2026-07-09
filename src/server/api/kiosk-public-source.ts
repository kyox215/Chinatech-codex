import { hasSupabaseConfig } from "@/server/supabase";

export async function kioskPublicSource() {
  if (hasSupabaseConfig()) {
    return import("@/features/kiosk/server/kiosk.service");
  }
  return import("@/features/kiosk/testing/mock-api");
}
