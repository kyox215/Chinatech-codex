import { resolveNewInventoryWarrantyMonths } from "@/entities/store/model/store-setting-defaults";
import type { DbRecord } from "@/server/repairdesk-shared";
import { fail } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";

export async function resolveInventoryIntakeWarrantyMonths(
  storeId: string,
  explicitMonths: number | undefined,
) {
  if (explicitMonths !== undefined) {
    return resolveNewInventoryWarrantyMonths(explicitMonths, undefined);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("store_settings")
    .select("default_inventory_warranty_months")
    .eq("store_id", storeId)
    .maybeSingle();
  fail(error, "读取库存默认保修失败");
  const defaultMonths = (data as DbRecord | null)?.default_inventory_warranty_months;
  return resolveNewInventoryWarrantyMonths(undefined, defaultMonths);
}
