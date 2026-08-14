import type {
  AuditActor,
  InventoryCatalogSearchInput,
  InventoryCatalogSearchResult,
} from "@/lib/repairdesk/types";
import { fail, requireStoreIdFromActor } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";

const MAX_DATABASE_ROWS = 100;
const DEFAULT_RESULT_LIMIT = 50;

type CatalogRow = {
  category?: unknown;
  brand?: unknown;
  model?: unknown;
};

function normalizeSearchValue(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() || undefined;
}

function trimSearchValue(value: string | undefined) {
  return value?.trim() || undefined;
}

/** Escape PostgreSQL ILIKE characters and reject PostgREST star aliases. */
export function escapeIlikePattern(value: string, contains = false) {
  if (value.includes("*")) {
    throw new Error("目录搜索不支持通配符 *，请使用手工录入");
  }
  const escaped = value.replace(/[\\%_]/g, (character) => `\\${character}`);
  return contains ? `%${escaped}%` : escaped;
}

function boundedLimit(value: number | undefined) {
  return Math.min(Math.max(value ?? DEFAULT_RESULT_LIMIT, 1), MAX_DATABASE_ROWS);
}

/**
 * Reads only active catalog suggestions owned by the actor's current store.
 * The projection deliberately excludes catalog ids and every inventory,
 * pricing, identifier, customer, and staff field.
 */
export async function searchInventoryCatalog(
  input: InventoryCatalogSearchInput,
  actor: AuditActor,
): Promise<InventoryCatalogSearchResult> {
  const storeId = requireStoreIdFromActor(actor, "读取设备目录");
  const resultLimit = boundedLimit(input.limit);
  const brandValue = trimSearchValue(input.brand);
  const queryValue = trimSearchValue(input.query);
  const brandFilter = normalizeSearchValue(input.brand);
  const queryFilter = normalizeSearchValue(input.query);
  const brandPattern = brandValue ? escapeIlikePattern(brandValue) : undefined;
  const queryPattern = queryValue ? escapeIlikePattern(queryValue, true) : undefined;

  let query = getSupabaseAdmin()
    .from("inventory_product_catalog_items")
    .select("category,brand,model")
    .eq("store_id", storeId)
    .eq("active", true)
    .eq("category", input.category);
  if (brandPattern) {
    query = query.ilike("brand", brandPattern);
  }
  if (queryPattern) {
    query = query.ilike("model", queryPattern);
  }
  const { data, error } = await query
    .order("brand", { ascending: true })
    .order("model", { ascending: true })
    .limit(MAX_DATABASE_ROWS);
  fail(error, "读取设备目录失败");

  const seen = new Set<string>();
  const items = ((data ?? []) as CatalogRow[])
    .filter((row) => {
      const brand = typeof row.brand === "string" ? row.brand.trim() : "";
      const model = typeof row.model === "string" ? row.model.trim() : "";
      if (!brand || !model) return false;
      const normalizedBrand = brand.toLocaleLowerCase();
      const normalizedModel = model.toLocaleLowerCase();
      if (brandFilter && normalizedBrand !== brandFilter) return false;
      if (queryFilter && !`${normalizedBrand} ${normalizedModel}`.includes(queryFilter)) {
        return false;
      }
      return true;
    })
    .map((row) => ({
      category: input.category,
      brand: (row.brand as string).trim(),
      model: (row.model as string).trim(),
      source: "learned" as const,
    }))
    .filter((item) => {
      const key = `${item.brand.toLocaleLowerCase()}\u0000${item.model.toLocaleLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, resultLimit);

  return { items };
}
